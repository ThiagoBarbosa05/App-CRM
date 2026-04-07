# Bling Create Contact Design

## Goal

Adicionar ao modulo `server/integrations/bling.ts` uma funcao para criar contatos no Bling via `POST /contatos`, com tipagem explicita, normalizacao de payload e tratamento de erros alinhado ao padrao existente da integracao.

## Context

O arquivo `server/integrations/bling.ts` ja centraliza chamadas autenticadas para a API do Bling, incluindo retry para `429` e renovacao opcional de token em `401/403` nas funcoes exportadas. A nova funcionalidade deve seguir o mesmo estilo e evitar acoplamento com regras de negocio da aplicacao.

## Scope

- Criar tipos para o payload aceito pelo endpoint `/contatos`.
- Implementar normalizacao do payload antes do envio.
- Implementar funcao exportada para criar contato no Bling.
- Retornar o `id` gerado pelo Bling.
- Propagar erros de validacao com detalhes suficientes para diagnostico.

## Non-Goals

- Criar rota HTTP interna para expor essa funcionalidade.
- Mapear entidades internas do CRM para o schema do Bling.
- Adicionar persistencia local do contato criado.

## API Design

Assinatura proposta:

`createBlingContato(accessToken: string, payload: CreateBlingContatoPayload, onTokenRefresh?: () => Promise<string>): Promise<{ id: number }>`

Comportamento:

- aceita um payload generico no formato do Bling
- normaliza strings e estruturas opcionais
- garante os obrigatorios `nome`, `situacao` e `tipo`
- aplica `situacao: "A"` por padrao quando ausente
- aceita apenas `tipo` `J`, `F` ou `E`
- envia `POST /contatos`
- em sucesso retorna `{ id }`

## Normalization Rules

- remover espacos excedentes em strings com `trim()`
- converter strings vazias para ausencia no payload final
- manter numeros e objetos identificadores sem alteracao semantica
- remover objetos aninhados vazios para evitar envio de estruturas sem dados
- preservar apenas valores definidos ao montar o corpo final

## Error Handling

- `401` e `403`: se `onTokenRefresh` existir, renovar token e repetir uma unica vez
- `400`: ler o corpo JSON do Bling e incluir a resposta no erro lancado
- demais erros nao exitosos: manter padrao textual existente no modulo

## Verification

- adicionar um teste focado na normalizacao e no fluxo de criacao do contato
- executar validacao de tipos com `npm run check`
