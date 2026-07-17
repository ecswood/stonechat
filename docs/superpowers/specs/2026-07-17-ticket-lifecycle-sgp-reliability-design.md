# Ticket Novo Após Fechamento + Confiabilidade do SGP — Design

> **Para quem for implementar:** use a skill `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans` pra executar o plano tarefa por tarefa.

**Objetivo:** parar de reaproveitar tickets fechados indefinidamente (cada novo contato após um fechamento vira atendimento novo, do zero) e tornar a integração com o SGP resiliente a falhas transitórias, com aviso automático quando o SGP cair de vez.

**Arquitetura:** duas mudanças independentes no backend do StoneChat — (1) ajuste nas buscas de `FindOrCreateTicketService` pra excluir tickets `closed`; (2) timeout + retry + contador de falhas consecutivas em `SgpService`, com alerta via WhatsApp quando o contador bater 3.

**Stack:** Node.js/TypeScript, Sequelize, Jest, Baileys (`@whiskeysockets/baileys`), axios.

## Global Constraints

- Fechamento de ticket = qualquer transição pra `status: "closed"`, seja por confirmação do cliente (`Ação: Encerrar Atendimento`) ou pelo timeout automático de 10 minutos (`AutoCloseAfterWaitQueue`, já implementado) — as duas contam igual pra essa regra.
- Reabertura MANUAL de ticket pelo painel (atendente humano, via `UpdateTicketService`) não é afetada por nenhuma mudança deste spec.
- Timeout de chamada ao SGP: **8 segundos**.
- Retry automático: **1 tentativa extra** (total 2 tentativas) antes de propagar falha ao chamador.
- Alerta de indisponibilidade do SGP: dispara ao acumular **3 falhas consecutivas** (contando as 3 funções e todos os clientes juntos, não separado por CPF). Qualquer sucesso zera o contador.
- Destino do alerta: grupo de WhatsApp **NOC Avisos SNI**. Pré-requisito operacional (fora do código): o número do StoneChat precisa ser adicionado a esse grupo manualmente — se ainda não estiver, o envio falha silenciosamente (só loga o erro), sem travar nada.
- Cache de resultado do SGP: **fora de escopo** — decisão do Edison (não é problema real de cliente, evitar over-engineering).

---

## Feature 1: Ticket novo após fechamento

### Situação atual

`FindOrCreateTicketService.ts` tem duas buscas que podem reaproveitar um ticket fechado:

1. **Busca principal** (linha ~23-33): filtra `status: ["open", "pending", "closed"]` — inclui `closed` de propósito (hoje), fazendo qualquer ticket antigo do contato voltar à vida, não importa há quanto tempo foi fechado.
2. **Busca de repescagem pra contato não-grupo** (linha ~73-101): roda só quando a busca principal não encontra nada; procura qualquer ticket do contato atualizado nas últimas 2 horas, **sem filtrar por status** — reabriria até um ticket fechado há 5 minutos.

Existe também um bloco separado só pra `groupContact` (linha ~43-71, grupos de WhatsApp) com sua própria busca sem filtro de status/tempo, incluindo uma leitura morta de `Setting` (`"timeCreateNewTicket"`, valor lido mas nunca usado) — resto de uma implementação anterior nunca terminada. Esse bloco fica **fora de escopo** deste pedido (grupos de WhatsApp não fazem parte disso) — não mexer nele, dead code incluído.

### Mudança

- Busca principal: `status: ["open", "pending"]` (remove `"closed"`).
- Busca de repescagem (não-grupo): adicionar o mesmo filtro de status (`["open", "pending"]`), garantindo que ela nunca reabra um `closed` mesmo dentro da janela de 2h.
- Nenhuma mudança no bloco de `groupContact` (linha ~43-71) — inclusive a leitura morta de `timeCreateNewTicket` fica como está, por não fazer parte deste pedido.

### Efeito

Um contato com o último ticket `closed` sempre cai no bloco `if (!ticket) { ticket = await Ticket.create(...) }` — ticket novo, id novo, protocolo novo (`buildTicketProtocol` usa `ticket.id`), `Message.findAll({where:{ticketId}})` naturalmente vazio (histórico zerado, já que é filtrado pelo novo id).

---

## Feature 2: Confiabilidade do SGP

### Situação atual

`SgpService.ts` faz `axios.post` direto nas 3 funções (`consultarCliente`, `buscarBoleto`, `liberarConfianca`), sem `timeout` configurado. Falhas já propagam corretamente pro chamador desde a correção de hoje (2026-07-17) — o que falta é retry automático e visibilidade de indisponibilidade prolongada.

### Mudança

**Timeout:** adicionar `{ timeout: 8000 }` nas 3 chamadas `axios.post`.

**Retry:** cada função tenta a chamada, e se falhar (qualquer exceção, incluindo timeout), tenta mais uma vez antes de decidir entre sucesso/falha. Só se a segunda tentativa TAMBÉM falhar é que a função loga (Sentry + logger, já implementado) e propaga/retorna erro como hoje.

**Contador de falhas consecutivas + alerta:** módulo-level, em memória, dentro de `SgpService.ts`. Incrementa a cada falha (depois de esgotar o retry), zera a cada sucesso. Ao atingir 3, chama um novo helper que manda uma mensagem pro grupo NOC Avisos SNI usando a conexão WhatsApp padrão da empresa: `GetDefaultWhatsApp(1)` (só existe a empresa `SNI Telecom`, id `1`, hoje — hardcoded, sem necessidade de parametrizar por multi-tenant que não existe na prática) retorna o `Whatsapp` marcado como padrão/conectado; `getWbot(connection.id)` (de `libs/wbot`, mesmo par já usado em `GetTicketWbot.ts`) obtém a sessão Baileys ativa pra chamar `wbot.sendMessage(GRUPO_NOC_JID, { text })`. `GRUPO_NOC_JID` fica hardcoded como constante no helper (mesmo JID usado hoje pelo NetManager: `120363410164424155@g.us`). Essa notificação:
- Não impede a função de retornar/propagar o erro normalmente pro chamador (o cliente ainda recebe a mensagem de "não consegui verificar agora").
- Se o envio do alerta em si falhar (ex: bot ainda não é membro do grupo), só loga o erro — não derruba a resposta ao cliente.
- Continua dependente do contador: se continuar falhando, não reenvia o alerta a cada falha nova (só quando o contador CRUZAR o limiar de 3 partindo de um estado zerado) — evita spam de alerta repetido enquanto o SGP continua fora do ar. Volta a poder alertar de novo assim que houver pelo menos 1 sucesso zerando o contador e depois 3 falhas se acumularem de novo.

---

## Testes

- `FindOrCreateTicketService`: casos — contato com último ticket `closed` → cria novo; contato com ticket `open`/`pending` → reaproveita; contato sem nenhum ticket → cria novo; busca de repescagem não reabre `closed` dentro de 2h.
- `SgpService`: timeout configurado nas 3 chamadas; retry dispara exatamente 1 tentativa extra após falha; sucesso na 2ª tentativa não propaga erro; contador de falhas incrementa/zera corretamente; alerta dispara só ao cruzar 3 a partir de zero (não repete em falhas subsequentes); falha ao enviar o alerta não quebra o retorno da função original.

## Fora de escopo

- Cache de resultado de consulta ao SGP.
- Qualquer mudança em reabertura manual de ticket pelo painel.
- Qualquer mudança no fluxo de tickets de grupo (`groupContact`).
