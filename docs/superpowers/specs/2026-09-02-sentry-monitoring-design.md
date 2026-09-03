# Monitoramento do CRM com Sentry

## Objetivo

Adicionar observabilidade ao frontend React e ao backend Express do CRM, cobrindo erros não tratados, desempenho de requisições e profiling do processo Node. A integração deve permanecer desativada quando o DSN correspondente não estiver configurado e não deve enviar dados pessoais, cookies nem corpos HTTP.

## Arquitetura

O backend inicializará o SDK do Sentry antes de importar o restante da aplicação. Um módulo de instrumentação ESM concentrará a configuração e usará variáveis de ambiente para DSN, ambiente, release e taxas de amostragem. O Express instalará o error handler oficial do Sentry depois das rotas e antes do handler de resposta da aplicação. O encerramento gracioso aguardará brevemente o envio dos eventos pendentes.

O frontend inicializará `@sentry/react` antes de montar a árvore React. O SDK capturará erros globais e transações de navegação. O `AppErrorBoundary` existente continuará responsável pela interface de recuperação e enviará ao Sentry a exceção junto do component stack.

O build Vite usará `@sentry/vite-plugin` somente quando as credenciais de upload estiverem disponíveis. O plugin associará os sourcemaps a uma release e removerá esses mapas dos artefatos públicos após o upload. O runtime não receberá o token de autenticação do Sentry.

## Configuração

O backend usará `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `SENTRY_RELEASE`, `SENTRY_TRACES_SAMPLE_RATE` e `SENTRY_PROFILES_SAMPLE_RATE`. O frontend usará `VITE_SENTRY_DSN`, `VITE_SENTRY_ENVIRONMENT`, `VITE_SENTRY_RELEASE` e `VITE_SENTRY_TRACES_SAMPLE_RATE`. O upload de sourcemaps usará `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` e `SENTRY_PROJECT` exclusivamente durante o build.

Taxas inválidas serão normalizadas para valores seguros entre zero e um. Sem DSN, a aplicação funcionará normalmente e não enviará telemetria. Os valores sugeridos para produção serão conservadores e poderão ser ajustados sem nova compilação do backend.

## Privacidade e filtragem

A configuração não enviará informações pessoais padrão, cookies ou corpos HTTP. Um filtro de eventos removerá cabeçalhos sensíveis, incluindo autorização e cookies, além de parâmetros de URL potencialmente sigilosos. Erros operacionais esperados com status inferior a 500 não serão enviados pelo middleware global. Quando houver usuário autenticado, somente o identificador interno e o papel poderão ser associados ao escopo do evento.

Session Replay não faz parte deste escopo, pois as telas do CRM podem exibir dados pessoais e comerciais. Logs existentes não serão encaminhados automaticamente ao Sentry.

## Tratamento de erros e ciclo de vida

Erros 5xx que chegam ao middleware global do Express serão registrados no Sentry e continuarão retornando a mensagem genérica atual. Respostas já iniciadas continuarão sendo delegadas ao handler padrão do Express. Exceções do React manterão a tela atual de recuperação e serão reportadas uma única vez pelo boundary.

No encerramento por `SIGTERM` ou `SIGINT`, o servidor deixará de aceitar conexões, aguardará o fechamento e tentará descarregar os eventos do Sentry com timeout limitado antes de finalizar. Falhas no envio da telemetria nunca impedirão o encerramento.

## Testes e verificação

Testes unitários serão escritos antes da implementação para validar parsing das taxas de amostragem, ativação condicionada ao DSN e filtragem/sanitização de eventos. Os testes observarão comportamento público das funções de configuração sem realizar chamadas à rede.

Depois da implementação serão executados os testes unitários relevantes, `npm run check` e `npm run build`. Um endpoint de teste não será exposto em produção; a validação manual poderá ser feita temporariamente por meio de uma exceção local controlada ou pelo método recomendado no painel do Sentry.

## Fora de escopo

Não serão adicionados Session Replay, captura automática de logs, alertas no painel do Sentry, monitoramento sintético, cron monitors nem mudanças nos handlers individuais das rotas. Esses recursos poderão ser adicionados depois com base nos dados observados.
