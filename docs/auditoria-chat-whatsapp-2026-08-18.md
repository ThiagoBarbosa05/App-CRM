# Auditoria do Chat de Conversas WhatsApp

**Data:** 18 de agosto de 2026  
**Escopo:** fluxo de conversas durante a migração Umbler → WhatsApp: envio e recebimento de mensagens, mídias, reações, figurinhas, status, persistência e atualização da interface.

## Método e limites

Auditoria estática do código. Não foram alterados arquivos, executados envios reais para a Meta ou analisados logs de produção. Os achados classificados como confirmados decorrem diretamente da lógica implementada; riscos operacionais precisam de validação em ambiente integrado.

## Fluxo auditado

`Interface → API de conversas → serviço de conversas → Cloud API/Evolution → banco/R2 → SSE/polling → interface`

O módulo cobre texto, imagem, vídeo, documento, áudio, figurinha, reação, resposta, encaminhamento e status de entrega. Há, porém, falhas de confiabilidade e inconsistências entre as camadas.

## Achados críticos

### 1. Webhook confirma recebimento antes de persistir os eventos

O endpoint devolve `200` imediatamente e processa cada status/mensagem em background, sem aguardar a persistência. Caso o processo caia, o banco/R2 falhe ou o processamento dê erro após a resposta, a Meta considera o evento entregue e a mensagem pode ser perdida. Não há fila durável ou mecanismo de reprocessamento.

**Evidência:** `server/routes/whatsapp-webhook.routes.ts`, rota `POST /webhook`.

### 2. Webhook não valida a assinatura da Meta

O endpoint aceita eventos sem validar `X-Hub-Signature-256`. O `rawBody` já é capturado pelo Express, mas não é utilizado. Uma chamada forjada pode inserir mensagens, reações e status no CRM.

**Evidência:** `server/index.ts`, configuração de `express.json`; `server/routes/whatsapp-webhook.routes.ts`.

### 3. Status de entrega/leitura pode regredir para “sent”

O envio insere a mensagem como `failed` e, depois do retorno da API, atualiza para `sent`. Se o webhook `delivered` ou `read` chegar entre essas etapas, o update final pode sobrescrever o estado mais avançado, pois só protege contra `statusReason`.

**Impacto:** ticks de entrega/leitura incorretos e histórico de status inconsistente.

**Evidência:** `server/services/whatsapp-conversations.service.ts`, `sendConversationMessage`; `server/routes/whatsapp-webhook.routes.ts`, `handleMessageStatus`.

### 4. SSE por conversa não é propagado entre réplicas

O hub propaga eventos SSE globais via Postgres, mas `publishConversationEvent` entrega somente a clientes da mesma instância. Em um deploy escalado, uma mensagem processada em outra réplica não atualiza o chat aberto em tempo real; a recuperação depende do polling de 15 segundos.

**Evidência:** `server/lib/sse-hub.ts`, `publishConversationEvent`; `client/src/pages/whatsapp/conversations.tsx`, polling periódico.

## Achados altos

### 5. Arquivamento de mídia recebida usa credencial global, não a do canal

Ao persistir mídia recebida no R2, `persistInboundMedia` baixa da Meta sem selecionar as credenciais do canal que recebeu o evento. Em canais Cloud API não padrão, o cache inicial pode falhar. O endpoint de leitura trata a credencial por canal, mas apenas como recuperação posterior.

**Impacto:** imagens, áudios, vídeos e documentos podem ficar indisponíveis após a expiração do handle temporário da Meta.

**Evidência:** `server/services/whatsapp-conversations.service.ts`, `persistInboundMedia`; `server/routes/whatsapp-conversations.routes.ts`, rota de mídia.

### 6. Processamento paralelo pode inverter mensagens e respostas de bot

Mensagens de um mesmo lote de webhook são disparadas concorrentemente. A deduplicação evita cópias duplicadas, mas não garante ordenação. Duas mensagens consecutivas podem persistir ou avançar uma sessão de bot fora de ordem.

**Evidência:** `server/routes/whatsapp-webhook.routes.ts`, processamento de `value.messages`.

### 7. Reenvio de figurinha falhada não funciona

O retry considera imagem, documento, vídeo e áudio como mídia, mas não inclui `sticker`. A figurinha falhada cai no fluxo de texto, cujo conteúdo é nulo, e não pode ser reenviada.

**Evidência:** `server/services/whatsapp-conversations.service.ts`, `retryFailedMessage`.

### 8. Arquivo XLS é aceito pela rota e rejeitado pelo serviço

A rota de upload permite `application/vnd.ms-excel`, mas o mapa de tipos do serviço não possui esse MIME. O usuário consegue selecionar o XLS e recebe falha no envio.

**Evidência:** `server/routes/whatsapp-conversations.routes.ts`, `ALLOWED_MIMETYPES`; `server/services/whatsapp-conversations.service.ts`, `ALLOWED_MEDIA_TYPES`.

## Achados médios

### 9. WEBP anexado como imagem é enviado como figurinha

A interface classifica qualquer `image/*` como imagem, enquanto o serviço classifica `image/webp` como `sticker`. Um WEBP enviado pelo clipe pode se tornar figurinha, perder legenda e divergir da prévia mostrada ao usuário.

**Evidência:** `client/src/pages/whatsapp/conversations.tsx`, `attachFile`; `server/services/whatsapp-conversations.service.ts`, `ALLOWED_MEDIA_TYPES`.

### 10. Capacidades do chat são declaradas como universais

O endpoint retorna `reply`, `reaction`, `sticker` e `forward` como disponíveis sempre que existe canal resolvido. Não valida recursos efetivos do provedor nem compatibilidade do arquivo antes do envio.

**Evidência:** `server/services/whatsapp-conversations.service.ts`, `getConversationCapabilities`.

### 11. Áudio gravado não possui recuperação adequada em caso de falha

Ao enviar áudio, a interface inicia o upload, limpa o estado e revoga a URL local imediatamente. Caso o upload falhe, há uma notificação, porém o arquivo gravado não permanece como mensagem falhada nem fica disponível para reenvio.

**Evidência:** `client/src/pages/whatsapp/conversations.tsx`, ação de envio de `pendingAudio`.

### 12. Uploads são limitados a 16 MB e mantidos integralmente em memória

`multer.memoryStorage()` mantém os arquivos na RAM e aplica o mesmo limite para todos os formatos. Em envios simultâneos, documentos e vídeos podem pressionar a memória do processo e aumentar falhas.

**Evidência:** `server/routes/whatsapp-conversations.routes.ts`, configuração de `multer`.

### 13. Conteúdo de conversas e dados pessoais são gravados em logs

O código registra texto recebido com telefone, conteúdo reenviado, destino e payloads de template. Isso amplia a exposição de dados pessoais em logs operacionais.

**Evidência:** `server/routes/whatsapp-webhook.routes.ts`; `server/services/whatsapp-conversations.service.ts`; `server/integrations/whatsapp.ts`.

## Prioridade recomendada

1. Tornar a recepção do webhook autenticada e durável.
2. Corrigir a máquina de estados de envio/entrega/leitura.
3. Propagar SSE de conversas entre réplicas.
4. Corrigir persistência e reenvio de mídia, incluindo figurinhas.
5. Unificar validação de MIME/tamanho/capacidade entre interface e servidor.
6. Executar matriz integrada por provedor e recurso: texto, imagem, vídeo, documento, áudio, figurinha, reação, resposta, encaminhamento, falha e reenvio.
