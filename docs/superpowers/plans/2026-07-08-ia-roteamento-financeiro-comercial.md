# IA — Roteamento Financeiro/Comercial e Bloqueio Técnico Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A IA do StoneChat passa a reconhecer pedidos de setor Financeiro e Comercial (hoje só Atendimento/Técnico existem), e antes de transferir pro Técnico, verifica no SGP se a conexão está suspensa por pendência financeira — se estiver, avisa o cliente e transfere direto pro Financeiro em vez do Técnico.

**Architecture:** Reaproveita 100% o mecanismo de frase-gatilho já existente em `AiAgentActions.ts`/`dispatchAiAction` (ver `docs/superpowers/specs/2026-07-07-agente-ia-atendimento-sgp-design.md` e `docs/superpowers/specs/2026-07-08-painel-atendimento-ia-design.md`, Parte 2). Nenhuma tabela nova — só dois campos novos mapeados da resposta já existente do SGP (`motivo_status`, `contratoValorAberto`), dois marcadores novos, e um handler novo que decide Técnico vs Financeiro.

**Tech Stack:** Node.js/TypeScript, Jest (`ts-jest`), Sequelize, axios (SGP), Baileys (`@whiskeysockets/baileys`).

## Global Constraints

- Toda mudança de comportamento (SgpService, AiAgentActions) precisa de teste Jest cobrindo o caso novo, seguindo exatamente o padrão de mocks já usado em `backend/src/services/WbotServices/__tests__/AiAgentActions.spec.ts` e `backend/src/services/SgpServices/__tests__/SgpService.spec.ts` (jest.mock por módulo, sem framework de fixture).
- Rodar `npm test` de dentro de `backend/` (`NODE_ENV=test jest`) depois de cada passo de implementação — nunca marcar uma tarefa como concluída com teste falhando.
- Falha de rede/timeout ou CPF não encontrado no SGP nunca pode travar o atendimento — sempre cair no fluxo padrão (transferir pro Técnico), igual ao padrão já usado em `handleBuscarBoletoAction`/`handleLiberarConfiancaAction` pra timeout do SGP.
- Nenhuma migration — os campos novos (`motivo_status`, `contratoValorAberto`) já vêm na resposta real do SGP, só não estavam mapeados na interface `SgpCliente`.
- Commits em português, um por passo de "implementação + teste passando", seguindo o estilo dos commits já existentes no repositório (`git log --oneline` pra conferir o tom).

---

## Task 1: `SgpService` — mapear `motivoStatus` e `valorEmAberto`

**Files:**
- Modify: `backend/src/services/SgpServices/SgpService.ts:1-50`
- Test: `backend/src/services/SgpServices/__tests__/SgpService.spec.ts:8-47`

**Interfaces:**
- Produces: `SgpCliente.motivoStatus: string` e `SgpCliente.valorEmAberto: number`, usados pela Task 3 (`handleTransferirTecnicoAction`).

- [ ] **Step 1: Atualizar o teste existente pra incluir os campos novos**

Em `backend/src/services/SgpServices/__tests__/SgpService.spec.ts`, no primeiro teste do describe `SgpService.consultarCliente` ("retorna os dados do cliente quando o SGP encontra o contrato"), adicione `motivo_status` e `contratoValorAberto` no mock de resposta, e os campos correspondentes no `toEqual` esperado:

```ts
  it("retorna os dados do cliente quando o SGP encontra o contrato", async () => {
    (axios.post as jest.Mock).mockResolvedValue({
      data: {
        msg: "Contrato(s) Localizado(s)",
        contratos: [
          {
            razaoSocial: "Edison Carlos",
            cpfCnpj: "12345678900",
            contratoStatusDisplay: "Ativo",
            motivo_status: "Nenhum",
            contratoValorAberto: 0,
            clienteId: 42,
            contratoId: 99,
            contratoCentralSenha: "09cz5dle",
            telefones: [{ inscricoes: [], tipoContato: "Celular Pessoal", contato: "(43) 98851-5951" }]
          }
        ]
      }
    });

    const result = await SgpService.consultarCliente("12345678900");

    expect(result).toEqual({
      nome: "Edison Carlos",
      cpfCnpj: "12345678900",
      contratoStatus: "Ativo",
      motivoStatus: "Nenhum",
      valorEmAberto: 0,
      clienteId: 42,
      contratoId: 99,
      centralSenha: "09cz5dle",
      telefones: ["(43) 98851-5951"]
    });
    expect(axios.post).toHaveBeenCalledWith(
      "https://snitelecom.sgp.net.br/api/ura/consultacliente/",
      { token: "token-teste", app: "StoneChat", cpfcnpj: "12345678900" }
    );
  });
```

Logo abaixo desse teste (ainda dentro do describe `SgpService.consultarCliente`), adicione um teste novo com o payload real capturado ao vivo contra o CPF 069.706.349-65 (cliente genuinamente suspenso por débito):

```ts
  it("retorna motivoStatus e valorEmAberto quando o contrato está suspenso por pendência financeira (caso real: CPF 069.706.349-65)", async () => {
    (axios.post as jest.Mock).mockResolvedValue({
      data: {
        msg: "Contrato(s) Localizado(s)",
        contratos: [
          {
            razaoSocial: "JOCIELE DE CAMPOS MELLO",
            cpfCnpj: "069.706.349-65",
            contratoStatusDisplay: "Suspenso",
            motivo_status: "Financeiro",
            contratoValorAberto: 201.48,
            clienteId: 1591,
            contratoId: 2015,
            contratoCentralSenha: "vehoc4he",
            telefones: [{ inscricoes: [], tipoContato: "Celular Pessoal", contato: "(43) 99909-0524" }]
          }
        ]
      }
    });

    const result = await SgpService.consultarCliente("06970634965");

    expect(result).toEqual({
      nome: "JOCIELE DE CAMPOS MELLO",
      cpfCnpj: "069.706.349-65",
      contratoStatus: "Suspenso",
      motivoStatus: "Financeiro",
      valorEmAberto: 201.48,
      clienteId: 1591,
      contratoId: 2015,
      centralSenha: "vehoc4he",
      telefones: ["(43) 99909-0524"]
    });
  });
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `cd backend && npx jest SgpService --verbose`
Expected: FAIL — os dois testes acima falham porque `result` não tem `motivoStatus`/`valorEmAberto` (a interface/mapeamento ainda não existe).

- [ ] **Step 3: Implementar o mapeamento**

Em `backend/src/services/SgpServices/SgpService.ts`, atualize a interface `SgpCliente`:

```ts
export interface SgpCliente {
  nome: string;
  cpfCnpj: string;
  contratoStatus: string;
  motivoStatus: string;
  valorEmAberto: number;
  clienteId: number;
  contratoId: number;
  centralSenha: string;
  telefones: string[];
}
```

E o retorno de `consultarCliente` (dentro do `try`, dentro da função existente):

```ts
    const c = contratos[0];
    return {
      nome: c.razaoSocial ?? "",
      cpfCnpj: c.cpfCnpj ?? "",
      contratoStatus: c.contratoStatusDisplay ?? "",
      motivoStatus: c.motivo_status ?? "",
      valorEmAberto: c.contratoValorAberto ?? 0,
      clienteId: c.clienteId ?? 0,
      contratoId: c.contratoId ?? 0,
      centralSenha: c.contratoCentralSenha ?? "",
      telefones: Array.isArray(c.telefones)
        ? c.telefones.map((t: { contato?: string }) => t.contato ?? "").filter(Boolean)
        : []
    };
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `cd backend && npx jest SgpService --verbose`
Expected: PASS — todos os testes de `SgpService.consultarCliente` passam, incluindo os dois editados/novos.

- [ ] **Step 5: Rodar a suíte inteira do backend pra garantir que nada mais quebrou**

Run: `cd backend && npm test`
Expected: PASS em todos os arquivos (`SgpService.spec.ts` e `AiAgentActions.spec.ts` continuam verdes — `AiAgentActions.spec.ts` usa `jest.mock("../../SgpServices/SgpService", ...)`, então não é afetado pela mudança de schema real).

- [ ] **Step 6: Commit**

```bash
cd /home/edison/fontes/stonechat
git add backend/src/services/SgpServices/SgpService.ts backend/src/services/SgpServices/__tests__/SgpService.spec.ts
git commit -m "$(cat <<'EOF'
Mapeia motivoStatus e valorEmAberto na consulta SGP

Campos já vêm na resposta real da API (motivo_status,
contratoValorAberto) e serão usados pra detectar bloqueio por
pendência financeira antes de transferir pro setor Técnico.
EOF
)"
```

---

## Task 2: `AiAgentActions` — gatilhos de Financeiro e Comercial

**Files:**
- Modify: `backend/src/services/WbotServices/AiAgentActions.ts:12-18` (marcadores) e `:222-264` (`dispatchAiAction`)
- Test: `backend/src/services/WbotServices/__tests__/AiAgentActions.spec.ts` (describe `dispatchAiAction`)

**Interfaces:**
- Consumes: `transferToQueueByName(queueName: string, ticket: Ticket, companyId: number): Promise<boolean>` (já existe em `AiAgentActions.ts:51-65`).
- Produces: dois novos ramos em `dispatchAiAction` que reagem aos marcadores `"Ação: Transferir para Financeiro"` e `"Ação: Transferir para Comercial"`.

- [ ] **Step 1: Escrever os testes que falham**

Adicione ao final do describe `dispatchAiAction` em `backend/src/services/WbotServices/__tests__/AiAgentActions.spec.ts` (depois do teste "remove a frase-gatilho e transfere para Técnico"):

```ts
  it("remove a frase-gatilho e transfere para Financeiro", async () => {
    (Queue.findOne as jest.Mock).mockResolvedValue({ id: 3 });

    const result = await dispatchAiAction(
      "Vou te passar pro financeiro. Ação: Transferir para Financeiro",
      ticket,
      contact,
      wbot,
      1
    );

    expect(result).toBe("Vou te passar pro financeiro.");
    expect(Queue.findOne).toHaveBeenCalledWith({
      where: { name: "Financeiro", companyId: 1 }
    });
  });

  it("remove a frase-gatilho e transfere para Comercial", async () => {
    (Queue.findOne as jest.Mock).mockResolvedValue({ id: 4 });

    const result = await dispatchAiAction(
      "Vou te passar pro comercial. Ação: Transferir para Comercial",
      ticket,
      contact,
      wbot,
      1
    );

    expect(result).toBe("Vou te passar pro comercial.");
    expect(Queue.findOne).toHaveBeenCalledWith({
      where: { name: "Comercial", companyId: 1 }
    });
  });
```

- [ ] **Step 2: Rodar e confirmar que falham**

Run: `cd backend && npx jest AiAgentActions -t "Financeiro|Comercial" --verbose`
Expected: FAIL — `dispatchAiAction` ainda retorna o texto original sem remover a frase-gatilho (nenhum marcador `transferirFinanceiro`/`transferirComercial` existe ainda).

- [ ] **Step 3: Implementar**

Em `backend/src/services/WbotServices/AiAgentActions.ts`, atualize `ACTION_MARKERS`:

```ts
const ACTION_MARKERS = {
  transferirAtendimento: "Ação: Transferir para Atendimento",
  transferirTecnico: "Ação: Transferir para Técnico",
  transferirFinanceiro: "Ação: Transferir para Financeiro",
  transferirComercial: "Ação: Transferir para Comercial",
  buscarBoleto: "Ação: Buscar Boleto",
  liberarConfianca: "Ação: Liberar Confiança",
  desvincularCpf: "Ação: Desvincular CPF"
} as const;
```

E em `dispatchAiAction`, logo depois do bloco `if (responseText.includes(ACTION_MARKERS.transferirTecnico))` (antes do bloco `buscarBoleto`):

```ts
  if (responseText.includes(ACTION_MARKERS.transferirFinanceiro)) {
    await transferToQueueByName("Financeiro", ticket, companyId);
    return responseText.replace(ACTION_MARKERS.transferirFinanceiro, "").trim();
  }

  if (responseText.includes(ACTION_MARKERS.transferirComercial)) {
    await transferToQueueByName("Comercial", ticket, companyId);
    return responseText.replace(ACTION_MARKERS.transferirComercial, "").trim();
  }
```

- [ ] **Step 4: Rodar e confirmar que passam**

Run: `cd backend && npx jest AiAgentActions --verbose`
Expected: PASS em todos os testes do arquivo.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/WbotServices/AiAgentActions.ts backend/src/services/WbotServices/__tests__/AiAgentActions.spec.ts
git commit -m "$(cat <<'EOF'
Adiciona gatilhos de IA para transferência a Financeiro e Comercial

Mesmo padrão de frase-gatilho já usado para Atendimento/Técnico.
Sem eles, pedidos de negociação de dívida ou de planos/contratação
caiam sempre em Atendimento genérico.
EOF
)"
```

---

## Task 3: `handleTransferirTecnicoAction` — bloqueio financeiro antes do Técnico

**Files:**
- Modify: `backend/src/services/WbotServices/AiAgentActions.ts` (nova função, e o ramo `transferirTecnico` em `dispatchAiAction`)
- Test: `backend/src/services/WbotServices/__tests__/AiAgentActions.spec.ts`

**Interfaces:**
- Consumes: `SgpService.consultarCliente(cpfCnpj: string): Promise<SgpCliente | null>` (Task 1, campos `motivoStatus`/`valorEmAberto`); `transferToQueueByName`; `formatBody` (já importado no topo do arquivo); `wbot.sendMessage`.
- Produces: `handleTransferirTecnicoAction(cpfCnpj: string, ticket: Ticket, contact: Contact, wbot: WASocket, companyId: number): Promise<void>`, exportada (mesmo padrão de `handleBuscarBoletoAction`).

- [ ] **Step 1: Escrever os testes que falham**

Adicione um novo describe em `backend/src/services/WbotServices/__tests__/AiAgentActions.spec.ts`, logo depois do describe `handleLiberarConfiancaAction` (antes de `handleDesvincularCpfAction`). Também atualize o import no topo do arquivo pra incluir `handleTransferirTecnicoAction`:

```ts
import { registerAiAttendance, transferToQueueByName, handleBuscarBoletoAction, handleLiberarConfiancaAction, handleTransferirTecnicoAction, handleDesvincularCpfAction, dispatchAiAction, isAiHandledTicket } from "../AiAgentActions";
```

```ts
describe("handleTransferirTecnicoAction", () => {
  const wbot = { sendMessage: jest.fn().mockResolvedValue({}) } as any;
  const ticket = { id: 26, companyId: 1 } as any;
  const contact = { number: "554399332300" } as any;

  beforeEach(() => jest.clearAllMocks());

  it("transfere pro Técnico quando não há bloqueio financeiro", async () => {
    (SgpService.consultarCliente as jest.Mock).mockResolvedValue({
      motivoStatus: "Nenhum",
      valorEmAberto: 0
    });
    (Queue.findOne as jest.Mock).mockResolvedValue({ id: 2 });

    await handleTransferirTecnicoAction("12345678900", ticket, contact, wbot, 1);

    expect(wbot.sendMessage).not.toHaveBeenCalled();
    expect(Queue.findOne).toHaveBeenCalledWith({
      where: { name: "Técnico", companyId: 1 }
    });
    expect(UpdateTicketService).toHaveBeenCalledWith({
      ticketData: { queueId: 2, useIntegration: false, promptId: null },
      ticketId: 26,
      companyId: 1
    });
  });

  it("avisa o cliente e transfere pro Financeiro quando a conexão está suspensa por pendência financeira (caso real: CPF 069.706.349-65)", async () => {
    (SgpService.consultarCliente as jest.Mock).mockResolvedValue({
      motivoStatus: "Financeiro",
      valorEmAberto: 201.48
    });
    (Queue.findOne as jest.Mock).mockResolvedValue({ id: 3 });

    await handleTransferirTecnicoAction("06970634965", ticket, contact, wbot, 1);

    expect(wbot.sendMessage).toHaveBeenCalled();
    const sentText = (wbot.sendMessage as jest.Mock).mock.calls[0][1].text;
    expect(sentText).toContain("pendência financeira");
    expect(sentText).toContain("201,48");
    expect(Queue.findOne).toHaveBeenCalledWith({
      where: { name: "Financeiro", companyId: 1 }
    });
    expect(UpdateTicketService).toHaveBeenCalledWith({
      ticketData: { queueId: 3, useIntegration: false, promptId: null },
      ticketId: 26,
      companyId: 1
    });
  });

  it("transfere pro Técnico quando o SGP não encontra o cliente (nunca trava o atendimento técnico)", async () => {
    (SgpService.consultarCliente as jest.Mock).mockResolvedValue(null);
    (Queue.findOne as jest.Mock).mockResolvedValue({ id: 2 });

    await handleTransferirTecnicoAction("00000000000", ticket, contact, wbot, 1);

    expect(wbot.sendMessage).not.toHaveBeenCalled();
    expect(Queue.findOne).toHaveBeenCalledWith({
      where: { name: "Técnico", companyId: 1 }
    });
  });
});
```

Depois, atualize o teste existente `dispatchAiAction > "remove a frase-gatilho e transfere para Técnico"` (ele já usa `contact` com `cpfCnpj: "12345678900"` no topo do describe `dispatchAiAction` — sem mudança necessária no teste em si, só precisa continuar passando depois da Step 3, porque `SgpService.consultarCliente` sem `mockResolvedValue` configurado nesse teste específico resolve `undefined`, e `handleTransferirTecnicoAction` trata isso como "sem bloqueio" e cai no Técnico normalmente).

- [ ] **Step 2: Rodar e confirmar que falham**

Run: `cd backend && npx jest AiAgentActions -t "handleTransferirTecnicoAction" --verbose`
Expected: FAIL com `TypeError: handleTransferirTecnicoAction is not a function` (a função ainda não existe).

- [ ] **Step 3: Implementar**

Em `backend/src/services/WbotServices/AiAgentActions.ts`, adicione a função nova logo depois de `handleLiberarConfiancaAction` (antes de `handleDesvincularCpfAction`):

```ts
export const handleTransferirTecnicoAction = async (
  cpfCnpj: string,
  ticket: Ticket,
  contact: Contact,
  wbot: WASocket,
  companyId: number
): Promise<void> => {
  const cliente = await SgpService.consultarCliente(cpfCnpj);

  if (cliente && cliente.motivoStatus === "Financeiro") {
    const valorTexto = cliente.valorEmAberto
      ? ` (R$ ${cliente.valorEmAberto.toFixed(2).replace(".", ",")} em aberto)`
      : "";

    await wbot.sendMessage(jidOf(contact), {
      text: formatBody(
        `Antes de te passar pro time técnico, notei que sua conexão está suspensa por pendência financeira${valorTexto}. Vou te encaminhar direto pro setor Financeiro pra resolver isso primeiro.`,
        contact
      )
    });
    await transferToQueueByName("Financeiro", ticket, companyId);
    return;
  }

  await transferToQueueByName("Técnico", ticket, companyId);
};
```

E troque o ramo `transferirTecnico` de `dispatchAiAction` (que hoje chama `transferToQueueByName` direto) por:

```ts
  if (responseText.includes(ACTION_MARKERS.transferirTecnico)) {
    const cleaned = responseText.replace(ACTION_MARKERS.transferirTecnico, "").trim();
    if (cpfCnpj) {
      await handleTransferirTecnicoAction(cpfCnpj, ticket, contact, wbot, companyId);
    }
    return cleaned;
  }
```

(mesmo padrão de guarda `if (cpfCnpj)` já usado nos ramos `buscarBoleto`/`liberarConfianca` — sem CPF conhecido, a frase-gatilho é removida mas nada é transferido, porque o prompt da Task 4 vai instruir a IA a pedir o CPF antes de emitir esse marcador).

- [ ] **Step 4: Rodar e confirmar que passam**

Run: `cd backend && npx jest AiAgentActions --verbose`
Expected: PASS em todos os testes do arquivo, incluindo os 3 novos de `handleTransferirTecnicoAction` e o teste antigo de transferência pro Técnico dentro de `dispatchAiAction`.

- [ ] **Step 5: Rodar a suíte inteira**

Run: `cd backend && npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/WbotServices/AiAgentActions.ts backend/src/services/WbotServices/__tests__/AiAgentActions.spec.ts
git commit -m "$(cat <<'EOF'
Verifica bloqueio financeiro antes de transferir pro setor Técnico

Se o SGP indicar motivoStatus=Financeiro, avisa o cliente do valor em
aberto e transfere direto pro Financeiro, pulando o Técnico. Sem
checagem de telefone aqui (decisão de negócio: confia no CPF
informado mesmo que o número não bata com o cadastro do SGP). Exige
CPF conhecido antes de completar a transferência técnica, mesmo
padrão já usado em Buscar Boleto/Liberar Confiança.
EOF
)"
```

---

## Task 4: Prompt da IA — novos gatilhos e exigência de CPF antes do Técnico

**Files:**
- Modify: `backend/src/services/WbotServices/wbotMessageListener.ts:712-725`

**Interfaces:**
- Não expõe interface nova — é só o texto que vai pro modelo da OpenAI. Sem teste automatizado possível (a string é montada inline dentro de `handleOpenAi`, não é uma função pura exportada, e não existe nenhum teste hoje pra esse arquivo).

- [ ] **Step 1: Ler o trecho atual pra confirmar que bate com o plano**

Run: `sed -n '712,725p' backend/src/services/WbotServices/wbotMessageListener.ts`

Expected (texto atual, sem as linhas novas):
```
Quando o cliente quiser falar com um atendente humano, termine sua resposta com a frase exata 'Ação: Transferir para Atendimento'.
Quando o cliente relatar um problema técnico (sem conexão, lentidão, equipamento com defeito), termine sua resposta com a frase exata 'Ação: Transferir para Técnico'.
Quando o cliente pedir boleto, 2ª via, fatura ou PIX, e o CPF/CNPJ já for conhecido, termine sua resposta com a frase exata 'Ação: Buscar Boleto'.
Quando o cliente pedir para liberar/religar a conexão por confiança (mesmo estando em débito), e o CPF/CNPJ já for conhecido, termine sua resposta com a frase exata 'Ação: Liberar Confiança'.
Quando o cliente disser que esse não é o CPF/CNPJ dele, quiser trocar o CPF cadastrado, ou pedir pra desvincular o número, termine sua resposta com a frase exata 'Ação: Desvincular CPF'.
```

- [ ] **Step 2: Editar o texto**

Substitua o bloco acima (dentro da template string `promptSystem`, `backend/src/services/WbotServices/wbotMessageListener.ts:719-723`) por:

```
Quando o cliente quiser falar com um atendente humano, termine sua resposta com a frase exata 'Ação: Transferir para Atendimento'.
Quando o cliente relatar um problema técnico (sem conexão, lentidão, equipamento com defeito), e o CPF/CNPJ já for conhecido, termine sua resposta com a frase exata 'Ação: Transferir para Técnico'. Se o CPF/CNPJ ainda não for conhecido, peça-o primeiro.
Quando o cliente pedir negociação de dívida, 2ª via de fatura antiga, ou quiser falar sobre pagamento em atraso, termine sua resposta com a frase exata 'Ação: Transferir para Financeiro'.
Quando o cliente perguntar sobre planos novos, upgrade, contratação de serviço adicional ou mudança de plano, termine sua resposta com a frase exata 'Ação: Transferir para Comercial'.
Quando o cliente pedir boleto, 2ª via, fatura ou PIX, e o CPF/CNPJ já for conhecido, termine sua resposta com a frase exata 'Ação: Buscar Boleto'.
Quando o cliente pedir para liberar/religar a conexão por confiança (mesmo estando em débito), e o CPF/CNPJ já for conhecido, termine sua resposta com a frase exata 'Ação: Liberar Confiança'.
Quando o cliente disser que esse não é o CPF/CNPJ dele, quiser trocar o CPF cadastrado, ou pedir pra desvincular o número, termine sua resposta com a frase exata 'Ação: Desvincular CPF'.
```

- [ ] **Step 3: Checar o tipo/build do backend**

Run: `cd backend && npx tsc --noEmit`
Expected: sem erros novos (é só uma mudança de literal de string).

- [ ] **Step 4: Rodar a suíte inteira do backend**

Run: `cd backend && npm test`
Expected: PASS (esse arquivo não tem teste próprio, então o comando só confirma que nada mais quebrou).

- [ ] **Step 5: Rebuild e teste manual end-to-end**

```bash
cd /home/edison/fontes/stonechat
docker compose build stonechat_backend
docker compose up -d --no-deps stonechat_backend
```

Manual: mandar uma mensagem de teste pelo WhatsApp conectado simulando um pedido técnico com um CPF conhecido que esteja com bloqueio financeiro real no SGP (ex: `069.706.349-65`, já confirmado suspenso por débito) e confirmar que a IA avisa do bloqueio e o ticket cai na fila **Financeiro** (não Técnico). Repetir com um CPF sem bloqueio e confirmar que cai em **Técnico**.

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/WbotServices/wbotMessageListener.ts
git commit -m "$(cat <<'EOF'
Ensina a IA a reconhecer Financeiro/Comercial e exigir CPF pro Técnico

Sem essas instruções no prompt, os marcadores novos de
Ação: Transferir para Financeiro/Comercial (adicionados no
AiAgentActions.ts) nunca eram emitidos pela IA.
EOF
)"
```

---

## Self-Review (preenchido durante a escrita do plano)

**Cobertura do spec (Parte 2 do design):**
- Novos gatilhos Financeiro/Comercial → Task 2. ✅
- Verificação de bloqueio financeiro antes do Técnico, com `motivo_status`/`contratoValorAberto` reais → Tasks 1 e 3. ✅
- Exigir CPF antes de completar transferência técnica → Task 3 (guarda `if (cpfCnpj)`) + Task 4 (texto do prompt). ✅
- Sem checagem de telefone nessa verificação (decisão do Edison) → Task 3 (`handleTransferirTecnicoAction` nunca chama `phoneOwnershipMatches`). ✅
- Liberação de confiança sem mudança → nenhuma task toca `handleLiberarConfiancaAction`. ✅

**Sem placeholders:** todos os passos têm código completo, comandos exatos e resultado esperado.

**Consistência de tipos:** `handleTransferirTecnicoAction` usa exatamente os mesmos tipos de parâmetro (`cpfCnpj: string, ticket: Ticket, contact: Contact, wbot: WASocket, companyId: number`) que `handleBuscarBoletoAction`/`handleLiberarConfiancaAction` já usam nesse arquivo; `SgpCliente.motivoStatus`/`valorEmAberto` (Task 1) são os mesmos nomes consumidos em `handleTransferirTecnicoAction` (Task 3).
