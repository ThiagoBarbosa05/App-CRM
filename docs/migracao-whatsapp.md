## Verificação das funcionalidades do app do módulo de whatsapp

* Preciso que verifique os seguntes requisitos para o funcionamento completo do whatsapp no app CRM

- Analise o fluxo de conexão do baileys com os canais via qr code do app, atualmente estamos enfrentando problemas de desconexão das instancias, lembrando que o app esta hospedado em um autoscale do replit, se necessário analise a documentação para realizar essa verificação, precisamos otmizar essas conexões via qr code para evitar do atendente ter que conectar o whatsapp sempre
- Deve ser possível o usuario admin ter acesso a todas as conversas, inclusive as conversas que são entre os canais, ele precisa ter acesso as duas visões, tanto a dele quanto a de outro canal, por exemplo: ele inicia uma conversa com outro canal que responde ele, o admin deve ter acesso as duas conversas, e tambem deve ser possível enviar mensagem pelas duas conversas, se passando pelo atendente ou enviando pelo canal dele mesmo
- Quando o usuario admin encerra uma conversa com outro canal, acaba encerrando as duas, esse comportamento esta errado, deve encerrar somene a dele, a do outro canal deve continuar aberta.





# Auditoria e correção do módulo WhatsApp

## Resultado das verificações

- **Sessões Baileys: parcialmente adequadas.** As credenciais são persistidas no PostgreSQL e reidratadas no início do servidor ([db-auth-state.ts](C:/Users/estoq/dev/App-CRM/server/services/baileys/db-auth-state.ts:75), [session-manager.ts](C:/Users/estoq/dev/App-CRM/server/services/baileys/session-manager.ts:527)). Há reconexão automática, backoff, tratamento de logout/conflito e locks entre réplicas.
- **Hospedagem incompatível com a exigência de conexão contínua.** O Replit Autoscale reduz a aplicação a zero após inatividade; a documentação de cobrança informa inatividade após aproximadamente 15 minutos. Isso encerra o processo que mantém o WebSocket do Baileys. Para evitar reconexões recorrentes, migrar o CRM para Reserved VM ou extrair o Baileys para um worker sempre ativo. O padrão adotado será **Reserved VM**, por exigir menos alterações. [Replit Autoscale](https://docs.replit.com/pt/cloud-services/deployments/autoscale-deployments), [Replit deployment pricing](https://docs.replit.com/billing/deployment-pricing).
- **Há risco de perda de estado durante shutdown.** As chaves Signal são gravadas em fila assíncrona, mas o encerramento não espera essa fila terminar. Além disso, apagar credenciais não cancela escritas antigas já enfileiradas ([db-auth-state.ts](C:/Users/estoq/dev/App-CRM/server/services/baileys/db-auth-state.ts:111)).
- **Admin com duas visões: implementado no código.** Conversas canal↔canal são desdobradas em duas entradas para admin/gerente ([whatsapp-conversations.service.ts](C:/Users/estoq/dev/App-CRM/server/services/whatsapp-conversations.service.ts:1417)). Leitura e envio recebem a perspectiva/canal selecionado, permitindo enviar por qualquer lado ([whatsapp-conversations.service.ts](C:/Users/estoq/dev/App-CRM/server/services/whatsapp-conversations.service.ts:1504), [whatsapp-conversations.service.ts](C:/Users/estoq/dev/App-CRM/server/services/whatsapp-conversations.service.ts:1675)).
- **Encerramento independente: não implementado.** Existe apenas um `status` na conversa compartilhada. O endpoint não recebe o lado selecionado e atualiza a linha inteira, fechando as duas visões ([whatsapp-conversations.service.ts](C:/Users/estoq/dev/App-CRM/server/services/whatsapp-conversations.service.ts:791), [whatsapp-conversations.routes.ts](C:/Users/estoq/dev/App-CRM/server/routes/whatsapp-conversations.routes.ts:948), [conversations.tsx](C:/Users/estoq/dev/App-CRM/client/src/pages/whatsapp/conversations.tsx:3088)).
- **Banco de desenvolvimento incompleto.** As tabelas-base existem, mas `peer_channel_id`, `perspective_channel_id` e seus índices não estão aplicados. O banco auditado também não contém canais ou credenciais Baileys, portanto não valida o comportamento real da produção.

## Alterações necessárias

- Migrar a publicação do CRM de Autoscale para Reserved VM.
- Tornar a persistência Baileys durável:
  - aguardar todas as filas de autenticação antes de encerrar;
  - impedir que escritas antigas recriem credenciais após logout/repareamento;
  - liberar locks se a criação do socket falhar;
  - adicionar heartbeat real do socket, pois possuir um advisory lock não prova que a conexão WhatsApp está saudável;
  - revisar o limite de 20 locks simultâneos conforme a quantidade máxima de canais.
- Aplicar, em ordem, as migrações canônicas de conversas e de perspectivas de leitura, primeiro em homologação e depois em produção.
- Criar estado por lado para diálogos internos, com chave única `(conversationId, channelId)`, contendo status, data e usuário do encerramento.
- Atualizar listagem, filtros, fechamento e reabertura:
  - conversa externa continua usando o status existente;
  - conversa interna consulta o status do lado exibido;
  - admin/gerente envia `asChannelId`;
  - vendedor tem o lado derivado de seus canais;
  - fechar um lado não altera o outro;
  - envio por um lado fechado reabre somente esse lado;
  - nova mensagem reabre somente o lado destinatário;
  - encerramento interno não finaliza sessão de bot do outro canal.

## Validação

- Manter os 40 testes direcionados que já passaram.
- Adicionar testes de serviço e rota cobrindo:
  - admin vê duas entradas da mesma conversa;
  - histórico e direções são corretos nas duas perspectivas;
  - envio sai pelo número correspondente a cada perspectiva;
  - fechamento/reabertura afeta apenas o lado escolhido;
  - leitura, badge e filtros permanecem independentes;
  - reconexão após restart reutiliza credenciais sem novo QR;
  - shutdown espera a persistência das chaves;
  - duas réplicas nunca mantêm simultaneamente o mesmo canal.
- Executar um teste real em homologação com dois canais WhatsApp e reinício controlado do servidor.
- Corrigir ou isolar a dívida de tipagem existente: atualmente `npm run check` falha com numerosos erros globais anteriores, portanto ainda não serve como critério de aprovação.

## Premissas

- O banco consultado é de desenvolvimento, conforme confirmado.
- Reserved VM é o padrão recomendado; manter Autoscale exigiria separar o Baileys em um serviço sempre ativo.
- Baileys permanece fixado na linha 7.x. A documentação oficial recomenda persistir as credenciais, salvar `creds.update` e reconectar quando o motivo não for logout, condutas já presentes no projeto mas que precisam do endurecimento descrito. [Exemplo oficial do Baileys](https://github.com/WhiskeySockets/Baileys/blob/master/Example/example.ts), [repositório oficial](https://github.com/WhiskeySockets/Baileys).
