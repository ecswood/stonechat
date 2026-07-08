# Painel de Atendimento IA/Aguardando/Atendendo + roteamento financeiro — Design

## Contexto

Um atendimento real (ticket #26, contato "Clau Marins") revelou dois problemas
ao mesmo tempo:

1. **Bug de visibilidade:** o cliente informou um CPF que não era dele
   (68197756953, cadastrado em outro contato). A IA corretamente recusou
   emitir o boleto (`phoneOwnershipMatches` não bateu) e transferiu o ticket
   para a fila "Atendimento". O ticket nunca mais apareceu na tela de
   atendimentos — nem pro Admin. Causa raiz confirmada via inspeção do banco
   (`UserQueues` estava vazia): a tela de atendimentos e o Kanban de tags
   filtram por `queueId IN (filas do usuário logado)`; como nenhum usuário
   tinha fila atribuída, todo ticket que cai numa fila fica invisível pra
   todo mundo. O formulário de cadastro de usuário (`UserModal`) já tem o
   campo de fila (`QueueSelect`) — nunca foi usado.
2. **Falta de monitoramento e de tratamento de duplicidade de CPF:** não
   existe lugar nenhum pra ver o que a IA está respondendo antes de um humano
   assumir, e quando um contato diferente informa o CPF de outro cliente já
   cadastrado, não há nenhum vínculo visível entre os dois registros.

Esse design cobre a correção do bug e três melhorias relacionadas, todas
descobertas ao investigar o mesmo incidente.

## Fora de escopo

- Migração de dados/schema — nenhuma das quatro partes abaixo precisa de
  migration nova.
- Mexer nas abas "Fechados" e "Busca" da tela de atendimentos — só a antiga
  aba "Abertos" é substituída pelo novo quadro.
- Drag-and-drop entre colunas — a transição de estado é sempre via ação
  (o cliente pedir humano, ou o atendente clicar "Puxar atendimento"), nunca
  arrastando o card manualmente.
- Regras de eligibilidade de liberação de confiança (já é responsabilidade do
  SGP, como definido no design anterior
  `2026-07-07-agente-ia-atendimento-sgp-design.md`).
- Correção operacional de atribuir fila/setor às contas existentes (Admin,
  edison) — é uma ação de configuração feita direto na tela de Usuários, feita
  fora deste ciclo de implementação de código.

## Parte 1 — Quadro de atendimento em 3 colunas (IA / Aguardando / Atendendo)

Substitui a antiga aba "Abertos" (com sub-abas "Atribuídos a mim"/"Aguardando")
dentro de `TicketsManagerTabs`. Reaproveita a biblioteca `react-trello` já
usada no Kanban de tags existente (`pages/Kanban/index.js`) — mesmo visual,
sem dependência nova.

### Regras das colunas

Sem campo de estágio novo no `Ticket` — cada coluna é definida por combinações
de campos que já existem hoje:

| Coluna | Critério | Visibilidade |
|---|---|---|
| **IA** | `status = "pending"` AND `queueId IS NULL` AND `userId IS NULL` | Todos os operadores, independente de setor |
| **AGUARDANDO** | `status = "pending"` AND `queueId IS NOT NULL` AND `userId IS NULL` | Só tickets cujo `queueId` está entre os setores do operador logado (tabela `UserQueues`). Perfil `admin` vê todos os setores automaticamente |
| **ATENDENDO** | `status = "open"` AND `userId IS NOT NULL` | Global — todos os agentes veem os atendimentos de todo mundo, sem filtro de setor |

Transições continuam acontecendo pelos fluxos que já existem, sem mudança:
- Ticket nasce em **IA** (criado com `status: "pending"`, sem fila, sem
  usuário).
- Quando o cliente pede humano, ou a IA transfere por segurança/erro/
  bloqueio financeiro, `transferToQueueByName` seta `queueId` → o ticket salta
  pra **AGUARDANDO** automaticamente.
- Um operador clica **"Puxar atendimento"** no card de AGUARDANDO → mesma
  ação que o botão "Aceitar" já existente hoje (`status: "open"`,
  `userId: <operador>`) → salta pra **ATENDENDO**.
- Fechar o ticket (fluxo já existente) tira o card do quadro.

O tag "Atendimento IA" (já criado automaticamente por `registerAiAttendance`)
aparece como selo no card em qualquer coluna, só como indicação visual/
histórica — não decide em qual coluna o card fica.

### Cadastro de operadores por setor

O campo já existe no `UserModal` (`QueueSelect`) e já persiste em `UserQueues`
— nenhuma mudança de código aqui. Um operador pode ser cadastrado em mais de
um setor (Técnico + Comercial, por exemplo). Perfil `admin` sempre vê todos os
setores em AGUARDANDO, mesmo sem estar cadastrado em nenhum.

### Endpoint

Novo parâmetro `pipeline=true` em `GET /ticket/kanban` (reaproveitando
`ListTicketsServiceKanban`), devolvendo as 3 listas de uma vez:

```
{
  ia: Ticket[],         // sem filtro de setor
  aguardando: Ticket[], // filtrado por setores do usuário, exceto admin
  atendendo: Ticket[]   // sem filtro de setor (global)
}
```

Cada ticket inclui `contact`, última mensagem, `queue` (nome/cor do setor),
`tags` (selo "Atendimento IA") e `user` (quem está atendendo).

### Cards

- **IA:** contato, última mensagem, selo "Atendimento IA". Clique abre a
  conversa em modo leitura (acompanhar em tempo real o que o bot está
  dizendo, sem poder responder).
- **AGUARDANDO:** contato, última mensagem, etiqueta colorida do setor,
  botão **"Puxar atendimento"**.
- **ATENDENDO:** contato, última mensagem, nome de quem está atendendo.
  Clique abre a conversa normal (responder como já funciona hoje).

### Tempo real

Escuta o evento de socket `ticket:update` que já existe hoje; ao chegar um
evento, recalcula em qual das 3 listas o ticket cai e move o card, sem
precisar de refresh nem canal de socket novo.

### Corrida em "Puxar atendimento"

Dois operadores podem clicar quase ao mesmo tempo no mesmo card. A ação de
puxar passa a fazer um `UPDATE ... WHERE id = :ticketId AND userId IS NULL`
(guarda otimista) — só o primeiro clique realmente assume o ticket; o
segundo recebe aviso "esse atendimento já foi puxado" e o card some da lista
dele. Isso importa mais agora porque o pool de AGUARDANDO passa a ser
compartilhado entre todos os operadores do mesmo setor, não é mais uma fila
= um agente só.

## Parte 2 — Roteamento por setor da IA (Financeiro/Comercial) + bloqueio técnico

### Novos gatilhos no prompt (paridade com Técnico/Atendimento já existentes)

```
Quando o cliente pedir negociação de dívida, 2ª via de fatura antiga, ou
quiser falar sobre pagamento em atraso, termine sua resposta com a frase
exata 'Ação: Transferir para Financeiro'.
Quando o cliente perguntar sobre planos novos, upgrade, contratação de
serviço adicional ou mudança de plano, termine sua resposta com a frase
exata 'Ação: Transferir para Comercial'.
```

Novos marcadores em `AiAgentActions.ts` (`ACTION_MARKERS`):
`transferirFinanceiro` → `"Ação: Transferir para Financeiro"`,
`transferirComercial` → `"Ação: Transferir para Comercial"`. Em
`dispatchAiAction`, dois blocos novos idênticos ao padrão de Técnico/
Atendimento, cada um chamando `transferToQueueByName("Financeiro", ...)` /
`transferToQueueByName("Comercial", ...)`.

### Verificação de bloqueio financeiro antes de transferir pro Técnico

Testado ao vivo (consulta real, só leitura) contra a API do SGP com um
contrato genuinamente suspenso por débito (CPF 069.706.349-65). Formato
real confirmado da resposta:

```json
{
  "contratoStatus": 4,
  "contratoStatusDisplay": "Suspenso",
  "motivo_status": "Financeiro",
  "contratoValorAberto": 201.48,
  "contratoTitulosAReceber": 12
}
```

`motivo_status === "Financeiro"` é o critério — `contratoStatusDisplay`
sozinho ("Suspenso") não diferencia a causa da suspensão. `SgpCliente`
(interface em `SgpService.ts`) ganha dois campos novos mapeados dessa
resposta: `motivoStatus` (de `motivo_status`) e `valorEmAberto` (de
`contratoValorAberto`).

Novo `handleTransferirTecnicoAction` em `AiAgentActions.ts`, mesmo padrão de
`handleBuscarBoletoAction`:

1. Exige CPF conhecido antes de emitir o gatilho `Ação: Transferir para
   Técnico` (o prompt passa a instruir a IA a pedir o CPF antes, se ainda
   não souber — muda o comportamento atual, que transferia pro Técnico sem
   pedir CPF).
2. Chama `SgpService.consultarCliente(cpfCnpj)`.
3. **Sem checagem de telefone** (decisão do Edison: diferente de Boleto e
   Liberação de Confiança, aqui confia-se no CPF informado mesmo que o
   telefone não bata com o cadastro do SGP): se `motivoStatus === "Financeiro"`,
   avisa o cliente citando `valorEmAberto` e transfere direto pra fila
   **Financeiro**, pulando a fila Técnico inteiramente.
4. Se não houver bloqueio financeiro (motivo diferente, ou cliente não
   encontrado, ou erro/timeout do SGP — `consultarCliente` já retorna `null`
   nesses casos), segue o fluxo normal: transfere pra **Técnico**. O SGP
   fora do ar nunca bloqueia o atendimento técnico.

Mensagem de aviso (texto final a ajustar com o Edison antes de ir a
produção): *"Antes de te passar pro time técnico, notei que sua conexão está
suspensa por pendência financeira (R$ 201,48 em aberto). Vou te encaminhar
direto pro setor Financeiro pra resolver isso primeiro."*

### Liberação de confiança — sem mudança

Confirmado que o comportamento atual já está correto e não muda: em caso de
sucesso, `handleLiberarConfiancaAction` fecha o ticket direto (`status:
"closed"`), sem transferir para nenhuma fila — nunca passa por AGUARDANDO.
Só os casos de falha (já utilizado → Financeiro, erro genérico →
Atendimento) já usam `transferToQueueByName`, e caem em AGUARDANDO
normalmente pela Parte 1.

## Parte 3 — Agregação de contatos pelo mesmo CPF

Sem tabela nova: `cpfCnpj` já existe e é comparável entre `Contact`s. Ao
abrir um ticket, o backend busca:

```ts
Contact.findAll({
  where: { cpfCnpj: contact.cpfCnpj, companyId, id: { [Op.ne]: contact.id } }
})
```

Se achar outro(s) contato(s) com o mesmo CPF, o front mostra um banner no
topo da conversa: *"Este CPF também está associado a: [nome/telefone do
outro contato]"*, com link que abre a busca já filtrada pelo histórico
daquele outro contato (reaproveita a busca por número/CPF que a tela de
tickets já tem hoje). Só visível internamente pro atendente — nunca exposto
ao cliente no WhatsApp.

## Tratamento de erros (resumo)

- SGP indisponível/timeout em qualquer checagem (boleto, confiança, bloqueio
  técnico): trata como "não encontrado", nunca deixa o cliente sem resposta
  nem trava a transferência pro setor padrão.
- Corrida em "Puxar atendimento": guarda otimista (`WHERE userId IS NULL`)
  evita dois agentes assumirem o mesmo ticket.
- CPF já preenchido no contato nunca é sobrescrito (comportamento atual,
  mantido).

## Testes

- Unitários (Jest, padrão de `AiAgentActions.spec.ts`/`SgpService.spec.ts`):
  - `handleTransferirTecnicoAction`: bloqueio financeiro → Financeiro; sem
    bloqueio → Técnico; SGP indisponível/CPF não encontrado → cai pra
    Técnico mesmo assim.
  - Query dos 3 baldes do pipeline (IA/Aguardando/Atendendo), incluindo
    filtro por setor pra operador comum vs. bypass do admin.
  - Guarda otimista do "Puxar atendimento" (segunda tentativa não rouba o
    ticket já assumido).
  - Busca de contatos com mesmo `cpfCnpj` (exclui o próprio, escopado por
    `companyId`).
- Manual via Playwright (prática já usada no projeto): abrir o quadro,
  confirmar as 3 colunas, puxar um atendimento e ver mudar de coluna em
  tempo real; testar com um usuário de setor único vendo só o que é dele em
  AGUARDANDO; confirmar o banner de agregação de CPF.

## Riscos / itens a verificar durante a implementação

1. Texto exato da mensagem de aviso de bloqueio financeiro — validar com o
   Edison antes de ir pra produção.
2. Confirmar que as filas **Financeiro** e **Comercial** já existem
   cadastradas na empresa (já existem, conforme levantado: ids 3 e 4).
3. Depois de implementado, o Edison precisa entrar em Configurações →
   Usuários e marcar o setor de cada operador existente — sem isso a coluna
   AGUARDANDO fica vazia pra quem não for admin (mesma causa raiz do bug
   original).
