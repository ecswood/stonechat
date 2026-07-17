# Ticket Novo Após Fechamento + Confiabilidade do SGP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Depois que um ticket fecha (por confirmação do cliente ou pelo timeout automático de 10 minutos já existente), o próximo contato do cliente sempre cria um atendimento novo — nunca reabre o antigo. E a integração com o SGP passa a tolerar falhas transitórias (timeout configurado, 1 retry automático) e avisar via WhatsApp quando o SGP cair de vez.

**Architecture:** Duas mudanças independentes no backend do StoneChat. (1) `FindOrCreateTicketService.ts` para de considerar tickets `closed` reaproveitáveis nas duas buscas que hoje os incluem. (2) `SgpService.ts` ganha um helper `withRetry` (timeout de 8s + 1 retry automático) usado pelas 3 chamadas ao SGP, mais um contador de falhas consecutivas em memória que, ao chegar em 3, aciona um novo helper `SgpOutageAlert.ts` pra mandar um aviso no grupo de WhatsApp NOC Avisos SNI.

**Tech Stack:** Node.js/TypeScript, Sequelize, Jest (`ts-jest`), axios, Baileys (`@whiskeysockets/baileys`).

**Spec original:** `docs/superpowers/specs/2026-07-17-ticket-lifecycle-sgp-reliability-design.md`

## Global Constraints

- Fechamento de ticket = qualquer transição pra `status: "closed"` — por confirmação do cliente (`Ação: Encerrar Atendimento`) ou pelo timeout automático de 10 minutos (`AutoCloseAfterWaitQueue`, já implementado). As duas contam igual.
- Reabertura MANUAL de ticket pelo painel (`UpdateTicketService`) não muda em nada.
- O bloco de `groupContact` em `FindOrCreateTicketService.ts` (linha ~43-71, incluindo a leitura morta de `Setting("timeCreateNewTicket")`) fica INTOCADO — fora de escopo.
- Timeout de chamada ao SGP: **8000ms** (`8 * 1000`).
- Retry automático: exatamente **1 tentativa extra** (total 2 chamadas) antes de propagar/retornar falha.
- Alerta de indisponibilidade do SGP: dispara ao acumular **3 falhas consecutivas** (as 3 funções de `SgpService.ts` contam juntas, não separado por CPF). Qualquer sucesso zera o contador. Não repete o alerta em falhas subsequentes até haver um sucesso resetando o contador.
- Grupo de destino do alerta: `120363410164424155@g.us` (NOC Avisos SNI). Empresa usada pra achar a conexão WhatsApp padrão: `companyId = 1` (SNI Telecom, única empresa real hoje) — hardcoded, sem parametrizar multi-tenant que não existe na prática.
- Falha ao ENVIAR o alerta (ex: bot ainda não é membro do grupo) nunca pode quebrar a resposta original ao cliente — só loga o erro.
- Cache de resultado do SGP: fora de escopo.
- Rodar `npm test` de dentro de `backend/` depois de cada passo — nunca marcar uma tarefa concluída com teste falhando.
- Commits em português, um por tarefa completa (implementação + testes passando).

---

### Task 1: Ticket novo após fechamento (FindOrCreateTicketService)

**Files:**
- Modify: `backend/src/services/TicketServices/FindOrCreateTicketService.ts`
- Test (novo arquivo): `backend/src/services/TicketServices/__tests__/FindOrCreateTicketService.spec.ts`

**Interfaces:**
- Produz: nenhuma mudança de assinatura — `FindOrCreateTicketService(contact, whatsappId, unreadMessages, companyId, groupContact?)` continua igual.

- [ ] **Passo 1: Escrever os testes que falham**

Criar `backend/src/services/TicketServices/__tests__/FindOrCreateTicketService.spec.ts`:

```typescript
import { Op } from "sequelize";

jest.mock("../../../models/Ticket", () => ({
  __esModule: true,
  default: { findOne: jest.fn(), create: jest.fn() }
}));
jest.mock("../../../models/Whatsapp", () => ({
  __esModule: true,
  default: { findOne: jest.fn() }
}));
jest.mock("../ShowTicketService", () => ({
  __esModule: true,
  default: jest.fn()
}));
jest.mock("../FindOrCreateATicketTrakingService", () => ({
  __esModule: true,
  default: jest.fn()
}));

// eslint-disable-next-line import/first
import Ticket from "../../../models/Ticket";
// eslint-disable-next-line import/first
import Whatsapp from "../../../models/Whatsapp";
// eslint-disable-next-line import/first
import ShowTicketService from "../ShowTicketService";
// eslint-disable-next-line import/first
import FindOrCreateTicketService from "../FindOrCreateTicketService";

describe("FindOrCreateTicketService", () => {
  const contact = { id: 24 } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    (Whatsapp.findOne as jest.Mock).mockResolvedValue({ id: 5 });
  });

  it("busca principal não inclui tickets fechados (pedido do Edison: fechamento sempre inicia atendimento novo)", async () => {
    (Ticket.findOne as jest.Mock).mockResolvedValue(null);
    (Ticket.create as jest.Mock).mockResolvedValue({ id: 99 });
    (ShowTicketService as jest.Mock).mockResolvedValue({ id: 99 });

    await FindOrCreateTicketService(contact, 5, 0, 1);

    const [firstCallArgs] = (Ticket.findOne as jest.Mock).mock.calls[0];
    expect(firstCallArgs.where.status).toEqual({ [Op.or]: ["open", "pending"] });
  });

  it("busca de repescagem de 2h também exclui tickets fechados (senão reabriria um ticket fechado há poucos minutos)", async () => {
    (Ticket.findOne as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    (Ticket.create as jest.Mock).mockResolvedValue({ id: 99 });
    (ShowTicketService as jest.Mock).mockResolvedValue({ id: 99 });

    await FindOrCreateTicketService(contact, 5, 0, 1);

    expect(Ticket.findOne).toHaveBeenCalledTimes(2);
    const [secondCallArgs] = (Ticket.findOne as jest.Mock).mock.calls[1];
    expect(secondCallArgs.where.status).toEqual({ [Op.or]: ["open", "pending"] });
  });

  it("reaproveita um ticket aberto/pendente existente, sem criar um novo", async () => {
    const ticketExistente = {
      id: 42,
      status: "pending",
      update: jest.fn().mockResolvedValue(undefined)
    };
    (Ticket.findOne as jest.Mock).mockResolvedValueOnce(ticketExistente);
    (ShowTicketService as jest.Mock).mockResolvedValue(ticketExistente);

    const result = await FindOrCreateTicketService(contact, 5, 0, 1);

    expect(Ticket.create).not.toHaveBeenCalled();
    expect(result).toBe(ticketExistente);
  });

  it("cria um ticket novo quando o contato não tem nenhum ticket aberto/pendente", async () => {
    (Ticket.findOne as jest.Mock).mockResolvedValue(null);
    (Ticket.create as jest.Mock).mockResolvedValue({ id: 100 });
    (ShowTicketService as jest.Mock).mockResolvedValue({ id: 100 });

    await FindOrCreateTicketService(contact, 5, 0, 1);

    expect(Ticket.create).toHaveBeenCalledWith(
      expect.objectContaining({
        contactId: 24,
        status: "pending",
        companyId: 1,
        whatsappId: 5
      })
    );
  });
});
```

- [ ] **Passo 2: Rodar os testes e confirmar que falham**

```bash
cd backend && npx jest src/services/TicketServices/__tests__/FindOrCreateTicketService.spec.ts --coverage=false
```

Esperado: as duas primeiras falham (o código atual ainda inclui `"closed"` na busca principal e não filtra status na busca de repescagem); as duas últimas devem passar já de cara (comportamento não muda pra ticket aberto/criação do zero) — se alguma delas também falhar por causa dos mocks, ajustar os mocks antes de prosseguir (não o código de produção).

- [ ] **Passo 3: Corrigir `FindOrCreateTicketService.ts`**

Na busca principal (linhas ~23-33), trocar:

```typescript
  let ticket = await Ticket.findOne({
    where: {
      status: {
        [Op.or]: ["open", "pending", "closed"]
      },
      contactId: groupContact ? groupContact.id : contact.id,
      companyId,
      whatsappId
    },
    order: [["id", "DESC"]]
  });
```

por:

```typescript
  let ticket = await Ticket.findOne({
    where: {
      status: {
        [Op.or]: ["open", "pending"]
      },
      contactId: groupContact ? groupContact.id : contact.id,
      companyId,
      whatsappId
    },
    order: [["id", "DESC"]]
  });
```

Na busca de repescagem não-grupo (linhas ~73-84), trocar:

```typescript
  if (!ticket && !groupContact) {
    ticket = await Ticket.findOne({
      where: {
        updatedAt: {
          [Op.between]: [+subHours(new Date(), 2), +new Date()]
        },
        contactId: contact.id,
        companyId,
        whatsappId
      },
      order: [["updatedAt", "DESC"]]
    });
```

por:

```typescript
  if (!ticket && !groupContact) {
    ticket = await Ticket.findOne({
      where: {
        status: {
          [Op.or]: ["open", "pending"]
        },
        updatedAt: {
          [Op.between]: [+subHours(new Date(), 2), +new Date()]
        },
        contactId: contact.id,
        companyId,
        whatsappId
      },
      order: [["updatedAt", "DESC"]]
    });
```

Não mexer em mais nada neste arquivo (bloco de `groupContact`, criação do ticket, `ShowTicketService` no final — tudo continua igual).

- [ ] **Passo 4: Rodar os testes de novo e confirmar que passam**

```bash
cd backend && npx jest src/services/TicketServices/__tests__/FindOrCreateTicketService.spec.ts --coverage=false
```

Esperado: 4 testes passando.

- [ ] **Passo 5: Rodar a suíte inteira e o type-check**

```bash
cd backend && npx tsc --noEmit && npx jest --coverage=false
```

Esperado: todos os testes do projeto passando (incluindo os que já existiam antes desta tarefa), `tsc` sem erros.

- [ ] **Passo 6: Commit**

```bash
git add backend/src/services/TicketServices/FindOrCreateTicketService.ts backend/src/services/TicketServices/__tests__/FindOrCreateTicketService.spec.ts
git commit -m "$(cat <<'EOF'
Para de reaproveitar tickets fechados ao criar/buscar ticket

FindOrCreateTicketService incluía "closed" na busca principal e não
filtrava status na busca de repescagem de 2h, fazendo qualquer contato
depois de um fechamento reabrir a conversa antiga (histórico e
protocolo antigos). Agora as duas buscas só consideram tickets
open/pending — depois de fechado, o próximo contato sempre cria um
atendimento novo.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Timeout e retry automático nas chamadas ao SGP

**Files:**
- Modify: `backend/src/services/SgpServices/SgpService.ts`
- Modify: `backend/src/services/SgpServices/__tests__/SgpService.spec.ts`

**Interfaces:**
- Produz: `withRetry<T>(fn: () => Promise<T>): Promise<T>` (função interna, não exportada) — usada pela Task 3 para pendurar o contador de falhas consecutivas e o alerta. A Task 3 espera que essa função já exista com essa assinatura antes de começar.

- [ ] **Passo 1: Atualizar as duas asserções existentes que checam os argumentos de `axios.post` (elas vão quebrar quando o timeout for adicionado)**

Em `backend/src/services/SgpServices/__tests__/SgpService.spec.ts`, trocar (dentro de `"retorna os dados do cliente quando o SGP encontra o contrato"`):

```typescript
    expect(axios.post).toHaveBeenCalledWith(
      "https://snitelecom.sgp.net.br/api/ura/consultacliente/",
      { token: "token-teste", app: "StoneChat", cpfcnpj: "12345678900" }
    );
```

por:

```typescript
    expect(axios.post).toHaveBeenCalledWith(
      "https://snitelecom.sgp.net.br/api/ura/consultacliente/",
      { token: "token-teste", app: "StoneChat", cpfcnpj: "12345678900" },
      { timeout: 8000 }
    );
```

E trocar (dentro de `"retorna sucesso com protocolo e data da promessa quando liberado (status 1, caso real)"`):

```typescript
    expect(axios.post).toHaveBeenCalledWith(
      "https://snitelecom.sgp.net.br/api/central/promessapagamento/",
      { cpfcnpj: "68197756953", senha: "09cz5dle", contrato: 1879 }
    );
```

por:

```typescript
    expect(axios.post).toHaveBeenCalledWith(
      "https://snitelecom.sgp.net.br/api/central/promessapagamento/",
      { cpfcnpj: "68197756953", senha: "09cz5dle", contrato: 1879 },
      { timeout: 8000 }
    );
```

- [ ] **Passo 2: Adicionar as asserções de retry nos 3 testes de falha já existentes**

No teste `"propaga o erro quando a chamada falha..."` de `SgpService.consultarCliente` (dentro do `describe("SgpService.consultarCliente")`), depois de `await expect(SgpService.consultarCliente("12345678900")).rejects.toThrow("timeout");`, adicionar:

```typescript
    expect(axios.post).toHaveBeenCalledTimes(2);
```

No teste `"propaga o erro quando a chamada falha..."` de `SgpService.buscarBoleto`, depois de `await expect(SgpService.buscarBoleto("05914704979")).rejects.toThrow("timeout");`, adicionar:

```typescript
    expect(axios.post).toHaveBeenCalledTimes(2);
```

No teste `"retorna motivo 'erro' pra falha de rede/timeout"` de `SgpService.liberarConfianca`, depois do bloco `expect(result).toEqual({...})`, adicionar:

```typescript
    expect(axios.post).toHaveBeenCalledTimes(2);
```

- [ ] **Passo 3: Adicionar um teste novo de recuperação (1ª tentativa falha, 2ª tentativa com sucesso)**

Dentro de `describe("SgpService.consultarCliente")`, adicionar (depois do teste "propaga o erro..."):

```typescript
  it("tenta de novo automaticamente quando a primeira chamada falha, usando o resultado da segunda tentativa", async () => {
    (axios.post as jest.Mock)
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce({
        data: {
          contratos: [
            {
              razaoSocial: "Edison Carlos",
              cpfCnpj: "12345678900",
              contratoStatusDisplay: "Ativo",
              clienteId: 42,
              contratoId: 99,
              contratoCentralSenha: "09cz5dle",
              telefones: []
            }
          ]
        }
      });

    const result = await SgpService.consultarCliente("12345678900");

    expect(result).not.toBeNull();
    expect(axios.post).toHaveBeenCalledTimes(2);
  });
```

- [ ] **Passo 4: Rodar os testes e confirmar que os passos 1-3 falham do jeito certo (ainda sem timeout/retry implementados)**

```bash
cd backend && npx jest src/services/SgpServices/__tests__/SgpService.spec.ts --coverage=false
```

Esperado: as duas asserções de timeout (passo 1) falham porque a chamada real ainda não tem o terceiro argumento; as de `toHaveBeenCalledTimes(2)` (passo 2) falham porque hoje só há 1 tentativa; o teste novo (passo 3) falha porque a segunda tentativa nunca acontece.

- [ ] **Passo 5: Implementar `withRetry` + timeout em `SgpService.ts`**

Adicionar logo depois de `const sgpToken = ...`:

```typescript
const SGP_TIMEOUT_MS = 8000;

// Pedido do Edison: falha isolada do SGP (timeout, instabilidade momentânea)
// não deve incomodar o cliente na hora - tenta mais uma vez automaticamente
// antes de desistir. Contador de falhas consecutivas e alerta de
// indisponibilidade ficam pendurados aqui pela Task 3 deste plano.
let consecutiveFailures = 0;

const withRetry = async <T>(fn: () => Promise<T>): Promise<T> => {
  try {
    const result = await fn();
    consecutiveFailures = 0;
    return result;
  } catch {
    try {
      const result = await fn();
      consecutiveFailures = 0;
      return result;
    } catch (err) {
      consecutiveFailures += 1;
      throw err;
    }
  }
};
```

Em `consultarCliente`, trocar:

```typescript
    const response = await axios.post(`${sgpUrl()}/api/ura/consultacliente/`, {
      token: sgpToken(),
      app: "StoneChat",
      cpfcnpj: cpfCnpj
    });
```

por:

```typescript
    const response = await withRetry(() =>
      axios.post(
        `${sgpUrl()}/api/ura/consultacliente/`,
        { token: sgpToken(), app: "StoneChat", cpfcnpj: cpfCnpj },
        { timeout: SGP_TIMEOUT_MS }
      )
    );
```

Em `buscarBoleto`, trocar:

```typescript
    const response = await axios.post(`${sgpUrl()}/api/ura/titulos/`, {
      token: sgpToken(),
      app: "StoneChat",
      cpfcnpj: cpfCnpj
    });
```

por:

```typescript
    const response = await withRetry(() =>
      axios.post(
        `${sgpUrl()}/api/ura/titulos/`,
        { token: sgpToken(), app: "StoneChat", cpfcnpj: cpfCnpj },
        { timeout: SGP_TIMEOUT_MS }
      )
    );
```

Em `liberarConfianca`, trocar:

```typescript
    const response = await axios.post(
      `${sgpUrl()}/api/central/promessapagamento/`,
      { cpfcnpj: cpfCnpj, senha: senhaCentral, contrato: contratoId }
    );
```

por:

```typescript
    const response = await withRetry(() =>
      axios.post(
        `${sgpUrl()}/api/central/promessapagamento/`,
        { cpfcnpj: cpfCnpj, senha: senhaCentral, contrato: contratoId },
        { timeout: SGP_TIMEOUT_MS }
      )
    );
```

Não mexer em mais nada (a lógica de interpretar a resposta, os `catch` externos de cada função, os tipos exportados — tudo continua igual).

- [ ] **Passo 6: Rodar os testes e confirmar que passam**

```bash
cd backend && npx jest src/services/SgpServices/__tests__/SgpService.spec.ts --coverage=false
```

Esperado: todos os testes passando, incluindo os 4 ajustados/criados nesta tarefa.

- [ ] **Passo 7: Rodar a suíte inteira e o type-check**

```bash
cd backend && npx tsc --noEmit && npx jest --coverage=false
```

- [ ] **Passo 8: Commit**

```bash
git add backend/src/services/SgpServices/SgpService.ts backend/src/services/SgpServices/__tests__/SgpService.spec.ts
git commit -m "$(cat <<'EOF'
Adiciona timeout e retry automático nas chamadas ao SGP

As 3 funções de SgpService (consultarCliente, buscarBoleto,
liberarConfianca) chamavam o SGP sem timeout configurado e sem retry -
uma instabilidade momentânea já fazia o cliente ouvir que a consulta
falhou. Agora cada chamada tem timeout de 8s e tenta mais uma vez
automaticamente antes de propagar/retornar erro.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Alerta de indisponibilidade do SGP via WhatsApp

**Files:**
- Create: `backend/src/helpers/SgpOutageAlert.ts`
- Create: `backend/src/helpers/__tests__/SgpOutageAlert.spec.ts`
- Modify: `backend/src/services/SgpServices/SgpService.ts`
- Modify: `backend/src/services/SgpServices/__tests__/SgpService.spec.ts`

**Interfaces:**
- Consome: `withRetry` já existente em `SgpService.ts` (Task 2) — este passo pendura o contador de falhas e o alerta nela.
- Consome: `GetDefaultWhatsApp(companyId: number): Promise<Whatsapp>` (default export de `backend/src/helpers/GetDefaultWhatsApp.ts`, já existe) e `getWbot(whatsappId: number): Session` (named export de `backend/src/libs/wbot.ts`, já existe).
- Produz: `notifySgpOutage(): Promise<void>` (named export de `SgpOutageAlert.ts`) — nunca lança exceção (todo erro interno é capturado e logado).

- [ ] **Passo 1: Escrever o teste de `SgpOutageAlert.ts` (ele ainda não existe)**

Criar `backend/src/helpers/__tests__/SgpOutageAlert.spec.ts`:

```typescript
jest.mock("../GetDefaultWhatsApp", () => ({
  __esModule: true,
  default: jest.fn()
}));
jest.mock("../../libs/wbot", () => ({
  getWbot: jest.fn()
}));

// eslint-disable-next-line import/first
import GetDefaultWhatsApp from "../GetDefaultWhatsApp";
// eslint-disable-next-line import/first
import { getWbot } from "../../libs/wbot";
// eslint-disable-next-line import/first
import { notifySgpOutage } from "../SgpOutageAlert";

describe("notifySgpOutage", () => {
  beforeEach(() => jest.clearAllMocks());

  it("manda a mensagem de alerta pro grupo NOC Avisos SNI usando a conexão padrão da empresa (companyId 1)", async () => {
    const sendMessage = jest.fn().mockResolvedValue({});
    (GetDefaultWhatsApp as jest.Mock).mockResolvedValue({ id: 7 });
    (getWbot as jest.Mock).mockReturnValue({ sendMessage });

    await notifySgpOutage();

    expect(GetDefaultWhatsApp).toHaveBeenCalledWith(1);
    expect(getWbot).toHaveBeenCalledWith(7);
    expect(sendMessage).toHaveBeenCalledWith(
      "120363410164424155@g.us",
      expect.objectContaining({ text: expect.stringContaining("SGP") })
    );
  });

  it("não lança erro quando o envio falha (ex: bot ainda não é membro do grupo) - só loga", async () => {
    (GetDefaultWhatsApp as jest.Mock).mockRejectedValue(new Error("sem conexão configurada"));

    await expect(notifySgpOutage()).resolves.not.toThrow();
  });
});
```

- [ ] **Passo 2: Rodar o teste e confirmar que falha (o arquivo ainda não existe)**

```bash
cd backend && npx jest src/helpers/__tests__/SgpOutageAlert.spec.ts --coverage=false
```

Esperado: falha com "Cannot find module '../SgpOutageAlert'".

- [ ] **Passo 3: Implementar `SgpOutageAlert.ts`**

Criar `backend/src/helpers/SgpOutageAlert.ts`:

```typescript
import * as Sentry from "@sentry/node";
import { logger } from "../utils/logger";
import GetDefaultWhatsApp from "./GetDefaultWhatsApp";
import { getWbot } from "../libs/wbot";

const NOC_GROUP_JID = "120363410164424155@g.us";
const SNI_TELECOM_COMPANY_ID = 1;

// Pedido do Edison: avisar o grupo de monitoramento (NOC Avisos SNI) quando o
// SGP acumular falhas consecutivas de verdade (ver SgpService.withRetry).
// Pré-requisito operacional: o número do StoneChat precisa ser membro desse
// grupo - se ainda não for, o envio falha e só loga o erro, sem quebrar a
// resposta ao cliente que disparou a falha original.
export const notifySgpOutage = async (): Promise<void> => {
  try {
    const connection = await GetDefaultWhatsApp(SNI_TELECOM_COMPANY_ID);
    const wbot = getWbot(connection.id);
    await wbot.sendMessage(NOC_GROUP_JID, {
      text: "⚠️ SGP parece fora do ar: 3 falhas seguidas ao consultar o SGP pelo StoneChat."
    });
  } catch (err) {
    Sentry.captureException(err);
    logger.error(`[SgpOutageAlert] falha ao notificar indisponibilidade do SGP: ${err}`);
  }
};
```

- [ ] **Passo 4: Rodar o teste e confirmar que passa**

```bash
cd backend && npx jest src/helpers/__tests__/SgpOutageAlert.spec.ts --coverage=false
```

- [ ] **Passo 5: Escrever os testes do contador de falhas em `SgpService.spec.ts`**

No topo de `backend/src/services/SgpServices/__tests__/SgpService.spec.ts`, adicionar o mock (antes do `jest.mock("axios")` já existente, ou logo depois — mantendo os `jest.mock` sempre no topo do arquivo):

```typescript
jest.mock("../../../helpers/SgpOutageAlert", () => ({
  __esModule: true,
  notifySgpOutage: jest.fn().mockResolvedValue(undefined)
}));
```

E o import correspondente, junto dos outros imports já existentes:

```typescript
// eslint-disable-next-line import/first
import { notifySgpOutage } from "../../../helpers/SgpOutageAlert";
```

Adicionar um novo `describe` no final do arquivo (depois do `describe("SgpService.liberarConfianca", ...)`):

```typescript
describe("SgpService - alerta de indisponibilidade", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SGP_URL = "https://snitelecom.sgp.net.br";
    process.env.SGP_TOKEN = "token-teste";
  });

  it("dispara o alerta ao acumular 3 falhas seguidas, contando as 3 funções juntas", async () => {
    (axios.post as jest.Mock).mockRejectedValue(new Error("timeout"));

    await expect(SgpService.consultarCliente("111")).rejects.toThrow();
    await expect(SgpService.buscarBoleto("222")).rejects.toThrow();
    expect(notifySgpOutage).not.toHaveBeenCalled();

    await SgpService.liberarConfianca("333", "senha", 1);

    expect(notifySgpOutage).toHaveBeenCalledTimes(1);
  });

  it("zera o contador de falhas em qualquer sucesso, evitando disparar o alerta com falhas não-seguidas", async () => {
    (axios.post as jest.Mock)
      .mockRejectedValueOnce(new Error("timeout"))
      .mockRejectedValueOnce(new Error("timeout"));
    await expect(SgpService.consultarCliente("111")).rejects.toThrow();

    (axios.post as jest.Mock).mockResolvedValueOnce({ data: { titulos: [] } });
    await SgpService.buscarBoleto("222");

    (axios.post as jest.Mock)
      .mockRejectedValueOnce(new Error("timeout"))
      .mockRejectedValueOnce(new Error("timeout"));
    await SgpService.liberarConfianca("333", "senha", 1);

    expect(notifySgpOutage).not.toHaveBeenCalled();
  });

  it("não repete o alerta em falhas subsequentes depois de já ter cruzado 3 seguidas", async () => {
    (axios.post as jest.Mock).mockRejectedValue(new Error("timeout"));

    await expect(SgpService.consultarCliente("1")).rejects.toThrow();
    await expect(SgpService.buscarBoleto("2")).rejects.toThrow();
    await SgpService.liberarConfianca("3", "senha", 1);
    await expect(SgpService.consultarCliente("4")).rejects.toThrow();

    expect(notifySgpOutage).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Passo 6: Rodar os testes e confirmar que falham (o contador ainda não chama `notifySgpOutage`)**

```bash
cd backend && npx jest src/services/SgpServices/__tests__/SgpService.spec.ts --coverage=false
```

Esperado: os 3 testes novos falham porque `notifySgpOutage` nunca é chamado hoje.

- [ ] **Passo 7: Ligar o contador ao alerta em `SgpService.ts`**

Adicionar o import no topo do arquivo, junto dos outros:

```typescript
import { notifySgpOutage } from "../../helpers/SgpOutageAlert";
```

Em `withRetry` (criada na Task 2), adicionar a constante do limiar logo acima e chamar o alerta dentro do `catch` mais interno:

```typescript
const SGP_ALERT_THRESHOLD = 3;
let consecutiveFailures = 0;

const withRetry = async <T>(fn: () => Promise<T>): Promise<T> => {
  try {
    const result = await fn();
    consecutiveFailures = 0;
    return result;
  } catch {
    try {
      const result = await fn();
      consecutiveFailures = 0;
      return result;
    } catch (err) {
      consecutiveFailures += 1;
      if (consecutiveFailures === SGP_ALERT_THRESHOLD) {
        await notifySgpOutage();
      }
      throw err;
    }
  }
};
```

(Isso substitui o corpo de `withRetry` escrito na Task 2 — a única mudança é a declaração de `SGP_ALERT_THRESHOLD` e o bloco `if` dentro do segundo `catch`.)

- [ ] **Passo 8: Rodar os testes e confirmar que passam**

```bash
cd backend && npx jest src/services/SgpServices/__tests__/SgpService.spec.ts --coverage=false
```

- [ ] **Passo 9: Rodar a suíte inteira e o type-check**

```bash
cd backend && npx tsc --noEmit && npx jest --coverage=false
```

- [ ] **Passo 10: Commit**

```bash
git add backend/src/helpers/SgpOutageAlert.ts backend/src/helpers/__tests__/SgpOutageAlert.spec.ts backend/src/services/SgpServices/SgpService.ts backend/src/services/SgpServices/__tests__/SgpService.spec.ts
git commit -m "$(cat <<'EOF'
Alerta via WhatsApp quando o SGP acumula 3 falhas consecutivas

Novo helper SgpOutageAlert.ts manda aviso pro grupo NOC Avisos SNI
usando a conexão WhatsApp padrão da empresa. SgpService conta falhas
consecutivas das 3 funções juntas (zera em qualquer sucesso) e aciona
o alerta ao cruzar 3 - sem repetir enquanto o SGP continuar fora do ar.

Pré-requisito operacional: o número do StoneChat precisa ser
adicionado manualmente ao grupo NOC Avisos SNI antes do alerta
funcionar de verdade (confirmado com o Edison).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Depois de todas as tarefas

- [ ] Rebuild e redeploy do backend em produção:

```bash
cd /home/edison/fontes/stonechat
docker compose build stonechat_backend
docker stop stonechat_backend && docker rm stonechat_backend
docker compose up -d --no-deps stonechat_backend
```

- [ ] Avisar o Edison que o alerta de indisponibilidade do SGP só funciona de verdade depois que o número do StoneChat for adicionado ao grupo NOC Avisos SNI (ação manual dele, fora do código).
