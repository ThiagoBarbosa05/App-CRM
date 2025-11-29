# API de Campanhas - Documentação

## Visão Geral

Sistema completo para criação e gerenciamento de campanhas de marketing via WhatsApp usando a API Umbler uTalk.

## Endpoints

### 1. Criar Campanha

**POST** `/api/umbler/campaigns`

Cria uma nova campanha de marketing e agenda mensagens em massa.

#### Request Body

```json
{
  "title": "string (3-100 caracteres)",
  "tagIds": ["string"] (1-10 tags),
  "exclusiveTagFilter": boolean (default: true),
  "botId": "string",
  "botTriggerName": "string",
  "channelId": "string",
  "fromPhone": "string",
  "scheduledDate": "ISO 8601 datetime string",
  "intervalSeconds": number (1-60),
  "cancelUpon": ["contato" | "atendente" | "conversa_finalizada"],
  "organizationId": "string"
}
```

#### Validações

- **title**: 3-100 caracteres
- **tagIds**: Mínimo 1, máximo 10 tags
- **scheduledDate**: Deve ser no mínimo 2 minutos no futuro
- **intervalSeconds**: Entre 1 e 60 segundos
- **Limite de contatos**: Máximo 500 contatos por campanha

#### Response Success (201)

```json
{
  "success": true,
  "campaign": {
    "bulkSessionId": "string",
    "title": "string",
    "botId": "string",
    "channelId": "string",
    "totalContacts": number,
    "scheduledMessages": number,
    "failedMessages": number,
    "startDate": "ISO string",
    "endDate": "ISO string",
    "intervalSeconds": number,
    "exclusiveTagFilter": boolean,
    "tagIds": ["string"]
  },
  "scheduledMessages": [
    {
      "id": "string",
      "contactName": "string",
      "phoneNumber": "string",
      "scheduledAt": "ISO string"
    }
  ],
  "failedMessages": [
    {
      "contactName": "string",
      "phoneNumber": "string",
      "reason": "string"
    }
  ]
}
```

#### Response Error (400)

```json
{
  "error": "string",
  "details": [
    {
      "field": "string",
      "message": "string"
    }
  ]
}
```

#### Exemplos de Erro

**Título muito curto:**

```json
{
  "error": "Erro de validação",
  "details": [
    {
      "field": "title",
      "message": "O título deve ter no mínimo 3 caracteres"
    }
  ]
}
```

**Data de agendamento inválida:**

```json
{
  "error": "A data de agendamento deve ser no mínimo 2 minutos no futuro"
}
```

**Nenhum contato encontrado:**

```json
{
  "error": "Nenhum contato encontrado com as tags selecionadas",
  "tagIds": ["tag-id-1"],
  "exclusiveTagFilter": true
}
```

**Limite de contatos excedido:**

```json
{
  "error": "Número de contatos excede o limite de 500 por campanha",
  "contactsCount": 750,
  "message": "Por favor, refine os filtros ou divida em múltiplas campanhas"
}
```

---

### 2. Buscar Estatísticas de Campanha

**GET** `/api/umbler/campaigns/:id/stats`

Retorna estatísticas em tempo real de uma campanha.

#### URL Parameters

- `id`: ID da campanha (bulkSessionId)

#### Response Success (200)

```json
{
  "campaignId": "string",
  "stats": {
    "total": number,
    "sent": number,
    "failed": number,
    "pending": number
  },
  "timestamp": "ISO string"
}
```

#### Response Error (404)

```json
{
  "error": "Campanha não encontrada ou erro ao buscar estatísticas"
}
```

---

## Fluxo de Criação de Campanha

### 1. Validação de Input

- Schema Zod valida todos os campos obrigatórios
- Validação de formato de data ISO 8601
- Validação de limites (título, tags, intervalo)

### 2. Validação de Data

- Verifica se a data é válida
- Verifica se está no mínimo 2 minutos no futuro
- Converte para UTC mantendo o horário escolhido

### 3. Busca de Contatos

- Aplica filtro de tags
- Se `exclusiveTagFilter=true`, retorna apenas contatos com EXATAMENTE as tags selecionadas
- Se `exclusiveTagFilter=false`, retorna contatos com PELO MENOS uma das tags

### 4. Validação de Quantidade

- Verifica se há contatos
- Valida limite de 500 contatos
- Retorna erro se exceder

### 5. Criação de Bulk Session

- Cria sessão no Umbler com:
  - organizationId
  - channelId
  - title
  - expectedMessages (número de contatos)
  - botId
  - triggerName

### 6. Agendamento de Mensagens

- Para cada contato:
  - Calcula horário com intervalo
  - Converte para UTC
  - Agenda mensagem individual
  - Registra log de sucesso/falha

### 7. Logging

- Registra criação da campanha
- Registra status de cada mensagem
- Armazena metadata (botId, channelId, etc)

### 8. Resposta

- Retorna resumo completo
- Lista de mensagens agendadas
- Lista de falhas (se houver)

---

## Conversão de Timezone

O sistema garante que o horário escolhido pelo usuário seja respeitado independente do fuso horário:

```typescript
// Entrada: "2025-01-15T14:00:00" (horário local do usuário)
// Saída: "2025-01-15T14:00:00Z" (mantém 14:00 em UTC)

function convertToUTCMaintainingTime(localDateString: string): string {
  const date = new Date(localDateString);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}Z`;
}
```

---

## Filtro Exclusivo de Tags

### exclusiveTagFilter = true (recomendado)

Previne duplicatas - retorna apenas contatos que têm EXATAMENTE as tags selecionadas.

**Exemplo:**

- Tags selecionadas: [VIP, SP]
- Contato A: [VIP, SP] ✅ Incluído
- Contato B: [VIP, SP, Cliente] ❌ Não incluído (tem tag extra)
- Contato C: [VIP] ❌ Não incluído (falta tag)

### exclusiveTagFilter = false

Retorna contatos que têm PELO MENOS uma das tags selecionadas.

**Exemplo:**

- Tags selecionadas: [VIP, SP]
- Contato A: [VIP, SP] ✅ Incluído
- Contato B: [VIP, SP, Cliente] ✅ Incluído
- Contato C: [VIP] ✅ Incluído

---

## Monitoramento

As campanhas são monitoradas através de:

1. **Console Logs**

   - 📊 Campaign Created
   - 📧 Message Status
   - 🔄 Campaign Status Update

2. **Endpoint de Estatísticas**

   - Atualização a cada 30 segundos
   - Total/Enviadas/Falhas/Pendentes

3. **Banco de Dados** (futuro)
   - Tabela `campaigns`
   - Tabela `campaign_messages`

---

## Códigos de Erro

| Código | Descrição                   |
| ------ | --------------------------- |
| 400    | Erro de validação de campos |
| 404    | Campanha não encontrada     |
| 500    | Erro interno do servidor    |

---

## Exemplos de Uso

### cURL

```bash
curl -X POST http://localhost:5000/api/umbler/campaigns \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Promoção Black Friday",
    "tagIds": ["vip-clients"],
    "exclusiveTagFilter": true,
    "botId": "bot-123",
    "botTriggerName": "Início",
    "channelId": "channel-456",
    "fromPhone": "5511999999999",
    "scheduledDate": "2025-01-15T14:00:00",
    "intervalSeconds": 5,
    "cancelUpon": ["contato"],
    "organizationId": "org-789"
  }'
```

### JavaScript/TypeScript

```typescript
const response = await fetch("/api/umbler/campaigns", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    title: "Promoção Black Friday",
    tagIds: ["vip-clients"],
    exclusiveTagFilter: true,
    botId: "bot-123",
    botTriggerName: "Início",
    channelId: "channel-456",
    fromPhone: "5511999999999",
    scheduledDate: "2025-01-15T14:00:00",
    intervalSeconds: 5,
    cancelUpon: ["contato"],
    organizationId: "org-789",
  }),
});

const data = await response.json();
```

---

## Próximos Passos (Step 5)

1. Implementar persistência em banco de dados
2. Criar dashboard de monitoramento em tempo real
3. Adicionar webhook para notificações de status
4. Implementar cancelamento de campanhas
5. Adicionar filtros avançados de contatos
6. Implementar agendamento recorrente
