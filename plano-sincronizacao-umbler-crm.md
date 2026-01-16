# Plano de Implementação — Sincronização de Tags Umbler → CRM

## Objetivo

Sincronizar as **tags dos contatos no Umbler** com o **CRM em Node.js**, considerando que:

- O CRM **não pode alterar tags**
- O **Umbler é a fonte da verdade**
- Não existe webhook
- Existe o endpoint `/contacts/phone`
- Volume: ~5.000 clientes no CRM e ~10.000 contatos no Umbler

---

## Visão Geral da Solução

**Estratégia:**

> Sincronização orientada ao CRM usando `/contacts/phone` (funcao getContactByPhone()) + snapshot local

a funcao getContactByPhone retorna o seguinte resultado

{
"\_t": "string",
"id": "AB_12-xyzEXAMPLE",
"createdAtUTC": "2026-01-16T01:00:12.415Z",
"name": "string",
"phoneNumber": "string",
"email": "string",
"gender": "string",
"profilePictureUrl": "https://example.com",
"isBlocked": true,
"groupIdentifier": "string",
"contactType": "DirectMessage",
"organizationMembers": [
"AB_12-xyzEXAMPLE"
],
"channelIds": [
"AB_12-xyzEXAMPLE"
],
"tags": [
{
"\_t": "string",
"id": "AB_12-xyzEXAMPLE",
"name": "string"
},
{
"\_t": "string",
"id": "AB_12-xyzEXAMPLE",
"name": "string",
"emoji": "string",
"color": "Blue",
"description": "string",
"order": 0,
"createdAtUTC": "2026-01-16T01:00:12.415Z",
"groupIds": [
"AB_12-xyzEXAMPLE"
]
}
],
"lastActiveUTC": "2026-01-16T01:00:12.415Z",
"landline": "string",
"address": {
"addressLine1": "string",
"addressLine2": "string",
"city": "string",
"state": "string",
"zipCode": "string",
"country": "string"
},
"notes": [
{
"\_t": "string",
"id": "AB_12-xyzEXAMPLE",
"createdAtUTC": "2026-01-16T01:00:12.415Z",
"content": "string",
"pinned": true,
"createdBy": "AB_12-xyzEXAMPLE",
"elements": "string",
"mentions": [
{
"id": "AB_12-xyzEXAMPLE",
"source": "Contact"
}
]
}
],
"customFields": [
{
"_t": "string",
"id": "AB_12-xyzEXAMPLE",
"customFieldDefinitionId": "AB_12-xyzEXAMPLE"
},
{
"_t": "string",
"id": "AB_12-xyzEXAMPLE",
"customFieldDefinitionId": "AB_12-xyzEXAMPLE",
"value": 0
},
{
"_t": "string",
"id": "AB_12-xyzEXAMPLE",
"customFieldDefinitionId": "AB_12-xyzEXAMPLE",
"value": "string"
},
{
"_t": "string",
"id": "AB_12-xyzEXAMPLE",
"customFieldDefinitionId": "AB_12-xyzEXAMPLE",
"value": "string"
},
{
"_t": "string",
"id": "AB_12-xyzEXAMPLE",
"customFieldDefinitionId": "AB_12-xyzEXAMPLE",
"value": true
},
{
"_t": "string",
"id": "AB_12-xyzEXAMPLE",
"customFieldDefinitionId": "AB_12-xyzEXAMPLE",
"value": 0
},
{
"_t": "string",
"id": "AB_12-xyzEXAMPLE",
"customFieldDefinitionId": "AB_12-xyzEXAMPLE",
"value": "string"
},
{
"_t": "string",
"id": "AB_12-xyzEXAMPLE",
"customFieldDefinitionId": "AB_12-xyzEXAMPLE",
"value": "string"
},
{
"_t": "string",
"id": "AB_12-xyzEXAMPLE",
"customFieldDefinitionId": "AB_12-xyzEXAMPLE",
"value": "2026-01-16T01:00:12.415Z"
},
{
"_t": "string",
"id": "AB_12-xyzEXAMPLE",
"customFieldDefinitionId": "AB_12-xyzEXAMPLE",
"value": 0
}
]
}

Fluxo resumido:

```
CRM (clientes) → Umbler (/contacts/phone) → Snapshot → CRM (tags)
```

---

## Arquitetura

### Componentes

- **Worker de sincronização** (Node.js)
- **Tabela de snapshot**
- **Job scheduler (cron / fila)**
- **Métricas e logs**

---

## Etapa 1 — Preparação

### 1.1 Normalização de telefone

Criar utilitário único para normalizar telefones para E.164.

Exemplo:

- Entrada: `(11) 99999-9999`
- Saída: `+5511999999999`

Esse util será usado:

- No CRM
- No worker
- Em consultas ao Umbler

---

### 1.2 Mapeamento de clientes válidos

Definir critérios:

- Clientes ativos
- Clientes com telefone válido
- Clientes com permissão de comunicação

---

## Etapa 2 — Modelagem de Banco

### 2.1 Tabela de snapshot

```sql
umbler_contact_snapshot
- id (pk)
- crm_client_id (unique)
- phone_e164
- umbler_contact_id
- tags_hash
- tags_json
- last_synced_at
- last_checked_at
- not_found_at
```

### 2.2 Índices

- `crm_client_id`
- `phone_e164`
- `last_checked_at`
- `not_found_at`

---

## Etapa 3 — Integração com a API do Umbler

### 3.1 Endpoint utilizado

- `GET /contacts/phone?phone=+5511999999999`

### 3.2 Tratamento de respostas

- **200** → contato encontrado
- **404** → contato não existe
- **429** → aplicar backoff
- **5xx** → retry com limite

---

## Etapa 4 — Worker de Sincronização

### 4.1 Estratégia de execução

- Processar clientes em **batches pequenos**
- Exemplo: 100 clientes por execução
- Loop completo a cada 24h

---

### 4.2 Fluxo do worker

1. Buscar batch de clientes do CRM
2. Normalizar telefone
3. Consultar `/contacts/phone`
4. Se não existir:
   - Atualizar `not_found_at`
   - Pular
5. Se existir:
   - Calcular `tags_hash`
   - Comparar com snapshot
6. Se mudou:
   - Atualizar tags no CRM
   - Atualizar snapshot
7. Atualizar `last_checked_at`

---

### 4.3 Pseudocódigo

```ts
for (client of crmClientsBatch) {
  phone = normalizePhone(client.phone);

  contact = umbler.getContactByPhone(phone);

  if (!contact) {
    snapshot.markNotFound(client.id);
    continue;
  }

  hash = hashTags(contact.tags);

  if (snapshot.changed(client.id, hash)) {
    crm.updateTags(client.id, contact.tags);
    snapshot.save(client.id, contact, hash);
  }

  snapshot.touch(client.id);
}
```

---

## Etapa 5 — Rate Limit e Performance

### 5.1 Cálculo seguro

```
5.000 clientes / 24h
≈ 3–4 requisições por minuto
```

### 5.2 Controles

- Throttle por worker
- Retry com backoff exponencial
- Circuit breaker para falhas contínuas

---

## Etapa 6 — Cache de “não existe”

- Se `/contacts/phone` retornar 404:
  - Salvar `not_found_at`
  - Não consultar novamente por 7 dias
- Revalidar apenas se:
  - Telefone mudar
  - Cliente se tornar ativo novamente

---

## Etapa 7 — Monitoramento

### Métricas

- Clientes sincronizados por hora
- % de tags alteradas
- Erros por tipo
- Tempo médio por sync

### Alertas

- Falha contínua na API do Umbler
- Drift elevado de tags
- Worker parado

---

## Etapa 8 — Auditoria Periódica (Opcional)

- Reprocessar todos os clientes ativos 1x/dia
- Detectar divergências silenciosas
- Corrigir automaticamente

---

## Etapa 9 — Segurança e Confiabilidade

- Logs estruturados
- Idempotência por `crm_client_id`
- Transações ao atualizar CRM + snapshot
- Feature flag para desativar sync

---

## Cronograma Sugerido

| Semana | Atividade                 |
| ------ | ------------------------- |
| 1      | Modelagem + snapshot      |
| 2      | Integração API + worker   |
| 3      | Rate limit + cache        |
| 4      | Monitoramento + auditoria |

---

## Resultado Esperado

- CRM sempre refletindo o estado do Umbler
- Baixo custo operacional
- Escalável para 10x o volume atual
- Sem dependência de webhook

---

**Fonte da verdade:** Umbler  
**Responsabilidade do CRM:** leitura, cache e projeção
