# Configuração das Credenciais do WhatsApp Business API

Este guia explica como obter cada informação necessária para configurar a integração com a **WhatsApp Business Cloud API** (Meta).

---

## Pré-requisitos

Antes de começar, você precisa ter:

- Uma **conta no Meta Business Suite** ([business.facebook.com](https://business.facebook.com))
- Um **aplicativo criado no Meta Developer Portal** ([developers.facebook.com](https://developers.facebook.com))
- O produto **WhatsApp** adicionado ao seu aplicativo
- Um número de telefone registrado na sua conta WhatsApp Business (WABA)

> Se ainda não tem um aplicativo Meta configurado, siga o guia oficial:
> [Get Started with WhatsApp Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started)

---

## Onde encontrar cada credencial

### 1. Phone Number ID

O **Phone Number ID** identifica o número de telefone específico que enviará e receberá mensagens.

**Como encontrar:**

1. Acesse [developers.facebook.com](https://developers.facebook.com) e abra seu aplicativo
2. No menu lateral, clique em **WhatsApp → Configuração da API** (ou "API Setup")
3. Na seção **"Envie e receba mensagens"**, localize o campo **"De"** (From)
4. O número exibirá ao lado o **Phone Number ID** (um número de 15–16 dígitos)

Também pode ser encontrado em:
- **Meta Business Suite → WhatsApp Manager → Números de telefone → (ícone de configurações do número)**

---

### 2. Access Token

O **Access Token** autoriza as chamadas à API em nome da sua conta. Existem dois tipos:

#### Token temporário (para testes)

1. Acesse **Meta Developer Portal → seu app → WhatsApp → Configuração da API**
2. Na seção **"Token de acesso temporário"**, copie o token exibido
3. Este token expira em **24 horas** — use apenas para testes

#### Token permanente (recomendado para produção)

1. Acesse **Meta Business Suite → Configurações → Usuários → Usuários do sistema**
2. Clique em **"Adicionar"** e crie um usuário do sistema com função **"Admin"**
3. Clique em **"Gerar novo token"** ao lado do usuário criado
4. Selecione o seu aplicativo na lista
5. Marque as permissões: `whatsapp_business_messaging` e `whatsapp_business_management`
6. Clique em **"Gerar token"** e copie — este token **não expira**

> **Atenção:** Guarde o token em local seguro. Ele não será exibido novamente após fechar o modal.

---

### 3. WABA ID (WhatsApp Business Account ID)

O **WABA ID** é o identificador da sua conta WhatsApp Business. Todos os números de telefone da mesma empresa compartilham o mesmo WABA ID.

**Como encontrar:**

**Opção A — Developer Portal:**
1. Acesse **Meta Developer Portal → seu app → WhatsApp → Configuração da API**
2. Na seção **"WhatsApp Business Account"**, o ID da conta é exibido logo abaixo do nome da conta

**Opção B — Meta Business Suite:**
1. Acesse [business.facebook.com](https://business.facebook.com)
2. Clique em **Configurações** (ícone de engrenagem) → **Contas do WhatsApp Business**
3. Selecione a conta — o **ID da conta** aparece na barra lateral direita

---

### 4. Webhook Verify Token

O **Webhook Verify Token** é um texto **definido por você** (não gerado pela Meta). Ele é usado para confirmar à Meta que o endpoint do webhook configurado pertence à sua aplicação.

**Como configurar:**

1. Escolha qualquer string aleatória e segura. Exemplos:
   - `minha-empresa-crm-2024`
   - `wh-verify-xK9mP3rQ`
   - Use um gerador de UUID ou senha aleatória
2. Cole esse mesmo valor no campo **"Webhook Verify Token"** nesta tela de configurações
3. Em seguida, configure o webhook no Meta Developer Portal:
   - Acesse **Developer Portal → seu app → WhatsApp → Configuração → Webhooks**
   - Clique em **"Editar"** ao lado do webhook
   - No campo **"Token de verificação"**, insira **o mesmo valor** escolhido no passo 1
   - No campo **"URL de callback"**, insira a URL do seu servidor:
     ```
     https://seu-dominio.com/api/webhooks/whatsapp
     ```
   - Clique em **"Verificar e salvar"**
4. A Meta fará uma requisição GET para a URL de callback passando o token — se os valores coincidirem, o webhook será ativado

> O token pode ser qualquer string alfanumérica. Evite usar dados sensíveis como senhas reais.

---

### 5. Versão da API

A **versão da API** determina qual versão da Graph API será usada nas chamadas. O padrão atual é **`v20.0`**.

- Consulte as versões disponíveis em: [developers.facebook.com/docs/graph-api/changelog](https://developers.facebook.com/docs/graph-api/changelog)
- Recomendação: mantenha `v20.0` ou atualize conforme o Meta lançar novas versões estáveis
- Versões antigas são descontinuadas periodicamente (geralmente após 2 anos)

---

### 6. Delay entre mensagens

O **delay** (em milissegundos) é um intervalo interno aplicado entre cada mensagem enviada em campanhas em massa. Não é uma configuração da Meta.

- Valor recomendado: **`1000` ms** (1 segundo)
- Valores muito baixos podem causar bloqueio temporário pela Meta (rate limit)
- Para campanhas grandes, considere valores entre `1000` e `3000` ms

---

## Configuração de canais de atendimento

Os **canais** representam números de telefone individuais dentro da mesma WABA. Use canais para:

- Atribuir um número específico a um vendedor
- Segmentar atendimento por região, produto ou equipe

### Campos do canal

| Campo | Descrição |
|-------|-----------|
| **Nome do canal** | Nome interno para identificação (ex: `João – Vendas SP`) |
| **Phone Number ID** | ID do número específico deste canal (ver seção 1) |
| **Access Token** | Token para este número (pode ser o mesmo da conta ou específico) |
| **WABA ID** | Mesmo WABA ID da conta principal (ver seção 3) |
| **Número exibido** | Formato legível para exibição, ex: `+55 11 99999-0001` (opcional) |
| **Vendedor responsável** | Usuário do CRM que receberá as conversas deste número |

### Adicionando múltiplos números

Se sua WABA tiver mais de um número de telefone, cada número terá um **Phone Number ID diferente**, mas o **WABA ID será o mesmo**. Crie um canal por número.

---

## Permissões necessárias no aplicativo Meta

Certifique-se de que seu aplicativo tem as seguintes permissões aprovadas:

- `whatsapp_business_messaging` — envio e recebimento de mensagens
- `whatsapp_business_management` — gerenciamento da conta e templates

Para verificar: **Developer Portal → seu app → Análise do aplicativo → Permissões e funcionalidades**

---

## Resumo rápido

| Campo | Onde encontrar |
|-------|---------------|
| Phone Number ID | Developer Portal → WhatsApp → API Setup → seção "De" |
| Access Token | Developer Portal → API Setup (temporário) ou Business Suite → Usuários do Sistema (permanente) |
| WABA ID | Developer Portal → WhatsApp → API Setup → "WhatsApp Business Account" |
| Webhook Verify Token | Você define — deve ser o mesmo configurado no webhook do Developer Portal |
| Versão da API | Manter `v20.0` (padrão) |
| Delay | Manter `1000` ms (padrão) |
