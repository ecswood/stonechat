# Painel de Atendimento (IA/Aguardando/Atendendo) + Agregação de Contatos por CPF Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir a antiga aba "Abertos" (sub-abas Atribuídos a mim/Aguardando) por um quadro de 3 colunas — IA, AGUARDANDO, ATENDENDO — refletindo em tempo real o estágio de cada atendimento, com pull explícito ("Puxar atendimento") em vez de fila fixa por agente; e mostrar, dentro de um ticket aberto, um aviso quando o CPF do contato também está associado a outro contato (número de WhatsApp diferente).

**Architecture:** Sem migration. As 3 colunas são consultas sobre os campos que o `Ticket` já tem (`status`, `queueId`, `userId`), documentado em `docs/superpowers/specs/2026-07-08-painel-atendimento-ia-design.md`. Tempo real via uma sala de socket nova (`company-<id>-pipeline`), acrescentada aos pontos de emissão já existentes. "Puxar atendimento" ganha um endpoint próprio com guarda otimista (`UPDATE ... WHERE userId IS NULL`) pra evitar dois agentes assumirem o mesmo ticket. A agregação de contatos por CPF é uma consulta simples pelo campo `cpfCnpj` que já existe em `Contact`, sem tabela nova.

**Tech Stack:** Backend: Node.js/TypeScript, Express, Sequelize (Postgres), Socket.IO, Jest. Frontend: React (CRA), Material-UI, `react-trello` (já usado no Kanban de tags existente), Socket.IO client via `SocketContext`/`ManagedSocket`.

## Escopo desta rodada de execução

Execução atual cobre só a **Parte 1** do spec (Tasks 1, 2, 3, 5, 6 — quadro de 3 colunas e "Puxar atendimento"). Tasks 4 e 7 (Parte 3 — agregação de contatos pelo mesmo CPF) ficam para um próximo ciclo, a pedido do Edison.

## Global Constraints

- Escopo desktop: o app usa `pages/TicketsCustom` (com `components/TicketsManagerTabs`, `components/TicketsListCustom`, `components/Ticket`) pra telas médias/largas, e `pages/TicketsAdvanced` pra mobile (`pages/TicketResponsiveContainer/index.js`). Este plano só mexe no caminho desktop (`TicketsCustom`/`TicketsManagerTabs`/`Ticket`) — `TicketsAdvanced` fica de fora, é uma tela mobile separada e não faz parte do pedido original.
- Nenhuma migration em nenhuma das duas partes (quadro e agregação por CPF) — só consultas novas sobre colunas que já existem.
- Toda lógica de backend nova (services) precisa de teste Jest, seguindo o padrão de mock direto dos models Sequelize já usado em `backend/src/services/WbotServices/__tests__/AiAgentActions.spec.ts` (não existe banco de teste configurado neste projeto).
- Rodar a suíte depois de cada tarefa de backend com `cd backend && npx jest --verbose` (não `npm test` — o script tem um `pretest` que roda `sequelize db:migrate` contra um MySQL real em `127.0.0.1:3306`, inexistente neste ambiente/worktree; `npx jest` chama o Jest direto, sem esse hook, e cobre exatamente os mesmos arquivos de `__tests__`). Confirmado rodando: 10/10 suítes, 56/56 testes passando. Conferir manualmente no browser (Playwright, ver `docs/superpowers/specs/2026-07-06-stonechat-setup-design.md`/memória do projeto) depois de cada tarefa de frontend.
- Emissões de socket **novas** (sala `company-<id>-pipeline`) são só um `.to(...)` a mais nas cadeias de emissão que já existem em `UpdateTicketService.ts` e `CreateMessageService.ts` — não alterar o que essas emissões já fazem hoje pra outros consumidores.
- Antes de considerar essa funcionalidade utilizável em produção, o Edison precisa cadastrar o setor de cada operador em Configurações → Usuários (o campo já existe, só nunca foi usado) — sem isso a coluna AGUARDANDO fica vazia pra qualquer operador não-admin. Isso está fora do escopo de código deste plano (é ação de configuração, não desenvolvimento).

---

## Task 1: `PullTicketService` — puxar atendimento com guarda de corrida

**Files:**
- Create: `backend/src/services/TicketServices/PullTicketService.ts`
- Test: `backend/src/services/TicketServices/__tests__/PullTicketService.spec.ts`
- Modify: `backend/src/controllers/TicketController.ts` (nova action `pull`)
- Modify: `backend/src/routes/ticketRoutes.ts` (nova rota)
- Modify: `frontend/src/translate/languages/pt.js` (novo `backendErrors.ERR_TICKET_ALREADY_TAKEN`)

**Interfaces:**
- Consumes: `ShowTicketService(id, companyId): Promise<Ticket>` (já existe); `getIO(): SocketIO` (já existe em `libs/socket.ts`); `AppError` (já existe).
- Produces: `PullTicketService({ ticketId, userId, companyId }): Promise<Ticket>`, usada pela Task 6 (botão "Puxar atendimento" no frontend) via `PUT /tickets/:ticketId/pull`.

- [ ] **Step 1: Escrever o teste que falha**

Crie `backend/src/services/TicketServices/__tests__/PullTicketService.spec.ts`:

```ts
jest.mock("../../../models/Ticket", () => ({
  __esModule: true,
  default: { update: jest.fn() }
}));
jest.mock("../ShowTicketService", () => ({
  __esModule: true,
  default: jest.fn()
}));
jest.mock("../../../libs/socket", () => ({
  __esModule: true,
  getIO: jest.fn()
}));

// eslint-disable-next-line import/first
import Ticket from "../../../models/Ticket";
// eslint-disable-next-line import/first
import ShowTicketService from "../ShowTicketService";
// eslint-disable-next-line import/first
import { getIO } from "../../../libs/socket";
// eslint-disable-next-line import/first
import AppError from "../../../errors/AppError";
// eslint-disable-next-line import/first
import PullTicketService from "../PullTicketService";

describe("PullTicketService", () => {
  const chain: any = {};

  beforeEach(() => {
    jest.clearAllMocks();
    chain.to = jest.fn(() => chain);
    chain.emit = jest.fn();
    (getIO as jest.Mock).mockReturnValue(chain);
  });

  it("assume o ticket quando ninguém pegou antes", async () => {
    (Ticket.update as jest.Mock).mockResolvedValue([1]);
    (ShowTicketService as jest.Mock).mockResolvedValue({
      id: 26,
      queueId: 1,
      companyId: 1
    });

    const result = await PullTicketService({ ticketId: 26, userId: 7, companyId: 1 });

    expect(Ticket.update).toHaveBeenCalledWith(
      { status: "open", userId: 7 },
      { where: { id: 26, companyId: 1, userId: null } }
    );
    expect(result).toEqual({ id: 26, queueId: 1, companyId: 1 });
    expect(chain.emit).toHaveBeenCalledWith("company-1-ticket", {
      action: "update",
      ticket: { id: 26, queueId: 1, companyId: 1 }
    });
  });

  it("recusa quando outro agente já puxou (nenhuma linha afetada)", async () => {
    (Ticket.update as jest.Mock).mockResolvedValue([0]);

    await expect(
      PullTicketService({ ticketId: 26, userId: 7, companyId: 1 })
    ).rejects.toEqual(new AppError("ERR_TICKET_ALREADY_TAKEN", 409));

    expect(ShowTicketService).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd backend && npx jest PullTicketService --verbose`
Expected: FAIL — `Cannot find module '../PullTicketService'` (o arquivo ainda não existe).

- [ ] **Step 3: Implementar**

Crie `backend/src/services/TicketServices/PullTicketService.ts`:

```ts
import { getIO } from "../../libs/socket";
import AppError from "../../errors/AppError";
import Ticket from "../../models/Ticket";
import ShowTicketService from "./ShowTicketService";

interface Request {
  ticketId: string | number;
  userId: number;
  companyId: number;
}

const PullTicketService = async ({
  ticketId,
  userId,
  companyId
}: Request): Promise<Ticket> => {
  const [affectedRows] = await Ticket.update(
    { status: "open", userId },
    { where: { id: ticketId, companyId, userId: null } }
  );

  if (affectedRows === 0) {
    throw new AppError("ERR_TICKET_ALREADY_TAKEN", 409);
  }

  const ticket = await ShowTicketService(ticketId, companyId);

  const io = getIO();
  io.to(`company-${companyId}-pending`)
    .to(`company-${companyId}-open`)
    .to(`queue-${ticket.queueId}-pending`)
    .to(`queue-${ticket.queueId}-open`)
    .to(`company-${companyId}-pipeline`)
    .to(ticketId.toString())
    .to(`user-${userId}`)
    .emit(`company-${companyId}-ticket`, {
      action: "update",
      ticket
    });

  return ticket;
};

export default PullTicketService;
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd backend && npx jest PullTicketService --verbose`
Expected: PASS nos dois testes.

- [ ] **Step 5: Expor via controller e rota**

Em `backend/src/controllers/TicketController.ts`, adicione (perto da action `update` existente, depois dela):

```ts
export const pull = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { ticketId } = req.params;
  const { companyId, id } = req.user;

  const ticket = await PullTicketService({
    ticketId,
    userId: Number(id),
    companyId
  });

  return res.status(200).json(ticket);
};
```

E adicione o import no topo do arquivo, junto dos outros imports de `TicketServices`:

```ts
import PullTicketService from "../services/TicketServices/PullTicketService";
```

Em `backend/src/routes/ticketRoutes.ts`, adicione a rota logo depois de `ticketRoutes.put("/tickets/:ticketId", isAuth, TicketController.update);`:

```ts
ticketRoutes.put("/tickets/:ticketId/pull", isAuth, TicketController.pull);
```

- [ ] **Step 6: Adicionar a mensagem de erro amigável no frontend**

Em `frontend/src/translate/languages/pt.js`, dentro do bloco `backendErrors: {` já existente (perto de `ERR_INTERNAL_SERVER_ERROR`), adicione:

```js
        ERR_TICKET_ALREADY_TAKEN:
            "Esse atendimento já foi puxado por outro atendente.",
```

- [ ] **Step 7: Checar tipos e rodar a suíte inteira**

Run: `cd backend && npx tsc --noEmit && npm test`
Expected: sem erros de tipo, todos os testes passando.

- [ ] **Step 8: Commit**

```bash
git add backend/src/services/TicketServices/PullTicketService.ts backend/src/services/TicketServices/__tests__/PullTicketService.spec.ts backend/src/controllers/TicketController.ts backend/src/routes/ticketRoutes.ts frontend/src/translate/languages/pt.js
git commit -m "$(cat <<'EOF'
Adiciona endpoint atômico para puxar atendimento de AGUARDANDO

UPDATE condicionado a userId IS NULL evita que dois agentes assumam
o mesmo ticket ao clicar quase ao mesmo tempo — importa mais agora
porque o pool de AGUARDANDO passa a ser compartilhado entre todos os
operadores do mesmo setor, não é mais uma fila = um agente.
EOF
)"
```

---

## Task 2: Sala de socket dedicada ao quadro (`company-<id>-pipeline`)

**Files:**
- Modify: `backend/src/libs/socket.ts` (novos handlers `joinTicketsPipeline`/`leaveTicketsPipeline`)
- Modify: `backend/src/services/TicketServices/UpdateTicketService.ts:298-319`
- Modify: `backend/src/services/MessageServices/CreateMessageService.ts:60-69`

**Interfaces:**
- Produces: evento de socket `joinTicketsPipeline`/`leaveTicketsPipeline` (sem argumentos) que junta/sai da sala `company-<companyId>-pipeline`; qualquer atualização de ticket ou mensagem nova passa a also chegar nessa sala. Consumida pela Task 5 (hook `usePipelineTickets`).

- [ ] **Step 1: Adicionar os handlers de join/leave**

Em `backend/src/libs/socket.ts`, logo depois do bloco `socket.on("leaveTickets", ...)` (antes de `socket.emit("ready");`), adicione:

```ts
    socket.on("joinTicketsPipeline", () => {
      if (counters.incrementCounter("pipeline") === 1) {
        logger.debug(`User ${user.id} of company ${user.companyId} joined pipeline channel.`);
        socket.join(`company-${user.companyId}-pipeline`);
      }
    });

    socket.on("leaveTicketsPipeline", () => {
      if (counters.decrementCounter("pipeline") === 0) {
        logger.debug(`User ${user.id} of company ${user.companyId} leaved pipeline channel.`);
        socket.leave(`company-${user.companyId}-pipeline`);
      }
    });
```

- [ ] **Step 2: Acrescentar a sala nova nas emissões já existentes**

Em `backend/src/services/TicketServices/UpdateTicketService.ts`, no bloco que emite quando o ticket muda de status/dono (por volta da linha 298-307), acrescente `.to(...)` da sala nova:

```ts
    if (ticket.status !== oldStatus || ticket.user?.id !== oldUserId) {

      io.to(`company-${companyId}-${oldStatus}`)
        .to(`queue-${ticket.queueId}-${oldStatus}`)
        .to(`user-${oldUserId}`)
        .to(`company-${companyId}-pipeline`)
        .emit(`company-${companyId}-ticket`, {
          action: "delete",
          ticketId: ticket.id
        });
    }
```

E logo abaixo, no bloco de emissão principal (por volta da linha 309-319):

```ts
    io.to(`company-${companyId}-${ticket.status}`)
      .to(`company-${companyId}-notification`)
      .to(`queue-${ticket.queueId}-${ticket.status}`)
      .to(`queue-${ticket.queueId}-notification`)
      .to(ticketId.toString())
      .to(`user-${ticket?.userId}`)
      .to(`user-${oldUserId}`)
      .to(`company-${companyId}-pipeline`)
      .emit(`company-${companyId}-ticket`, {
        action: "update",
        ticket
      });
```

Em `backend/src/services/MessageServices/CreateMessageService.ts`, na emissão existente (linhas 60-69), acrescente a mesma sala:

```ts
  const io = getIO();
  io.to(message.ticketId.toString())
    .to(`company-${companyId}-${message.ticket.status}`)
    .to(`company-${companyId}-notification`)
    .to(`queue-${message.ticket.queueId}-${message.ticket.status}`)
    .to(`queue-${message.ticket.queueId}-notification`)
    .to(`company-${companyId}-pipeline`)
    .emit(`company-${companyId}-appMessage`, {
      action: "create",
      message,
      ticket: message.ticket,
      contact: message.ticket.contact
    });
```

- [ ] **Step 3: Checar tipos e rodar a suíte inteira**

Run: `cd backend && npx tsc --noEmit && npm test`
Expected: sem erros de tipo; `npm test` continua passando (nenhum teste existente cobre `UpdateTicketService`/`CreateMessageService`/`socket.ts` diretamente, então isso só confirma que a mudança não quebra o build).

- [ ] **Step 4: Rebuild e verificar manualmente que a sala é criada**

```bash
cd /home/edison/fontes/stonechat
docker compose build stonechat_backend
docker compose up -d --no-deps stonechat_backend
docker compose logs stonechat_backend -f
```

Manual: abrir o DevTools do navegador numa aba logada, rodar no console `window.io = require('socket.io-client')` não é necessário — basta confirmar no log do backend (`logger.debug`) a linha `joined pipeline channel` depois que o frontend da Task 6 emitir `joinTicketsPipeline` (esse passo de verificação fecha de vez só depois da Task 6 estar pronta — por ora, validar que `npx tsc --noEmit` não acusa erro já é suficiente pra fechar esta tarefa).

- [ ] **Step 5: Commit**

```bash
git add backend/src/libs/socket.ts backend/src/services/TicketServices/UpdateTicketService.ts backend/src/services/MessageServices/CreateMessageService.ts
git commit -m "$(cat <<'EOF'
Adiciona sala de socket company-<id>-pipeline para o novo quadro

Acrescenta a sala nova como mais um destino nas emissões que já
existem em UpdateTicketService e CreateMessageService, sem alterar
o que elas já fazem hoje para os consumidores atuais (aba Fechados,
notificações, etc).
EOF
)"
```

---

## Task 3: `ListTicketsServicePipeline` — as 3 listas (IA/Aguardando/Atendendo)

**Files:**
- Create: `backend/src/services/TicketServices/ListTicketsServicePipeline.ts`
- Test: `backend/src/services/TicketServices/__tests__/ListTicketsServicePipeline.spec.ts`
- Modify: `backend/src/controllers/TicketController.ts` (nova action `pipeline`)
- Modify: `backend/src/routes/ticketRoutes.ts` (nova rota)

**Interfaces:**
- Produces: `ListTicketsServicePipeline({ companyId, profile, queueIds }): Promise<{ ia: Ticket[], aguardando: Ticket[], atendendo: Ticket[] }>`, consumida pela Task 5 (hook `usePipelineTickets`) via `GET /ticket/pipeline`.

- [ ] **Step 1: Escrever o teste que falha**

Crie `backend/src/services/TicketServices/__tests__/ListTicketsServicePipeline.spec.ts`:

```ts
jest.mock("../../../models/Ticket", () => ({
  __esModule: true,
  default: { findAll: jest.fn() }
}));

// eslint-disable-next-line import/first
import { Op } from "sequelize";
// eslint-disable-next-line import/first
import Ticket from "../../../models/Ticket";
// eslint-disable-next-line import/first
import ListTicketsServicePipeline from "../ListTicketsServicePipeline";

describe("ListTicketsServicePipeline", () => {
  beforeEach(() => jest.clearAllMocks());

  it("busca IA sem filtro de setor, Aguardando filtrado pelas filas do operador comum, e Atendendo global", async () => {
    (Ticket.findAll as jest.Mock)
      .mockResolvedValueOnce([{ id: 1 }])
      .mockResolvedValueOnce([{ id: 2 }])
      .mockResolvedValueOnce([{ id: 3 }]);

    const result = await ListTicketsServicePipeline({
      companyId: 1,
      profile: "user",
      queueIds: [2]
    });

    expect(result).toEqual({
      ia: [{ id: 1 }],
      aguardando: [{ id: 2 }],
      atendendo: [{ id: 3 }]
    });

    expect(Ticket.findAll).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { companyId: 1, status: "pending", queueId: null, userId: null }
      })
    );

    expect(Ticket.findAll).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: {
          companyId: 1,
          status: "pending",
          queueId: { [Op.and]: [{ [Op.ne]: null }, { [Op.in]: [2] }] },
          userId: null
        }
      })
    );

    expect(Ticket.findAll).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        where: { companyId: 1, status: "open", userId: { [Op.ne]: null } }
      })
    );
  });

  it("não filtra Aguardando por setor quando o perfil é admin", async () => {
    (Ticket.findAll as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await ListTicketsServicePipeline({ companyId: 1, profile: "admin", queueIds: [] });

    expect(Ticket.findAll).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: {
          companyId: 1,
          status: "pending",
          queueId: { [Op.ne]: null },
          userId: null
        }
      })
    );
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd backend && npx jest ListTicketsServicePipeline --verbose`
Expected: FAIL — `Cannot find module '../ListTicketsServicePipeline'`.

- [ ] **Step 3: Implementar**

Crie `backend/src/services/TicketServices/ListTicketsServicePipeline.ts`:

```ts
import { Op, Includeable } from "sequelize";
import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import Queue from "../../models/Queue";
import User from "../../models/User";
import Tag from "../../models/Tag";
import Whatsapp from "../../models/Whatsapp";

interface Request {
  companyId: number;
  profile: string;
  queueIds: number[];
}

interface Response {
  ia: Ticket[];
  aguardando: Ticket[];
  atendendo: Ticket[];
}

const includeCondition: Includeable[] = [
  {
    model: Contact,
    as: "contact",
    attributes: ["id", "name", "number", "profilePicUrl"]
  },
  { model: Queue, as: "queue", attributes: ["id", "name", "color"] },
  { model: User, as: "user", attributes: ["id", "name"] },
  { model: Tag, as: "tags", attributes: ["id", "name", "color"] },
  { model: Whatsapp, as: "whatsapp", attributes: ["name"] }
];

const ListTicketsServicePipeline = async ({
  companyId,
  profile,
  queueIds
}: Request): Promise<Response> => {
  const ia = await Ticket.findAll({
    where: { companyId, status: "pending", queueId: null, userId: null },
    include: includeCondition,
    order: [["updatedAt", "DESC"]]
  });

  const aguardandoWhere: any = {
    companyId,
    status: "pending",
    queueId: { [Op.ne]: null },
    userId: null
  };

  if (profile !== "admin") {
    aguardandoWhere.queueId = {
      [Op.and]: [{ [Op.ne]: null }, { [Op.in]: queueIds }]
    };
  }

  const aguardando = await Ticket.findAll({
    where: aguardandoWhere,
    include: includeCondition,
    order: [["updatedAt", "DESC"]]
  });

  const atendendo = await Ticket.findAll({
    where: { companyId, status: "open", userId: { [Op.ne]: null } },
    include: includeCondition,
    order: [["updatedAt", "DESC"]]
  });

  return { ia, aguardando, atendendo };
};

export default ListTicketsServicePipeline;
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd backend && npx jest ListTicketsServicePipeline --verbose`
Expected: PASS nos dois testes.

- [ ] **Step 5: Expor via controller e rota**

Em `backend/src/controllers/TicketController.ts`, adicione (perto da action `kanban` existente):

```ts
export const pipeline = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId, profile } = req.user;
  const { queueIds: queueIdsStringified } = req.query as { queueIds?: string };

  let queueIds: number[] = [];
  if (queueIdsStringified) {
    queueIds = JSON.parse(queueIdsStringified);
  }

  const pipelineTickets = await ListTicketsServicePipeline({
    companyId,
    profile,
    queueIds
  });

  return res.status(200).json(pipelineTickets);
};
```

E o import correspondente no topo do arquivo:

```ts
import ListTicketsServicePipeline from "../services/TicketServices/ListTicketsServicePipeline";
```

Em `backend/src/routes/ticketRoutes.ts`, adicione logo depois de `ticketRoutes.get("/ticket/kanban", isAuth, TicketController.kanban);`:

```ts
ticketRoutes.get("/ticket/pipeline", isAuth, TicketController.pipeline);
```

- [ ] **Step 6: Checar tipos e rodar a suíte inteira**

Run: `cd backend && npx tsc --noEmit && npm test`
Expected: sem erros, tudo passando.

- [ ] **Step 7: Commit**

```bash
git add backend/src/services/TicketServices/ListTicketsServicePipeline.ts backend/src/services/TicketServices/__tests__/ListTicketsServicePipeline.spec.ts backend/src/controllers/TicketController.ts backend/src/routes/ticketRoutes.ts
git commit -m "$(cat <<'EOF'
Adiciona GET /ticket/pipeline com os 3 baldes IA/Aguardando/Atendendo

Sem tabela nova: cada balde é uma combinação de status/queueId/userId
que o Ticket já tem. AGUARDANDO é filtrado pelas filas do operador
(exceto admin, que vê tudo); ATENDENDO é global, sem filtro de setor.
EOF
)"
```

---

## Task 4: `ListLinkedContactsService` — agregação de contatos pelo mesmo CPF

**Files:**
- Create: `backend/src/services/ContactServices/ListLinkedContactsService.ts`
- Test: `backend/src/services/ContactServices/__tests__/ListLinkedContactsService.spec.ts`
- Modify: `backend/src/controllers/ContactController.ts` (nova action `linked`)
- Modify: `backend/src/routes/contactRoutes.ts` (nova rota)

**Interfaces:**
- Produces: `ListLinkedContactsService({ contactId, companyId }): Promise<Contact[]>`, consumida pela Task 7 (`LinkedContactsBanner`) via `GET /contacts/:contactId/linked`.

- [ ] **Step 1: Escrever o teste que falha**

Crie `backend/src/services/ContactServices/__tests__/ListLinkedContactsService.spec.ts`:

```ts
jest.mock("../../../models/Contact", () => ({
  __esModule: true,
  default: { findByPk: jest.fn(), findAll: jest.fn() }
}));

// eslint-disable-next-line import/first
import { Op } from "sequelize";
// eslint-disable-next-line import/first
import Contact from "../../../models/Contact";
// eslint-disable-next-line import/first
import ListLinkedContactsService from "../ListLinkedContactsService";

describe("ListLinkedContactsService", () => {
  beforeEach(() => jest.clearAllMocks());

  it("retorna outros contatos com o mesmo CPF, excluindo o próprio (caso real: CPF 68197756953)", async () => {
    (Contact.findByPk as jest.Mock).mockResolvedValue({
      id: 25,
      cpfCnpj: "68197756953"
    });
    (Contact.findAll as jest.Mock).mockResolvedValue([
      { id: 24, name: "Edison Carlos", number: "554399332300" }
    ]);

    const result = await ListLinkedContactsService({ contactId: 25, companyId: 1 });

    expect(Contact.findAll).toHaveBeenCalledWith({
      where: { cpfCnpj: "68197756953", companyId: 1, id: { [Op.ne]: 25 } },
      attributes: ["id", "name", "number"]
    });
    expect(result).toEqual([
      { id: 24, name: "Edison Carlos", number: "554399332300" }
    ]);
  });

  it("retorna lista vazia quando o contato não tem CPF cadastrado", async () => {
    (Contact.findByPk as jest.Mock).mockResolvedValue({ id: 30, cpfCnpj: null });

    const result = await ListLinkedContactsService({ contactId: 30, companyId: 1 });

    expect(result).toEqual([]);
    expect(Contact.findAll).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd backend && npx jest ListLinkedContactsService --verbose`
Expected: FAIL — `Cannot find module '../ListLinkedContactsService'`.

- [ ] **Step 3: Implementar**

Crie `backend/src/services/ContactServices/ListLinkedContactsService.ts`:

```ts
import { Op } from "sequelize";
import Contact from "../../models/Contact";

interface Request {
  contactId: number;
  companyId: number;
}

const ListLinkedContactsService = async ({
  contactId,
  companyId
}: Request): Promise<Contact[]> => {
  const contact = await Contact.findByPk(contactId);

  if (!contact || !contact.cpfCnpj) {
    return [];
  }

  const linkedContacts = await Contact.findAll({
    where: {
      cpfCnpj: contact.cpfCnpj,
      companyId,
      id: { [Op.ne]: contactId }
    },
    attributes: ["id", "name", "number"]
  });

  return linkedContacts;
};

export default ListLinkedContactsService;
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd backend && npx jest ListLinkedContactsService --verbose`
Expected: PASS nos dois testes.

- [ ] **Step 5: Expor via controller e rota**

Em `backend/src/controllers/ContactController.ts`, adicione (perto da action `show` existente):

```ts
export const linked = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { contactId } = req.params;
  const { companyId } = req.user;

  const linkedContacts = await ListLinkedContactsService({
    contactId: Number(contactId),
    companyId
  });

  return res.status(200).json(linkedContacts);
};
```

E o import no topo do arquivo:

```ts
import ListLinkedContactsService from "../services/ContactServices/ListLinkedContactsService";
```

Em `backend/src/routes/contactRoutes.ts`, adicione logo depois de `contactRoutes.get("/contacts/:contactId", isAuth, ContactController.show);`:

```ts
contactRoutes.get("/contacts/:contactId/linked", isAuth, ContactController.linked);
```

- [ ] **Step 6: Checar tipos e rodar a suíte inteira**

Run: `cd backend && npx tsc --noEmit && npm test`
Expected: sem erros, tudo passando.

- [ ] **Step 7: Commit**

```bash
git add backend/src/services/ContactServices/ListLinkedContactsService.ts backend/src/services/ContactServices/__tests__/ListLinkedContactsService.spec.ts backend/src/controllers/ContactController.ts backend/src/routes/contactRoutes.ts
git commit -m "$(cat <<'EOF'
Adiciona GET /contacts/:id/linked para agregação por CPF

Sem tabela nova: busca outros Contacts com o mesmo cpfCnpj, escopado
por empresa. Resolve o caso do ticket #26, onde o contato "Clau
Marins" informou o CPF de outro cliente já cadastrado sem nenhum
vínculo visível pro atendente.
EOF
)"
```

---

## Task 5: `usePipelineTickets` — hook de dados do quadro

**Files:**
- Create: `frontend/src/hooks/usePipelineTickets/index.js`

**Interfaces:**
- Consumes: `GET /ticket/pipeline` (Task 3), `PUT /tickets/:ticketId/pull` (Task 1), evento de socket `company-<id>-ticket`/`company-<id>-appMessage` na sala `company-<id>-pipeline` (Task 2).
- Produces: `usePipelineTickets(): { pipeline: { ia: Ticket[], aguardando: Ticket[], atendendo: Ticket[] }, loading: boolean, pullTicket: (ticketId) => Promise<boolean> }`, consumida pela Task 6 (`TicketsPipelineBoard`).

- [ ] **Step 1: Implementar o hook**

Crie `frontend/src/hooks/usePipelineTickets/index.js`:

```js
import { useState, useEffect, useContext, useCallback } from "react";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import { SocketContext } from "../../context/Socket/SocketContext";

const usePipelineTickets = () => {
  const { user } = useContext(AuthContext);
  const socketManager = useContext(SocketContext);
  const [pipeline, setPipeline] = useState({ ia: [], aguardando: [], atendendo: [] });
  const [loading, setLoading] = useState(true);

  const queueIds = user.queues.map((q) => q.id);
  const queueIdsKey = JSON.stringify(queueIds);

  const fetchPipeline = useCallback(async () => {
    try {
      const { data } = await api.get("/ticket/pipeline", {
        params: { queueIds: queueIdsKey },
      });
      setPipeline(data);
      setLoading(false);
    } catch (err) {
      setLoading(false);
      toastError(err);
    }
  }, [queueIdsKey]);

  useEffect(() => {
    fetchPipeline();
  }, [fetchPipeline]);

  useEffect(() => {
    const companyId = localStorage.getItem("companyId");
    const socket = socketManager.getSocket(companyId);

    socket.on("ready", () => socket.emit("joinTicketsPipeline"));

    socket.on(`company-${companyId}-ticket`, () => {
      fetchPipeline();
    });

    socket.on(`company-${companyId}-appMessage`, (data) => {
      if (data.action === "create") {
        fetchPipeline();
      }
    });

    return () => {
      socket.emit("leaveTicketsPipeline");
      socket.disconnect();
    };
  }, [socketManager, fetchPipeline]);

  const pullTicket = async (ticketId) => {
    try {
      await api.put(`/tickets/${ticketId}/pull`);
      return true;
    } catch (err) {
      toastError(err);
      return false;
    }
  };

  return { pipeline, loading, pullTicket };
};

export default usePipelineTickets;
```

Nota de design: em vez de reclassificar cada ticket manualmente a partir do payload do evento de socket, o hook simplesmente busca o quadro inteiro de novo (`fetchPipeline()`) a cada evento relevante — mais simples que manter 3 reducers sincronizados, e a frequência de eventos nessa tela (mudança de estágio de atendimento) é baixa o suficiente pra isso não pesar.

- [ ] **Step 2: Verificar manualmente que compila**

Run: `cd frontend && CI=true npx eslint src/hooks/usePipelineTickets/index.js`
Expected: sem erros de lint (a verificação funcional completa acontece na Task 8, depois do componente da Task 6 existir).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/usePipelineTickets/index.js
git commit -m "$(cat <<'EOF'
Adiciona hook usePipelineTickets para o quadro IA/Aguardando/Atendendo

Busca as 3 listas via GET /ticket/pipeline e refaz a busca a cada
evento relevante de socket na sala company-<id>-pipeline.
EOF
)"
```

---

## Task 6: `TicketsPipelineBoard` — o quadro de 3 colunas, e troca na aba "Abertos"

**Files:**
- Create: `frontend/src/components/TicketsPipelineBoard/index.js`
- Modify: `frontend/src/components/TicketsManagerTabs/index.js`
- Modify: `frontend/src/components/TicketMessagesDialog/index.js:80-84` (corrige bloqueio indevido de acesso a tickets sem fila)
- Modify: `frontend/src/translate/languages/pt.js`

**Interfaces:**
- Consumes: `usePipelineTickets()` (Task 5); `<TicketMessagesDialog open, handleClose, ticketId />` (já existe, hoje só usado pelo ícone de "espiar" do admin em `TicketListItemCustom`).
- Produces: `<TicketsPipelineBoard />`, sem props, montado dentro de `TicketsManagerTabs`.

**Correção necessária antes deste task (achada revisando o plano contra o spec e o código real):**
1. O design pede que o clique num card da coluna **IA** abra a conversa em **modo leitura** (acompanhar em tempo real sem poder responder) — a versão original deste plano fazia até os cards de IA navegarem pra tela normal do ticket (`history.push`), que permite responder. `TicketMessagesDialog` (`frontend/src/components/TicketMessagesDialog/index.js`) já é exatamente esse visualizador read-only (usa `MessagesList` sem nenhum `MessageInput`) — hoje só é usado pelo ícone de "espiar" restrito a admin em `TicketListItemCustom`. Vamos reaproveitá-lo pros cards de IA.
2. Esse componente tem uma guarda de acesso (`frontend/src/components/TicketMessagesDialog/index.js:80-84`) que bloqueia quem não é admin quando `queueId` do ticket não bate com nenhuma fila do usuário. Tickets na coluna IA têm `queueId IS NULL` — com a guarda atual, `queues.find(q => q.id === null)` nunca bate, e **todo operador não-admin seria bloqueado** ao tentar abrir um card de IA, contrariando o requisito do spec ("Todos os operadores, independente de setor"). Precisa corrigir a guarda antes de usar o componente pra esse fim.
3. O botão "Puxar atendimento" da versão original navegava com `history.push('/tickets/' + ticketId)` usando o **id numérico** do ticket — mas a rota `/tickets/:ticketId` no app é resolvida como **uuid** (`components/Ticket/index.js:79` busca via `GET /tickets/u/:uuid`). Isso geraria uma URL quebrada. Corrigido abaixo usando `ticket.uuid`.

- [ ] **Step 1: Adicionar as strings de tradução**

Em `frontend/src/translate/languages/pt.js`, logo depois do bloco `kanban: { ... }` já existente, adicione um bloco irmão:

```js
      ticketsPipeline: {
        ia: "IA",
        aguardando: "Aguardando",
        atendendo: "Atendendo",
        pull: "Puxar atendimento",
        aiTag: "Atendimento IA",
        seeTicket: "Ver Ticket",
      },
      linkedContacts: {
        banner: "Este CPF também está associado a: ",
      },
```

- [ ] **Step 2: Corrigir a guarda de acesso do `TicketMessagesDialog` pra tickets sem fila**

Em `frontend/src/components/TicketMessagesDialog/index.js`, a guarda de acesso (linhas 80-84) bloqueia hoje qualquer não-admin quando o ticket não tem fila — isso vai passar a valer pros cards de IA (Step 3 abaixo), que têm `queueId` nulo por definição, e todo operador (não só admin) precisa poder abrir esses cards. Troque:

```js
            const { queueId } = data;
            const { queues, profile } = user;

            const queueAllowed = queues.find((q) => q.id === queueId);
            if (queueAllowed === undefined && profile !== "admin") {
```

por:

```js
            const { queueId } = data;
            const { queues, profile } = user;

            const queueAllowed =
              queueId === null || queues.find((q) => q.id === queueId);
            if (!queueAllowed && profile !== "admin") {
```

Isso preserva o comportamento atual pra tickets com fila (só quem está na fila, ou admin, pode espiar) e libera especificamente o caso de `queueId` nulo (ticket ainda em atendimento por IA, sem fila atribuída) pra qualquer operador logado.

- [ ] **Step 3: Implementar o componente do quadro**

Crie `frontend/src/components/TicketsPipelineBoard/index.js`:

```jsx
import React, { useState } from "react";
import { makeStyles } from "@material-ui/core/styles";
import Board from "react-trello";
import { useHistory } from "react-router-dom";

import { i18n } from "../../translate/i18n";
import usePipelineTickets from "../../hooks/usePipelineTickets";
import TicketMessagesDialog from "../TicketMessagesDialog";

const useStyles = makeStyles(() => ({
  root: {
    display: "flex",
    height: "100%",
  },
  pullButton: {
    background: "#10a110",
    border: "none",
    padding: "8px",
    color: "white",
    fontWeight: "bold",
    borderRadius: "5px",
    cursor: "pointer",
    marginTop: 6,
  },
  seeButton: {
    marginTop: 6,
    cursor: "pointer",
    background: "none",
    border: "1px solid #ccc",
    borderRadius: "5px",
    padding: "6px",
  },
}));

const buildCard = (ticket, classes, onOpen, onPull) => ({
  id: ticket.id.toString(),
  title: ticket.contact?.name,
  label: `#${ticket.id}`,
  draggable: false,
  description: (
    <div>
      <p>
        {ticket.contact?.number}
        <br />
        {ticket.lastMessage}
      </p>
      {ticket.queue && (
        <div style={{ color: ticket.queue.color, fontWeight: "bold" }}>
          {ticket.queue.name}
        </div>
      )}
      {ticket.tags?.some((t) => t.name === "Atendimento IA") && (
        <div style={{ color: "#8B5CF6", fontWeight: "bold" }}>
          {i18n.t("ticketsPipeline.aiTag")}
        </div>
      )}
      {ticket.user && <div>{ticket.user.name}</div>}
      {onPull && (
        <button
          type="button"
          className={classes.pullButton}
          onClick={() => onPull(ticket)}
        >
          {i18n.t("ticketsPipeline.pull")}
        </button>
      )}
      <button
        type="button"
        className={classes.seeButton}
        onClick={() => onOpen(ticket)}
      >
        {i18n.t("ticketsPipeline.seeTicket")}
      </button>
    </div>
  ),
});

const TicketsPipelineBoard = () => {
  const classes = useStyles();
  const history = useHistory();
  const { pipeline, loading, pullTicket } = usePipelineTickets();
  const [peekTicketId, setPeekTicketId] = useState(null);

  const handleOpenReadOnly = (ticket) => setPeekTicketId(ticket.id);

  const handleOpenNormal = (ticket) => history.push(`/tickets/${ticket.uuid}`);

  const handlePull = async (ticket) => {
    const ok = await pullTicket(ticket.id);
    if (ok) {
      history.push(`/tickets/${ticket.uuid}`);
    }
  };

  if (loading) {
    return null;
  }

  const data = {
    lanes: [
      {
        id: "ia",
        title: i18n.t("ticketsPipeline.ia"),
        label: pipeline.ia.length.toString(),
        cards: pipeline.ia.map((t) =>
          buildCard(t, classes, handleOpenReadOnly, null)
        ),
      },
      {
        id: "aguardando",
        title: i18n.t("ticketsPipeline.aguardando"),
        label: pipeline.aguardando.length.toString(),
        cards: pipeline.aguardando.map((t) =>
          buildCard(t, classes, handleOpenNormal, handlePull)
        ),
      },
      {
        id: "atendendo",
        title: i18n.t("ticketsPipeline.atendendo"),
        label: pipeline.atendendo.length.toString(),
        cards: pipeline.atendendo.map((t) =>
          buildCard(t, classes, handleOpenNormal, null)
        ),
      },
    ],
  };

  return (
    <div className={classes.root}>
      <Board data={data} draggable={false} />
      <TicketMessagesDialog
        open={!!peekTicketId}
        ticketId={peekTicketId}
        handleClose={() => setPeekTicketId(null)}
      />
    </div>
  );
};

export default TicketsPipelineBoard;
```

Note de design: a coluna IA abre `TicketMessagesDialog` (mesmo visualizador read-only já usado pelo ícone de "espiar" do admin, sem `MessageInput`) em vez de navegar pra tela normal do ticket — atende ao requisito do spec de "modo leitura, sem poder responder". AGUARDANDO e ATENDENDO continuam navegando pra tela normal (`history.push` com `ticket.uuid`, nunca `ticket.id`, pra bater com a rota `/tickets/:ticketId` que é resolvida como uuid).

- [ ] **Step 4: Trocar a antiga aba "Abertos" pelo quadro novo**

Em `frontend/src/components/TicketsManagerTabs/index.js`:

1. Remova o import não usado `import Badge from "@material-ui/core/Badge";` (linha 10).
2. Adicione o import novo, junto dos outros imports de componentes locais:

```js
import TicketsPipelineBoard from "../TicketsPipelineBoard";
```

3. Remova as duas linhas de estado que só serviam pro sub-navegação antiga (dentro do componente `TicketsManagerTabs`):

```js
  const [tabOpen, setTabOpen] = useState("open");
```

e

```js
  const [openCount, setOpenCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
```

4. Remova as duas funções que só existiam pra essa sub-navegação:

```js
  const handleChangeTabOpen = (e, newValue) => {
    setTabOpen(newValue);
  };

  const applyPanelStyle = (status) => {
    if (tabOpen !== status) {
      return { width: 0, height: 0 };
    }
  };
```

5. Substitua o conteúdo inteiro do `TabPanel` "open" (que hoje tem a sub-navegação `Tabs`/`Tab`/`Badge` e as duas `TicketsList`) por:

```jsx
      <TabPanel value={tab} name="open" className={classes.ticketsWrapper}>
        <TicketsPipelineBoard />
      </TabPanel>
```

O restante do arquivo (abas "Fechados" e "Busca", `TicketsQueueSelect`, `showAllTickets`, `selectedTags`/`selectedUsers`) fica exatamente como está — essas abas continuam usando `TicketsList`/`TicketsListCustom` normalmente.

- [ ] **Step 5: Verificar manualmente com Playwright**

```bash
mkdir -p /tmp/pw-pipeline && cd /tmp/pw-pipeline && npm init -y && npm install playwright
npx playwright install chromium --with-deps
```

Script (`check.mjs`) navegando até `https://147.15.57.112/stonechat`, logando com `admin@admin.com`/`123456`, abrindo a aba "Abertos", e confirmando via `page.screenshot()` que aparecem as 3 colunas "IA"/"Aguardando"/"Atendendo" (use `chromium.launch({args:['--no-sandbox']})` + `newContext({ignoreHTTPSErrors:true})`, ver `feedback_playwright_adhoc_browser_test` na memória do projeto). Confirmar que o ticket #26 (Clau Marins) aparece na coluna correta depois de o Edison ter atribuído a fila Atendimento à própria conta em Configurações → Usuários. Confirmar também que clicar num card de IA abre o diálogo read-only (sem caixa de resposta) e não navega pra URL nenhuma.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/TicketsPipelineBoard/index.js frontend/src/components/TicketsManagerTabs/index.js frontend/src/components/TicketMessagesDialog/index.js frontend/src/translate/languages/pt.js
git commit -m "$(cat <<'EOF'
Substitui a aba Abertos pelo quadro IA/Aguardando/Atendendo

Reaproveita a mesma lib (react-trello) já usada no Kanban de tags
existente. Coluna IA abre o ticket em modo leitura (TicketMessagesDialog,
já usado hoje só pelo "espiar" do admin) - corrige também a guarda desse
componente, que bloqueava qualquer não-admin em tickets sem fila.
Transição de estágio é sempre via ação explícita (o cliente pedir
humano, ou o botão "Puxar atendimento") — nunca arrastando o card.
EOF
)"
```

---

## Task 7: `LinkedContactsBanner` — aviso de contato com o mesmo CPF

**Files:**
- Create: `frontend/src/components/LinkedContactsBanner/index.js`
- Modify: `frontend/src/components/Ticket/index.js`

**Interfaces:**
- Consumes: `GET /contacts/:contactId/linked` (Task 4).
- Produces: `<LinkedContactsBanner contact={contact} />`, montado dentro de `components/Ticket/index.js`.

- [ ] **Step 1: Implementar o componente**

Crie `frontend/src/components/LinkedContactsBanner/index.js`:

```jsx
import React, { useState, useEffect } from "react";
import { makeStyles } from "@material-ui/core/styles";
import api from "../../services/api";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles(() => ({
  banner: {
    padding: 8,
    backgroundColor: "#FFF3CD",
    color: "#664D03",
    fontSize: 13,
  },
  name: {
    fontWeight: "bold",
    marginLeft: 4,
  },
}));

const LinkedContactsBanner = ({ contact }) => {
  const classes = useStyles();
  const [linkedContacts, setLinkedContacts] = useState([]);

  useEffect(() => {
    if (!contact?.id) {
      setLinkedContacts([]);
      return;
    }

    const fetchLinked = async () => {
      const { data } = await api.get(`/contacts/${contact.id}/linked`);
      setLinkedContacts(data);
    };

    fetchLinked();
  }, [contact?.id]);

  if (linkedContacts.length === 0) {
    return null;
  }

  return (
    <div className={classes.banner}>
      {i18n.t("linkedContacts.banner")}
      {linkedContacts.map((linked, index) => (
        <span key={linked.id} className={classes.name}>
          {linked.name} ({linked.number})
          {index < linkedContacts.length - 1 ? "," : ""}
        </span>
      ))}
    </div>
  );
};

export default LinkedContactsBanner;
```

Nota de design: o banner é só informativo (nome/telefone do outro contato), sem link clicável de "abrir histórico" — a busca da aba "Busca" hoje não lê parâmetro nenhum da URL, e criar esse mecanismo só pra esse link seria escopo novo não pedido. O atendente já consegue localizar o outro contato manualmente pela busca existente.

- [ ] **Step 2: Montar dentro da tela de ticket**

Em `frontend/src/components/Ticket/index.js`, adicione o import:

```js
import LinkedContactsBanner from "../LinkedContactsBanner";
```

E logo depois do bloco `<Paper><TagsContainer ticket={ticket} /></Paper>` (antes de `<ReplyMessageProvider>`):

```jsx
        <Paper>
          <TagsContainer ticket={ticket} />
        </Paper>
        <LinkedContactsBanner contact={contact} />
        <ReplyMessageProvider>{renderMessagesList()}</ReplyMessageProvider>
```

- [ ] **Step 3: Verificar manualmente com Playwright**

Reaproveitando o script da Task 6, abrir o ticket #26 (contato "Clau Marins", CPF 68197756953) e confirmar visualmente que aparece o aviso citando "Edison Carlos (554399332300)".

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/LinkedContactsBanner/index.js frontend/src/components/Ticket/index.js
git commit -m "$(cat <<'EOF'
Mostra aviso quando o contato compartilha CPF com outro já cadastrado

Resolve a falta de vínculo visível do caso do ticket #26 (contato
"Clau Marins" informou o CPF de outro cliente já cadastrado).
EOF
)"
```

---

## Self-Review (preenchido durante a escrita do plano)

**Cobertura do spec (Partes 1 e 3 do design):**
- Quadro de 3 colunas por status/queueId/userId, sem migration → Task 3 (backend) + Task 6 (frontend). ✅
- AGUARDANDO filtrado por setor do operador, admin vê tudo → Task 3. ✅
- ATENDENDO global, todos os agentes → Task 3 (sem filtro de setor na query) + Task 2 (sala de socket sem restrição de perfil). ✅
- IA visível a todos os operadores → Task 3 (sem filtro de setor) + Task 6 (coluna sem botão de pull, só leitura). ✅
- "Puxar atendimento" com guarda de corrida → Task 1. ✅
- Tempo real → Task 2 (sala nova) + Task 5 (hook re-busca a cada evento). ✅
- Agregação de contatos por CPF, sem tabela nova → Task 4 (backend) + Task 7 (frontend). ✅
- Fechados/Busca inalterados → Task 6 explicitamente só toca o TabPanel "open". ✅
- Correção operacional (atribuir setor aos usuários existentes) → fora do escopo de código, registrada nas Global Constraints e retomada no aviso final abaixo.

**Sem placeholders:** todo passo tem código completo, comandos exatos e resultado esperado; as duas simplificações de escopo (refetch em vez de patch incremental no hook; banner sem link clicável) estão documentadas explicitamente como decisão, não como lacuna.

**Consistência de tipos:** `PullTicketService`/`ListTicketsServicePipeline`/`ListLinkedContactsService` (Tasks 1/3/4) usam os mesmos nomes de campo (`ia`, `aguardando`, `atendendo`, `linked contacts` como array de `{id, name, number}`) que o hook (Task 5) e os componentes (Tasks 6/7) esperam.

**Lembrete final:** depois de todas as tasks aplicadas, o Edison precisa ir em Configurações → Usuários e marcar o setor de cada operador existente (Admin, edison) — sem isso, AGUARDANDO fica vazio pra qualquer operador não-admin, e é exatamente essa lacuna de configuração que fez o ticket #26 desaparecer originalmente.

**Correções feitas numa segunda revisão (antes de executar):** a primeira versão da Task 6 fazia os cards de IA navegarem pra tela normal do ticket (permitindo responder, contrariando o requisito de modo leitura) e o botão "Puxar atendimento" navegava com o id numérico em vez do uuid (rota `/tickets/:ticketId` é resolvida como uuid). Corrigido reaproveitando `TicketMessagesDialog` pra IA (com ajuste na sua guarda de acesso, que bloquearia não-admins em tickets sem fila) e trocando `ticket.id` por `ticket.uuid` na navegação pós-pull.
