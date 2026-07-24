## Realize uma análise completa do fluxo de conversas do whatsapp presente no app, tanto as mensagens inbound quanto as outbound, preciso que encontre erros de lógica, bugs e etc.

- considere o que deve acontecer nas conversas do whatsapp

1. Deve ser possivel enviar e receber mensagens, tanto com os clientes quanto com os canais conectados, todas as conversas devem aparecer na aba de conversas.
2. O atendente/vendedor deve visualizar apenas as conversas dos setores e canais ao qual ele possui acesso, com a exceção de quando ele receber a mensagem de um canal, por exemplo, o atendente televendas que temo o setor eventos e o canal eventos inicia a conversa com a atendente Daiane que tem o setor Búzios e o canal Búzios, a Daiane deve conseguir visualizar a conversa e conversar com o televendas
3. Não pode haver conversas duplicadas somente se a conversa já existir no setor e no canal e pertencer ao mesmo cliente
4. Atualmente quando um contato que não está registrado no app envia uma mensagem para um atendente ele acaba recebendo um nome que não é dele, ele recebe um nome com uma mistura do canal e nome do atendente, preciso que corrija esse erro, se o baileys não conseguir encontrar o nome do contato, apenas salve o numero do contato, sem inventar nomes.

Por fim, esse fluxo de conversas deve acontecer parecido com o fluxo que existe na plataforma Umbler Talk, pois estamos migrando do umbler para utilizar a nossa própria solução e preciso que funcione corretamente, os dados das mensagens e conversas que existem hoje são apenas de testes.
