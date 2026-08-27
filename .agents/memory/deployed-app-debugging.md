---
name: Deployed app debugging
description: Heuristic for when a user says a confirmed fix "still doesn't work" in this project.
---

Este projeto (VinoCRM) tem um deploy autoscale ativo e público (crmgrandcru.replit.app).

Quando o usuário reportar que uma mudança já confirmada via HMR/dev "ainda não aparece" ou "não funcionou" depois de uma correção que você validou no ambiente de desenvolvimento, chame `getDeploymentInfo()` cedo no fluxo de depuração, antes de assumir um bug no código. Se `isDeployed` for true, é provável que o usuário esteja testando na URL de produção, que só reflete o código publicado — não o preview de dev.

**Por quê:** perdi um ciclo de depuração inteiro (investigando rotas, wouter, event bubbling) antes de checar se havia um deploy de produção defasado, que era a causa real.

**Como aplicar:** ao investigar um "não funcionou" após um fix já visto funcionando no HMR, confirme o status de deploy primeiro; se publicado, oriente o usuário a republicar antes de aprofundar a depuração de código.
