# Agente de IA de Atendimento (SNI Telecom) com integração SGP — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um agente de atendimento por IA no StoneChat, com perfil de provedor de internet (SNI Telecom), que identifica o cliente por CPF/CNPJ (persistente por WhatsApp), e resolve sozinho 4 intenções — falar com atendente, chamado técnico, 2ª via de boleto, e liberação de confiança — integrando com o SGP.

**Architecture:** Reaproveita o mecanismo de frase-gatilho já existente em `handleOpenAi` (`wbotMessageListener.ts`) — a IA sinaliza a ação por texto, o código executa deterministicamente. Novo módulo `AiAgentActions.ts` concentra o despacho e a execução das 4 ações. Novo `SgpService.ts` encapsula toda chamada HTTP ao SGP. Nenhuma mudança na integração OpenAI em si (mesmo SDK, mesmo `createChatCompletion`).

**Tech Stack:** TypeScript, Express, Sequelize (Postgres), axios, Jest + ts-jest, `@whiskeysockets/baileys`.

## Global Constraints

- Nunca hardcodar credenciais (`SGP_URL`, `SGP_TOKEN`) — sempre via variável de ambiente, seguindo o padrão já usado no SNILog e no restante do `docker-compose.yml` do StoneChat.
- **Confirmado em produção nesta sessão** (curl real contra `https://snitelecom.sgp.net.br`): o SGP valida o campo `app` do body contra um valor cadastrado junto ao token, **inclusive maiúsculas/minúsculas** — `app` errado gera 403 `"Credenciais de autenticação incorretas."`, mesmo com o token certo. O token do SNILog só aceita `app: "snilog"`. **Token novo, dedicado, já gerado pelo Edison e testado com sucesso**: `app: "StoneChat"` (exatamente essa capitalização — `"stonechat"` minúsculo dá 403). Valor real do token em `senhas.txt` / conferir com o Edison antes da Task 11 (não repetir aqui por ser credencial).
- **Confirmado em produção nesta sessão**, já com o token novo: não existe endpoint separado `/api/ura/clientes/` — o endpoint único `/api/ura/consultacliente/` (já usado no SNILog para busca por `login`) também aceita busca por CPF/CNPJ, mas o nome do parâmetro é **`cpfcnpj`** (sem underscore, sem espaço) — `cpf_cnpj` retorna erro genérico `"CPF/CNPJ ou Contrato ID Não informados"`. `/api/ura/fatura2via/` e `/api/ura/titulos/` existem, respondem 200 e usam o mesmo parâmetro `cpfcnpj`. O endpoint de liberação de confiança **não foi localizado** (5 nomes prováveis testados com o token do SNILog, todos 404 — o problema não era o `app`, esses paths genuinamente não existem) — fica como verificação obrigatória na Task 4, junto ao suporte do SGP.
- Toda ação que altera estado real (fechar ticket, transferir fila, liberar conexão) é executada por código determinístico — a IA nunca decide o resultado, só reconhece a intenção via frase-gatilho.
- Testes seguem o padrão já estabelecido no projeto: `jest`, mocks via `jest.mock(...)`, rodados dentro do estágio `builder` do Dockerfile (a imagem de produção não tem `jest.config.js`). Ver `backend/src/helpers/__tests__/GetMessageForRetry.spec.ts` como referência de estilo.
- Toda alteração de código é commitada ao final de cada task (não acumular múltiplas tasks num commit).
- Frases-gatilho exatas (não alterar sem atualizar `dispatchAiAction` e o texto sugerido do Prompt em conjunto):
  - `Ação: Transferir para Atendimento`
  - `Ação: Transferir para Técnico`
  - `Ação: Buscar Boleto`
  - `Ação: Liberar Confiança`

---

## File Structure

**Criar:**
- `backend/src/database/migrations/<timestamp>-add-cpfCnpj-to-contacts.ts` — migration
- `backend/src/services/SgpServices/SgpService.ts` — cliente HTTP do SGP (consulta, boleto, liberação)
- `backend/src/services/SgpServices/__tests__/SgpService.spec.ts`
- `backend/src/services/WbotServices/AiAgentActions.ts` — despacho de ação por frase-gatilho + as 4 execuções
- `backend/src/services/WbotServices/__tests__/AiAgentActions.spec.ts`

**Modificar:**
- `backend/src/models/Contact.ts` — novo campo `cpfCnpj`
- `backend/src/services/WbotServices/wbotMessageListener.ts` — `handleOpenAi`: captura de CPF, contexto no `promptSystem`, chamada a `dispatchAiAction`
- `backend/.env.example`, `docker-compose.yml` — novas vars `SGP_URL`, `SGP_TOKEN`

---

### Task 1: Migration + campo `cpfCnpj` no Contact

**Files:**
- Create: `backend/src/database/migrations/20260707120000-add-cpfCnpj-to-contacts.ts`
- Modify: `backend/src/models/Contact.ts`
- Test: manual (migration + query direta, sem framework de teste para migrations neste projeto)

**Interfaces:**
- Produces: `Contact.cpfCnpj: string | null` — usado pelas Tasks 7, 8, 10.

- [ ] **Step 1: Criar a migration**

```typescript
import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.addColumn("Contacts", "cpfCnpj", {
      type: DataTypes.STRING,
      allowNull: true
    });
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.removeColumn("Contacts", "cpfCnpj");
  }
};
```

- [ ] **Step 2: Adicionar o campo no model**

Em `backend/src/models/Contact.ts`, adicionar após o campo `number` (que já usa `@AllowNull(false)` — este novo campo é opcional, sem esse decorator):

```typescript
  @Column
  cpfCnpj: string;
```

- [ ] **Step 3: Rodar a migration dentro do container builder**

```bash
cd /home/edison/fontes/stonechat/backend
docker build --target builder -t stonechat-test-builder .
docker run --rm --network stonechat_default \
  -e DB_DIALECT=postgres -e DB_HOST=stonechat_postgres -e DB_PORT=5432 \
  -e DB_USER=stonechat -e DB_PASS=<senha real, ver docker-compose.yml> -e DB_NAME=stonechat \
  stonechat-test-builder npx sequelize db:migrate
```

Expected: log mostrando `20260707120000-add-cpfCnpj-to-contacts.ts` migrada com sucesso.

- [ ] **Step 4: Confirmar a coluna no banco**

```bash
docker exec stonechat_postgres psql -U stonechat -d stonechat -c "\d \"Contacts\"" | grep cpfCnpj
```

Expected: linha mostrando `cpfCnpj | character varying(255) |`.

- [ ] **Step 5: Commit**

```bash
cd /home/edison/fontes/stonechat
git add backend/src/database/migrations/20260707120000-add-cpfCnpj-to-contacts.ts backend/src/models/Contact.ts
git commit -m "Adiciona campo cpfCnpj ao Contact para identificação persistente do agente de IA"
```

---

### Task 2: SgpService — consulta de cliente por CPF/CNPJ

**Files:**
- Create: `backend/src/services/SgpServices/SgpService.ts`
- Test: `backend/src/services/SgpServices/__tests__/SgpService.spec.ts`

**Interfaces:**
- Consumes: nenhuma (primeira peça do serviço)
- Produces: `SgpCliente` (interface), `sgpService.consultarCliente(cpfCnpj: string): Promise<SgpCliente | null>` — usado pelas Tasks 3, 4, 7, 8.

- [ ] **Step 1: Endpoint e parâmetro já confirmados — só falta o formato de sucesso**

**Já confirmado em produção** (ver Global Constraints): o endpoint é `POST /api/ura/consultacliente/` (não existe `/clientes/` separado), com body `{token, app, cpfcnpj}` — parâmetro **`cpfcnpj`**, sem underscore. Testado com CPF fake (`00000000000`, `app: "snilog"`) e retornou `{"contratos":[]}` — confirma o endpoint e o parâmetro, mas não o formato de um contrato **encontrado** (a instância de teste não tinha esse CPF fake cadastrado, como esperado).

Antes de finalizar esta task, rode com um CPF real de teste (peça um ao Edison, ou use o do próprio SNI Telecom) e com o **token novo dedicado ao `app: "StoneChat"`** (ver Global Constraints):

```bash
curl -s -X POST "https://snitelecom.sgp.net.br/api/ura/consultacliente/" \
  -H "Content-Type: application/json" \
  -d '{"token":"'"$SGP_TOKEN"'","app":"StoneChat","cpfcnpj":"<CPF real de teste>"}' | python3 -m json.tool
```

Confirme se os nomes de campo dentro de `contratos[0]` batem com o mapeamento assumido no Step 4 (`razaoSocial`, `cpfCnpj`, `contratoStatusDisplay`, `clienteId`, `contratoId`, `bloqueado`) — são os mesmos já usados no SNILog (`sgp.service.ts`) para login, então é provável que sejam idênticos por CPF, mas confirme antes de prosseguir para a Task 3.

- [ ] **Step 2: Escrever o teste (com o formato assumido acima)**

```typescript
// backend/src/services/SgpServices/__tests__/SgpService.spec.ts
jest.mock("axios");

// eslint-disable-next-line import/first
import axios from "axios";
// eslint-disable-next-line import/first
import SgpService from "../SgpService";

describe("SgpService.consultarCliente", () => {
  beforeEach(() => {
    process.env.SGP_URL = "https://snitelecom.sgp.net.br";
    process.env.SGP_TOKEN = "token-teste";
  });

  it("retorna os dados do cliente quando o SGP encontra o contrato", async () => {
    (axios.post as jest.Mock).mockResolvedValue({
      data: {
        msg: "Contrato(s) Localizado(s)",
        contratos: [
          {
            razaoSocial: "Edison Carlos",
            cpfCnpj: "12345678900",
            contratoStatusDisplay: "Ativo",
            clienteId: 42,
            contratoId: 99,
            bloqueado: false
          }
        ]
      }
    });

    const result = await SgpService.consultarCliente("12345678900");

    expect(result).toEqual({
      nome: "Edison Carlos",
      cpfCnpj: "12345678900",
      contratoStatus: "Ativo",
      clienteId: 42,
      contratoId: 99,
      bloqueado: false
    });
    expect(axios.post).toHaveBeenCalledWith(
      "https://snitelecom.sgp.net.br/api/ura/consultacliente/",
      { token: "token-teste", app: "StoneChat", cpfcnpj: "12345678900" }
    );
  });

  it("retorna null quando o SGP não localiza o contrato", async () => {
    (axios.post as jest.Mock).mockResolvedValue({
      data: { msg: "Nenhum contrato localizado", contratos: [] }
    });

    const result = await SgpService.consultarCliente("00000000000");

    expect(result).toBeNull();
  });

  it("retorna null quando a chamada falha", async () => {
    (axios.post as jest.Mock).mockRejectedValue(new Error("timeout"));

    const result = await SgpService.consultarCliente("12345678900");

    expect(result).toBeNull();
  });
});
```

- [ ] **Step 3: Rodar o teste e confirmar que falha (SgpService ainda não existe)**

```bash
cd /home/edison/fontes/stonechat/backend
docker build --target builder -t stonechat-test-builder .
docker run --rm -e NODE_ENV=test stonechat-test-builder npx jest src/services/SgpServices/__tests__/SgpService.spec.ts --coverage=false
```

Expected: FAIL com `Cannot find module '../SgpService'`.

- [ ] **Step 4: Implementar SgpService**

```typescript
// backend/src/services/SgpServices/SgpService.ts
import axios from "axios";

export interface SgpCliente {
  nome: string;
  cpfCnpj: string;
  contratoStatus: string;
  clienteId: number;
  contratoId: number;
  bloqueado: boolean;
}

const sgpUrl = (): string => process.env.SGP_URL || "";
const sgpToken = (): string => process.env.SGP_TOKEN || "";

const consultarCliente = async (
  cpfCnpj: string
): Promise<SgpCliente | null> => {
  try {
    const response = await axios.post(`${sgpUrl()}/api/ura/consultacliente/`, {
      token: sgpToken(),
      app: "StoneChat",
      cpfcnpj: cpfCnpj
    });

    const contratos = response.data?.contratos ?? [];
    if (contratos.length === 0) return null;

    const c = contratos[0];
    return {
      nome: c.razaoSocial ?? "",
      cpfCnpj: c.cpfCnpj ?? "",
      contratoStatus: c.contratoStatusDisplay ?? "",
      clienteId: c.clienteId ?? 0,
      contratoId: c.contratoId ?? 0,
      bloqueado: c.bloqueado === true || c.bloqueado === "sim"
    };
  } catch {
    return null;
  }
};

export default { consultarCliente };
```

- [ ] **Step 5: Rodar o teste e confirmar que passa**

```bash
docker build --target builder -t stonechat-test-builder .
docker run --rm -e NODE_ENV=test stonechat-test-builder npx jest src/services/SgpServices/__tests__/SgpService.spec.ts --coverage=false
```

Expected: `PASS`, 3 testes passando.

- [ ] **Step 6: Commit**

```bash
cd /home/edison/fontes/stonechat
git add backend/src/services/SgpServices/SgpService.ts backend/src/services/SgpServices/__tests__/SgpService.spec.ts
git commit -m "Adiciona consulta de cliente por CPF/CNPJ ao SgpService"
```

---

### Task 3: SgpService — busca de boleto/PIX

**Files:**
- Modify: `backend/src/services/SgpServices/SgpService.ts`
- Modify: `backend/src/services/SgpServices/__tests__/SgpService.spec.ts`

**Interfaces:**
- Consumes: nenhuma (chamado direto por CPF/CNPJ, como `consultarCliente`)
- Produces: `SgpBoleto` (interface), `sgpService.buscarBoleto(cpfCnpj: string): Promise<SgpBoleto | null>` — usado pela Task 7.

- [ ] **Step 1: Endpoint corrigido — CONFIRMADO com CPF real em produção (não é mais suposição)**

**Descoberta durante a implementação:** `/api/ura/fatura2via/` (usado no design original) **falha para qualquer cliente com mais de um contrato** — retorna `{"msg":"Há mais de um contrato para o CPF/CNPJ informado. Favor informar o id do contrato","status":0}`, sem forma de saber por CPF sozinho qual boleto mostrar. Isso é comum (testado com um CPF real de múltiplos contratos). Por isso esta task usa **`/api/ura/titulos/`** em vez de `fatura2via` — lista TODOS os títulos do CPF (aberto, pago, cancelado, etc, todos os contratos juntos, paginado), sem precisar de contrato específico. Filtramos por `status === "aberto"` no código.

Testado de verdade em produção (`app: "StoneChat"`, CPF real com um título em aberto):

```bash
curl -s -X POST "https://snitelecom.sgp.net.br/api/ura/titulos/" \
  -H "Content-Type: application/json" \
  -d '{"token":"'"$SGP_TOKEN"'","app":"StoneChat","cpfcnpj":"<cpf>"}'
```

Resposta real (campos relevantes de um item com `status: "aberto"`):

```json
{
  "paginacao": {"offset": 0, "limit": 250, "parcial": 118, "total": 118},
  "titulos": [
    {
      "id": 72554,
      "clienteContrato": 1879,
      "link": "https://snitelecom.sgp.net.br/boleto/73103-VWI6MBJ6L4/",
      "link_cobranca": "https://snitelecom.sgp.net.br/public/cobranca/73103-VWI6MBJ6L4/",
      "status": "aberto",
      "valorCorrigido": 5.0,
      "codigoBarras": "99999152900000005000000060000000043600000000",
      "linhaDigitavel": "",
      "codigoPix": "",
      "dataVencimento": "2026-08-05"
    }
  ]
}
```

**Nomes de campo já confirmados, use exatamente estes no Step 4** (não são mais suposição): `link` (URL do boleto), `linhaDigitavel`, `codigoPix`, `valorCorrigido`, `dataVencimento`, `status` (string, valor `"aberto"` é o que filtramos). `linhaDigitavel`/`codigoPix` podem legitimamente vir como string vazia mesmo num título em aberto de verdade (confirmado no exemplo acima, título recém-emitido) — trate como ausente (`null`) quando vazio, não como erro.

Quando não há nenhum título em aberto, `titulos` volta como array vazio (ou só com títulos `pago`/`cancelado`) — trate como não encontrado.

- [ ] **Step 2: Escrever o teste**

Adicionar ao mesmo arquivo de teste da Task 2:

```typescript
describe("SgpService.buscarBoleto", () => {
  beforeEach(() => {
    process.env.SGP_URL = "https://snitelecom.sgp.net.br";
    process.env.SGP_TOKEN = "token-teste";
  });

  it("retorna os dados do boleto quando há título em aberto", async () => {
    (axios.post as jest.Mock).mockResolvedValue({
      data: {
        paginacao: { offset: 0, limit: 250, parcial: 2, total: 2 },
        titulos: [
          {
            id: 72554,
            clienteContrato: 1879,
            link: "https://snitelecom.sgp.net.br/boleto/73103-VWI6MBJ6L4/",
            status: "aberto",
            valorCorrigido: 5.0,
            codigoBarras: "99999152900000005000000060000000043600000000",
            linhaDigitavel: "",
            codigoPix: "",
            dataVencimento: "2026-08-05"
          },
          {
            id: 64253,
            clienteContrato: 1,
            link: "https://snitelecom.sgp.net.br/boleto/64802-FE2JC3EN6H/",
            status: "cancelado",
            valorCorrigido: 10.0,
            codigoBarras: "75699140300000010001437401032884700104542001",
            linhaDigitavel: "75691.43741 01032.884700 01045.420013 9 14030000001000",
            codigoPix: "00020101021226950014br.gov.bcb.pix",
            dataVencimento: "2026-04-01"
          }
        ]
      }
    });

    const result = await SgpService.buscarBoleto("68197756953");

    expect(result).toEqual({
      linkBoleto: "https://snitelecom.sgp.net.br/boleto/73103-VWI6MBJ6L4/",
      linhaDigitavel: null,
      pixCopiaCola: null,
      valor: "5",
      vencimento: "2026-08-05"
    });
  });

  it("retorna null quando não há nenhum título em aberto", async () => {
    (axios.post as jest.Mock).mockResolvedValue({
      data: {
        paginacao: { offset: 0, limit: 250, parcial: 1, total: 1 },
        titulos: [
          {
            id: 64253,
            clienteContrato: 1,
            link: "https://snitelecom.sgp.net.br/boleto/64802-FE2JC3EN6H/",
            status: "cancelado",
            valorCorrigido: 10.0,
            codigoBarras: "756991...",
            linhaDigitavel: "75691...",
            codigoPix: "",
            dataVencimento: "2026-04-01"
          }
        ]
      }
    });

    const result = await SgpService.buscarBoleto("68197756953");

    expect(result).toBeNull();
  });

  it("retorna null quando o CPF não tem nenhum título", async () => {
    (axios.post as jest.Mock).mockResolvedValue({
      data: { paginacao: { offset: 0, limit: 250, parcial: 0, total: 0 }, titulos: [] }
    });

    const result = await SgpService.buscarBoleto("00000000000");

    expect(result).toBeNull();
  });
});
```

- [ ] **Step 3: Rodar o teste e confirmar que falha**

```bash
docker build --target builder -t stonechat-test-builder .
docker run --rm -e NODE_ENV=test stonechat-test-builder npx jest src/services/SgpServices/__tests__/SgpService.spec.ts --coverage=false
```

Expected: FAIL — `SgpService.buscarBoleto is not a function`.

- [ ] **Step 4: Implementar**

Adicionar em `SgpService.ts`:

```typescript
export interface SgpBoleto {
  linkBoleto: string;
  linhaDigitavel: string | null;
  pixCopiaCola: string | null;
  valor: string;
  vencimento: string;
}

const buscarBoleto = async (cpfCnpj: string): Promise<SgpBoleto | null> => {
  try {
    const response = await axios.post(`${sgpUrl()}/api/ura/titulos/`, {
      token: sgpToken(),
      app: "StoneChat",
      cpfcnpj: cpfCnpj
    });

    const titulos = response.data?.titulos ?? [];
    const aberto = titulos.find((t: { status: string }) => t.status === "aberto");
    if (!aberto) return null;

    return {
      linkBoleto: aberto.link ?? "",
      linhaDigitavel: aberto.linhaDigitavel || null,
      pixCopiaCola: aberto.codigoPix || null,
      valor: String(aberto.valorCorrigido ?? ""),
      vencimento: aberto.dataVencimento ?? ""
    };
  } catch {
    return null;
  }
};

export default { consultarCliente, buscarBoleto };
```

- [ ] **Step 5: Rodar o teste e confirmar que passa**

```bash
docker run --rm -e NODE_ENV=test stonechat-test-builder npx jest src/services/SgpServices/__tests__/SgpService.spec.ts --coverage=false
```

Expected: `PASS`, 6 testes passando.

- [ ] **Step 6: Commit**

```bash
cd /home/edison/fontes/stonechat
git add backend/src/services/SgpServices/SgpService.ts backend/src/services/SgpServices/__tests__/SgpService.spec.ts
git commit -m "Adiciona busca de boleto/PIX ao SgpService"
```

---

### Task 4: SgpService — liberação de confiança

**Files:**
- Modify: `backend/src/services/SgpServices/SgpService.ts`
- Modify: `backend/src/services/SgpServices/__tests__/SgpService.spec.ts`

**Interfaces:**
- Consumes: `SgpCliente.contratoId`, `SgpCliente.cpfCnpj` (Task 2) + um novo campo `SgpCliente.centralSenha` que esta própria task adiciona (ver Step 1).
- Produces: `SgpLiberacaoResultado` (union type), `sgpService.liberarConfianca(cpfCnpj: string, senhaCentral: string, contratoId: number): Promise<SgpLiberacaoResultado>` — usado pela Task 8.

- [ ] **Step 1: Endpoint, autenticação e OS TRÊS CASOS DE RESPOSTA — todos confirmados ao vivo, nada é mais suposição**

**Descoberta importante:** este endpoint NÃO usa o padrão `token`+`app` no body como `consultarCliente`/`buscarBoleto`. Ele fica sob um namespace diferente da API do SGP (`/api/central/`, não `/api/ura/`) e usa **CPF/CNPJ + senha do "Central do Assinante"** — a senha de portal do próprio cliente, que o SGP já devolve no campo `contratoCentralSenha` da resposta de `consultacliente` (por isso o Step 2 abaixo estende `SgpCliente`/`consultarCliente` da Task 2 para capturar esse campo).

```bash
curl -s -X POST "https://snitelecom.sgp.net.br/api/central/promessapagamento/" \
  -H "Content-Type: application/json" \
  -d '{"cpfcnpj":"68197756953","senha":"09cz5dle","contrato":1879}'
```

Testado ao vivo em produção contra um contrato real, nos três estados possíveis (chamado 3 vezes: sem bloqueio, com bloqueio ativo pela primeira vez, e de novo logo em seguida). **O campo `status` é o discriminador real e confiável — use-o, não regex em `msg`:**

1. **`status: 0`** — contrato sem bloqueio ativo (nada a liberar):
   ```json
   {"status":0,"razaosocial":"EDISON CARLOS DOS SANTOS","liberado":false,"cpfcnpj":"681.977.569-53","contrato":1879,"msg":""}
   ```
2. **`status: 1`** — liberação concedida com sucesso (primeira vez, contrato estava bloqueado):
   ```json
   {"status":1,"razaosocial":"EDISON CARLOS DOS SANTOS","protocolo":"260707144900","liberado":true,"data_promessa":"2026-07-08","cpfcnpj":"681.977.569-53","contrato":1879,"msg":"Liberação via Central App -\n   Serviço ID: 1876, Login: edisonsni\n   Motivo: Promessa de Pagamento\n   "}
   ```
   Note os campos extras só presentes no sucesso: `protocolo` (protocolo da liberação, gerado pelo próprio SGP) e `data_promessa` (o SGP decide a data automaticamente — não precisamos/não enviamos essa data no request).
3. **`status: 2`** — já usou o recurso recentemente, não pode liberar de novo (**esta é a condição "já utilizou e não cumpriu" que o Edison descreveu** — texto real, bem diferente do que se supunha antes):
   ```json
   {"status":2,"razaosocial":"EDISON CARLOS DOS SANTOS","liberado":false,"cpfcnpj":"681.977.569-53","contrato":1879,"msg":"O recurso de promessa de pagamento já atingiu quantidade permitida. Recurso não disponível"}
   ```

Falha de autenticação (senha errada ou ausente) confirmada: HTTP 403, `{"detail":"As credenciais de autenticação não foram fornecidas."}`.

Use `status === 1` (ou equivalentemente `liberado === true`) para sucesso, e `status === 2` para o caso "já utilizado" — não precisa de regex em `msg`, é só texto informativo pro log/mensagem ao cliente.

- [ ] **Step 2: Estender `SgpCliente`/`consultarCliente` (Task 2) com o campo `centralSenha`**

Em `SgpService.ts`, adicionar `centralSenha: string;` à interface `SgpCliente` (depois de `contratoId`), e `centralSenha: c.contratoCentralSenha ?? ""` ao mapeamento em `consultarCliente`. Atualizar também o teste de sucesso já existente em `SgpService.spec.ts` (`describe("SgpService.consultarCliente")`, teste `"retorna os dados do cliente..."`) — adicionar `contratoCentralSenha: "09cz5dle"` aos dados mockados de `contratos[0]` e `centralSenha: "09cz5dle"` ao objeto esperado em `toEqual`.

- [ ] **Step 3: Escrever o teste de `liberarConfianca` — os 3 casos reais + falha de rede**

```typescript
describe("SgpService.liberarConfianca", () => {
  it("retorna sucesso com protocolo e data da promessa quando liberado (status 1, caso real)", async () => {
    (axios.post as jest.Mock).mockResolvedValue({
      data: {
        status: 1,
        razaosocial: "EDISON CARLOS DOS SANTOS",
        protocolo: "260707144900",
        liberado: true,
        data_promessa: "2026-07-08",
        cpfcnpj: "681.977.569-53",
        contrato: 1879,
        msg: "Liberação via Central App -\n   Serviço ID: 1876, Login: edisonsni\n   Motivo: Promessa de Pagamento\n   "
      }
    });

    const result = await SgpService.liberarConfianca("68197756953", "09cz5dle", 1879);

    expect(result).toEqual({
      sucesso: true,
      protocolo: "260707144900",
      dataPromessa: "2026-07-08"
    });
    expect(axios.post).toHaveBeenCalledWith(
      "https://snitelecom.sgp.net.br/api/central/promessapagamento/",
      { cpfcnpj: "68197756953", senha: "09cz5dle", contrato: 1879 }
    );
  });

  it("retorna motivo 'ja_utilizado' quando status é 2 (caso real: limite atingido)", async () => {
    (axios.post as jest.Mock).mockResolvedValue({
      data: {
        status: 2,
        razaosocial: "EDISON CARLOS DOS SANTOS",
        liberado: false,
        cpfcnpj: "681.977.569-53",
        contrato: 1879,
        msg: "O recurso de promessa de pagamento já atingiu quantidade permitida. Recurso não disponível"
      }
    });

    const result = await SgpService.liberarConfianca("68197756953", "09cz5dle", 1879);

    expect(result).toEqual({
      sucesso: false,
      motivo: "ja_utilizado",
      mensagem: "O recurso de promessa de pagamento já atingiu quantidade permitida. Recurso não disponível"
    });
  });

  it("retorna motivo 'erro' quando status é 0 (caso real: sem bloqueio ativo, nada a liberar)", async () => {
    (axios.post as jest.Mock).mockResolvedValue({
      data: {
        status: 0,
        razaosocial: "EDISON CARLOS DOS SANTOS",
        liberado: false,
        cpfcnpj: "681.977.569-53",
        contrato: 1879,
        msg: ""
      }
    });

    const result = await SgpService.liberarConfianca("68197756953", "09cz5dle", 1879);

    expect(result).toEqual({
      sucesso: false,
      motivo: "erro",
      mensagem: "Não foi possível processar a liberação no momento"
    });
  });

  it("retorna motivo 'erro' pra falha de rede/timeout", async () => {
    (axios.post as jest.Mock).mockRejectedValue(new Error("timeout"));

    const result = await SgpService.liberarConfianca("68197756953", "09cz5dle", 1879);

    expect(result).toEqual({
      sucesso: false,
      motivo: "erro",
      mensagem: "Não foi possível processar a liberação no momento"
    });
  });
});
```

- [ ] **Step 4: Rodar os testes e confirmar que falham**

```bash
docker build --target builder -t stonechat-test-builder .
docker run --rm -e NODE_ENV=test stonechat-test-builder npx jest src/services/SgpServices/__tests__/SgpService.spec.ts --coverage=false
```

Expected: FAIL — `SgpService.liberarConfianca is not a function` (e o teste de `consultarCliente` atualizado no Step 2 falha até a interface ser estendida).

- [ ] **Step 5: Implementar**

Adicionar `centralSenha` à interface `SgpCliente` e ao mapeamento em `consultarCliente` (Step 2), e adicionar em `SgpService.ts`:

```typescript
export type SgpLiberacaoResultado =
  | { sucesso: true; protocolo: string; dataPromessa: string }
  | { sucesso: false; motivo: "ja_utilizado" | "erro"; mensagem: string };

// Endpoint real: POST /api/central/promessapagamento/ (confirmado ao vivo em produção,
// nos 3 estados possíveis, contra um contrato real). Autenticação DIFERENTE dos outros
// métodos deste arquivo: não usa token/app, usa cpfCnpj + senha do Central do Assinante
// (SgpCliente.centralSenha). `status` é o discriminador confiável da resposta:
//   0 = sem bloqueio ativo, nada a liberar
//   1 = liberado com sucesso (só aqui vêm `protocolo` e `data_promessa`, a data é decidida
//       pelo próprio SGP, não enviamos data no request)
//   2 = já usou o recurso recentemente ("O recurso de promessa de pagamento já atingiu
//       quantidade permitida") — é o caso "já utilizou e não cumpriu" descrito pelo Edison
const liberarConfianca = async (
  cpfCnpj: string,
  senhaCentral: string,
  contratoId: number
): Promise<SgpLiberacaoResultado> => {
  try {
    const response = await axios.post(
      `${sgpUrl()}/api/central/promessapagamento/`,
      { cpfcnpj: cpfCnpj, senha: senhaCentral, contrato: contratoId }
    );

    if (response.data?.status === 1) {
      return {
        sucesso: true,
        protocolo: response.data?.protocolo ?? "",
        dataPromessa: response.data?.data_promessa ?? ""
      };
    }

    if (response.data?.status === 2) {
      return {
        sucesso: false,
        motivo: "ja_utilizado",
        mensagem: response.data?.msg ?? "Você já utilizou esse recurso recentemente."
      };
    }

    return {
      sucesso: false,
      motivo: "erro",
      mensagem: "Não foi possível processar a liberação no momento"
    };
  } catch {
    return {
      sucesso: false,
      motivo: "erro",
      mensagem: "Não foi possível processar a liberação no momento"
    };
  }
};

export default { consultarCliente, buscarBoleto, liberarConfianca };
```

- [ ] **Step 6: Rodar os testes e confirmar que passam**

```bash
docker run --rm -e NODE_ENV=test stonechat-test-builder npx jest src/services/SgpServices/__tests__/SgpService.spec.ts --coverage=false
```

Expected: `PASS`, 10 testes passando (3 consultarCliente + 3 buscarBoleto + 4 liberarConfianca).

- [ ] **Step 7: Commit**

```bash
cd /home/edison/fontes/stonechat
git add backend/src/services/SgpServices/SgpService.ts backend/src/services/SgpServices/__tests__/SgpService.spec.ts
git commit -m "Adiciona liberação de confiança ao SgpService (via /api/central/promessapagamento/)"
```

---

### Task 5: AiAgentActions — registro de atendimento por IA (tag + protocolo)

**Files:**
- Create: `backend/src/services/WbotServices/AiAgentActions.ts`
- Test: `backend/src/services/WbotServices/__tests__/AiAgentActions.spec.ts`

**Interfaces:**
- Consumes: `Tag`, `TicketTag` models (existentes)
- Produces: `registerAiAttendance(ticket: Ticket, companyId: number): Promise<void>` — usado pela Task 10. Aplica a tag "Atendimento IA" ao ticket (idempotente — não duplica se já aplicada).

- [ ] **Step 1: Escrever o teste**

```typescript
// backend/src/services/WbotServices/__tests__/AiAgentActions.spec.ts
jest.mock("../../../models/Tag", () => ({
  __esModule: true,
  default: { findOrCreate: jest.fn() }
}));
jest.mock("../../../models/TicketTag", () => ({
  __esModule: true,
  default: { findOrCreate: jest.fn() }
}));

// eslint-disable-next-line import/first
import Tag from "../../../models/Tag";
// eslint-disable-next-line import/first
import TicketTag from "../../../models/TicketTag";
// eslint-disable-next-line import/first
import { registerAiAttendance } from "../AiAgentActions";

describe("registerAiAttendance", () => {
  it("cria a tag 'Atendimento IA' se não existir e aplica ao ticket", async () => {
    (Tag.findOrCreate as jest.Mock).mockResolvedValue([{ id: 5 }, true]);
    (TicketTag.findOrCreate as jest.Mock).mockResolvedValue([{}, true]);

    await registerAiAttendance({ id: 22 } as any, 1);

    expect(Tag.findOrCreate).toHaveBeenCalledWith({
      where: { name: "Atendimento IA", companyId: 1 },
      defaults: { name: "Atendimento IA", companyId: 1, color: "#8B5CF6" }
    });
    expect(TicketTag.findOrCreate).toHaveBeenCalledWith({
      where: { ticketId: 22, tagId: 5 }
    });
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
cd /home/edison/fontes/stonechat/backend
docker build --target builder -t stonechat-test-builder .
docker run --rm -e NODE_ENV=test stonechat-test-builder npx jest src/services/WbotServices/__tests__/AiAgentActions.spec.ts --coverage=false
```

Expected: FAIL — `Cannot find module '../AiAgentActions'`.

- [ ] **Step 3: Implementar**

```typescript
// backend/src/services/WbotServices/AiAgentActions.ts
import Tag from "../../models/Tag";
import TicketTag from "../../models/TicketTag";
import Ticket from "../../models/Ticket";

export const registerAiAttendance = async (
  ticket: Ticket,
  companyId: number
): Promise<void> => {
  const [tag] = await Tag.findOrCreate({
    where: { name: "Atendimento IA", companyId },
    defaults: { name: "Atendimento IA", companyId, color: "#8B5CF6" }
  });

  await TicketTag.findOrCreate({
    where: { ticketId: ticket.id, tagId: tag.id }
  });
};
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
docker run --rm -e NODE_ENV=test stonechat-test-builder npx jest src/services/WbotServices/__tests__/AiAgentActions.spec.ts --coverage=false
```

Expected: `PASS`, 1 teste passando.

- [ ] **Step 5: Commit**

```bash
cd /home/edison/fontes/stonechat
git add backend/src/services/WbotServices/AiAgentActions.ts backend/src/services/WbotServices/__tests__/AiAgentActions.spec.ts
git commit -m "Adiciona registro de atendimento por IA (tag) ao AiAgentActions"
```

---

### Task 6: AiAgentActions — transferência de fila por nome

**Files:**
- Modify: `backend/src/services/WbotServices/AiAgentActions.ts`
- Modify: `backend/src/services/WbotServices/__tests__/AiAgentActions.spec.ts`

**Interfaces:**
- Consumes: `UpdateTicketService` (já existe em `../TicketServices/UpdateTicketService`), `Queue` model
- Produces: `transferToQueueByName(queueName: string, ticket: Ticket, companyId: number): Promise<boolean>` — retorna `false` se a fila não existir (para o chamador decidir o que fazer). Usado pelas Tasks 7, 8, 9.

- [ ] **Step 1: Escrever o teste**

Adicionar ao mesmo arquivo de teste, com os mocks adicionais no topo do arquivo:

```typescript
jest.mock("../../../models/Queue", () => ({
  __esModule: true,
  default: { findOne: jest.fn() }
}));
jest.mock("../../TicketServices/UpdateTicketService", () => ({
  __esModule: true,
  default: jest.fn()
}));
```

E os imports/testes:

```typescript
// eslint-disable-next-line import/first
import Queue from "../../../models/Queue";
// eslint-disable-next-line import/first
import UpdateTicketService from "../../TicketServices/UpdateTicketService";
// eslint-disable-next-line import/first
import { transferToQueueByName } from "../AiAgentActions";

describe("transferToQueueByName", () => {
  it("transfere o ticket para a fila quando ela existe", async () => {
    (Queue.findOne as jest.Mock).mockResolvedValue({ id: 7 });

    const result = await transferToQueueByName(
      "Financeiro",
      { id: 22, companyId: 1 } as any,
      1
    );

    expect(result).toBe(true);
    expect(UpdateTicketService).toHaveBeenCalledWith({
      ticketData: { queueId: 7, useIntegration: false, promptId: null },
      ticketId: 22,
      companyId: 1
    });
  });

  it("retorna false quando a fila não existe", async () => {
    (Queue.findOne as jest.Mock).mockResolvedValue(null);

    const result = await transferToQueueByName(
      "Fila Inexistente",
      { id: 22, companyId: 1 } as any,
      1
    );

    expect(result).toBe(false);
    expect(UpdateTicketService).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
docker build --target builder -t stonechat-test-builder .
docker run --rm -e NODE_ENV=test stonechat-test-builder npx jest src/services/WbotServices/__tests__/AiAgentActions.spec.ts --coverage=false
```

Expected: FAIL — `transferToQueueByName is not a function`.

- [ ] **Step 3: Implementar**

Adicionar em `AiAgentActions.ts`:

```typescript
import Queue from "../../models/Queue";
import UpdateTicketService from "../TicketServices/UpdateTicketService";

export const transferToQueueByName = async (
  queueName: string,
  ticket: Ticket,
  companyId: number
): Promise<boolean> => {
  const queue = await Queue.findOne({ where: { name: queueName, companyId } });
  if (!queue) return false;

  await UpdateTicketService({
    ticketData: { queueId: queue.id, useIntegration: false, promptId: null },
    ticketId: ticket.id,
    companyId
  });
  return true;
};
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
docker run --rm -e NODE_ENV=test stonechat-test-builder npx jest src/services/WbotServices/__tests__/AiAgentActions.spec.ts --coverage=false
```

Expected: `PASS`, 3 testes passando.

- [ ] **Step 5: Commit**

```bash
cd /home/edison/fontes/stonechat
git add backend/src/services/WbotServices/AiAgentActions.ts backend/src/services/WbotServices/__tests__/AiAgentActions.spec.ts
git commit -m "Adiciona transferência de fila por nome ao AiAgentActions"
```

---

### Task 7: AiAgentActions — ação "Buscar Boleto"

**Files:**
- Modify: `backend/src/services/WbotServices/AiAgentActions.ts`
- Modify: `backend/src/services/WbotServices/__tests__/AiAgentActions.spec.ts`

**Interfaces:**
- Consumes: `SgpService.buscarBoleto` (Task 3), `UpdateTicketService`
- Produces: `handleBuscarBoletoAction(cpfCnpj: string, ticket: Ticket, contact: Contact, wbot: WASocket, companyId: number): Promise<void>` — usado pela Task 9.

- [ ] **Step 1: Escrever o teste**

Mocks adicionais no topo do arquivo:

```typescript
jest.mock("../../SgpServices/SgpService", () => ({
  __esModule: true,
  default: { buscarBoleto: jest.fn() }
}));
```

Imports/testes:

```typescript
// eslint-disable-next-line import/first
import SgpService from "../../SgpServices/SgpService";
// eslint-disable-next-line import/first
import { handleBuscarBoletoAction } from "../AiAgentActions";

describe("handleBuscarBoletoAction", () => {
  const wbot = { sendMessage: jest.fn().mockResolvedValue({}) } as any;
  const ticket = { id: 22, companyId: 1, contact: { number: "554388515951" } } as any;
  const contact = { number: "554388515951" } as any;

  beforeEach(() => jest.clearAllMocks());

  it("envia o boleto e fecha o ticket quando encontrado", async () => {
    (SgpService.buscarBoleto as jest.Mock).mockResolvedValue({
      linkBoleto: "https://sgp/boleto/1",
      linhaDigitavel: "00190...",
      pixCopiaCola: "00020126...",
      valor: "99.90",
      vencimento: "2026-07-15"
    });

    await handleBuscarBoletoAction("12345678900", ticket, contact, wbot, 1);

    expect(wbot.sendMessage).toHaveBeenCalled();
    const sentTexts = (wbot.sendMessage as jest.Mock).mock.calls.map(
      call => call[1].text
    );
    expect(sentTexts.some(t => t.includes("https://sgp/boleto/1"))).toBe(true);
    expect(sentTexts.some(t => t.includes("00020126"))).toBe(true);
    expect(UpdateTicketService).toHaveBeenCalledWith({
      ticketData: { status: "closed" },
      ticketId: 22,
      companyId: 1
    });
  });

  it("avisa o cliente quando não há boleto em aberto, sem fechar o ticket", async () => {
    (SgpService.buscarBoleto as jest.Mock).mockResolvedValue(null);

    await handleBuscarBoletoAction("12345678900", ticket, contact, wbot, 1);

    expect(wbot.sendMessage).toHaveBeenCalled();
    expect(UpdateTicketService).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
docker build --target builder -t stonechat-test-builder .
docker run --rm -e NODE_ENV=test stonechat-test-builder npx jest src/services/WbotServices/__tests__/AiAgentActions.spec.ts --coverage=false
```

Expected: FAIL — `handleBuscarBoletoAction is not a function`.

- [ ] **Step 3: Implementar**

Adicionar em `AiAgentActions.ts` (mais os imports novos no topo: `Contact` model, `SgpService`, `WASocket` type do Baileys — mesmo tipo que `providers.ts` já usa pra este parâmetro, não o `Session` local de `wbotMessageListener.ts`, que não é exportado):

```typescript
import Contact from "../../models/Contact";
import SgpService from "../SgpServices/SgpService";
import { WASocket } from "@whiskeysockets/baileys";
import formatBody from "../../helpers/Mustache";

const jidOf = (contact: Contact): string => `${contact.number}@s.whatsapp.net`;

export const handleBuscarBoletoAction = async (
  cpfCnpj: string,
  ticket: Ticket,
  contact: Contact,
  wbot: WASocket,
  companyId: number
): Promise<void> => {
  const boleto = await SgpService.buscarBoleto(cpfCnpj);

  if (!boleto) {
    await wbot.sendMessage(jidOf(contact), {
      text: formatBody(
        "Não encontrei nenhuma fatura em aberto no seu CPF/CNPJ no momento.",
        contact
      )
    });
    return;
  }

  await wbot.sendMessage(jidOf(contact), {
    text: formatBody(
      `Segue sua fatura:\n\n*Valor:* R$ ${boleto.valor}\n*Vencimento:* ${boleto.vencimento}\n*Link do boleto:* ${boleto.linkBoleto}\n*Linha digitável:* ${boleto.linhaDigitavel}`,
      contact
    )
  });

  if (boleto.pixCopiaCola) {
    await wbot.sendMessage(jidOf(contact), {
      text: formatBody(`*PIX Copia e Cola:*\n${boleto.pixCopiaCola}`, contact)
    });
  }

  await UpdateTicketService({
    ticketData: { status: "closed" },
    ticketId: ticket.id,
    companyId
  });
};
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
docker run --rm -e NODE_ENV=test stonechat-test-builder npx jest src/services/WbotServices/__tests__/AiAgentActions.spec.ts --coverage=false
```

Expected: `PASS`, 5 testes passando.

- [ ] **Step 5: Commit**

```bash
cd /home/edison/fontes/stonechat
git add backend/src/services/WbotServices/AiAgentActions.ts backend/src/services/WbotServices/__tests__/AiAgentActions.spec.ts
git commit -m "Adiciona ação de busca de boleto ao AiAgentActions"
```

---

### Task 8: AiAgentActions — ação "Liberar Confiança"

**Files:**
- Modify: `backend/src/services/WbotServices/AiAgentActions.ts`
- Modify: `backend/src/services/WbotServices/__tests__/AiAgentActions.spec.ts`

**Interfaces:**
- Consumes: `SgpService.consultarCliente` (Task 2), `SgpService.liberarConfianca` (Task 4), `transferToQueueByName` (Task 6)
- Produces: `handleLiberarConfiancaAction(cpfCnpj: string, ticket: Ticket, contact: Contact, wbot: WASocket, companyId: number): Promise<void>` — usado pela Task 9.

- [ ] **Step 1: Escrever o teste**

Adicionar ao mock de `SgpService` já existente no arquivo (Task 7), incluindo `consultarCliente` e `liberarConfianca`:

```typescript
jest.mock("../../SgpServices/SgpService", () => ({
  __esModule: true,
  default: {
    buscarBoleto: jest.fn(),
    consultarCliente: jest.fn(),
    liberarConfianca: jest.fn()
  }
}));
```

Testes:

```typescript
describe("handleLiberarConfiancaAction", () => {
  const wbot = { sendMessage: jest.fn().mockResolvedValue({}) } as any;
  const ticket = { id: 22, companyId: 1 } as any;
  const contact = { number: "554388515951" } as any;

  beforeEach(() => jest.clearAllMocks());

  it("libera e fecha o ticket quando bem-sucedido", async () => {
    (SgpService.consultarCliente as jest.Mock).mockResolvedValue({
      contratoId: 1879,
      centralSenha: "09cz5dle"
    });
    (SgpService.liberarConfianca as jest.Mock).mockResolvedValue({
      sucesso: true,
      protocolo: "260707144900",
      dataPromessa: "2026-07-08"
    });

    await handleLiberarConfiancaAction("68197756953", ticket, contact, wbot, 1);

    expect(SgpService.liberarConfianca).toHaveBeenCalledWith(
      "68197756953",
      "09cz5dle",
      1879
    );
    expect(UpdateTicketService).toHaveBeenCalledWith({
      ticketData: { status: "closed" },
      ticketId: 22,
      companyId: 1
    });
  });

  it("avisa o cliente e transfere para Financeiro quando já usou e não cumpriu (status 2 real)", async () => {
    (SgpService.consultarCliente as jest.Mock).mockResolvedValue({
      contratoId: 1879,
      centralSenha: "09cz5dle"
    });
    (SgpService.liberarConfianca as jest.Mock).mockResolvedValue({
      sucesso: false,
      motivo: "ja_utilizado",
      mensagem: "O recurso de promessa de pagamento já atingiu quantidade permitida. Recurso não disponível"
    });
    (Queue.findOne as jest.Mock).mockResolvedValue({ id: 3 });

    await handleLiberarConfiancaAction("68197756953", ticket, contact, wbot, 1);

    expect(UpdateTicketService).toHaveBeenCalledWith({
      ticketData: { queueId: 3, useIntegration: false, promptId: null },
      ticketId: 22,
      companyId: 1
    });
  });

  it("não libera quando o cliente não é encontrado no SGP", async () => {
    (SgpService.consultarCliente as jest.Mock).mockResolvedValue(null);

    await handleLiberarConfiancaAction("68197756953", ticket, contact, wbot, 1);

    expect(SgpService.liberarConfianca).not.toHaveBeenCalled();
    expect(wbot.sendMessage).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
docker build --target builder -t stonechat-test-builder .
docker run --rm -e NODE_ENV=test stonechat-test-builder npx jest src/services/WbotServices/__tests__/AiAgentActions.spec.ts --coverage=false
```

Expected: FAIL — `handleLiberarConfiancaAction is not a function`.

- [ ] **Step 3: Implementar**

Adicionar em `AiAgentActions.ts`:

```typescript
export const handleLiberarConfiancaAction = async (
  cpfCnpj: string,
  ticket: Ticket,
  contact: Contact,
  wbot: WASocket,
  companyId: number
): Promise<void> => {
  const cliente = await SgpService.consultarCliente(cpfCnpj);

  if (!cliente) {
    await wbot.sendMessage(jidOf(contact), {
      text: formatBody("Não localizei seu cadastro pelo CPF/CNPJ informado.", contact)
    });
    return;
  }

  const resultado = await SgpService.liberarConfianca(
    cpfCnpj,
    cliente.centralSenha,
    cliente.contratoId
  );

  if (resultado.sucesso) {
    await wbot.sendMessage(jidOf(contact), {
      text: formatBody(
        `Pronto! Liberei sua conexão por confiança até *${resultado.dataPromessa}*. Aguarde alguns minutos e verifique se voltou a funcionar.\n\n*Protocolo:* ${resultado.protocolo}`,
        contact
      )
    });
    await UpdateTicketService({
      ticketData: { status: "closed" },
      ticketId: ticket.id,
      companyId
    });
    return;
  }

  if (resultado.motivo === "ja_utilizado") {
    await wbot.sendMessage(jidOf(contact), {
      text: formatBody(
        "Você já utilizou a liberação por confiança recentemente, então não posso liberar automaticamente dessa vez. Vou te encaminhar para o setor financeiro.",
        contact
      )
    });
    await transferToQueueByName("Financeiro", ticket, companyId);
    return;
  }

  await wbot.sendMessage(jidOf(contact), {
    text: formatBody(
      "Não consegui processar a liberação no momento. Vou te encaminhar para um atendente.",
      contact
    )
  });
  await transferToQueueByName("Atendimento", ticket, companyId);
};
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
docker run --rm -e NODE_ENV=test stonechat-test-builder npx jest src/services/WbotServices/__tests__/AiAgentActions.spec.ts --coverage=false
```

Expected: `PASS`, 8 testes passando.

- [ ] **Step 5: Commit**

```bash
cd /home/edison/fontes/stonechat
git add backend/src/services/WbotServices/AiAgentActions.ts backend/src/services/WbotServices/__tests__/AiAgentActions.spec.ts
git commit -m "Adiciona ação de liberação de confiança ao AiAgentActions"
```

---

### Task 9: AiAgentActions — despacho central por frase-gatilho

**Files:**
- Modify: `backend/src/services/WbotServices/AiAgentActions.ts`
- Modify: `backend/src/services/WbotServices/__tests__/AiAgentActions.spec.ts`

**Interfaces:**
- Consumes: todas as funções das Tasks 5-8
- Produces: `dispatchAiAction(responseText: string, ticket: Ticket, contact: Contact, wbot: WASocket, companyId: number): Promise<string>` — retorna o texto da resposta **sem** a frase-gatilho. Usado pela Task 10.

- [ ] **Step 1: Escrever o teste**

```typescript
describe("dispatchAiAction", () => {
  const wbot = { sendMessage: jest.fn().mockResolvedValue({}) } as any;
  const ticket = { id: 22, companyId: 1 } as any;
  const contact = { number: "554388515951", cpfCnpj: "12345678900" } as any;

  beforeEach(() => jest.clearAllMocks());

  it("remove a frase-gatilho e transfere para Atendimento", async () => {
    (Queue.findOne as jest.Mock).mockResolvedValue({ id: 1 });

    const result = await dispatchAiAction(
      "Já vou te transferir. Ação: Transferir para Atendimento",
      ticket,
      contact,
      wbot,
      1
    );

    expect(result).toBe("Já vou te transferir.");
    expect(Queue.findOne).toHaveBeenCalledWith({
      where: { name: "Atendimento", companyId: 1 }
    });
  });

  it("remove a frase-gatilho e transfere para Técnico", async () => {
    (Queue.findOne as jest.Mock).mockResolvedValue({ id: 2 });

    const result = await dispatchAiAction(
      "Vou abrir um chamado técnico. Ação: Transferir para Técnico",
      ticket,
      contact,
      wbot,
      1
    );

    expect(result).toBe("Vou abrir um chamado técnico.");
    expect(Queue.findOne).toHaveBeenCalledWith({
      where: { name: "Técnico", companyId: 1 }
    });
  });

  it("aciona a busca de boleto e remove a frase-gatilho", async () => {
    (SgpService.buscarBoleto as jest.Mock).mockResolvedValue(null);

    const result = await dispatchAiAction(
      "Já vou consultar. Ação: Buscar Boleto",
      ticket,
      contact,
      wbot,
      1
    );

    expect(result).toBe("Já vou consultar.");
    expect(SgpService.buscarBoleto).toHaveBeenCalledWith("12345678900");
  });

  it("aciona a liberação de confiança e remove a frase-gatilho", async () => {
    (SgpService.consultarCliente as jest.Mock).mockResolvedValue(null);

    const result = await dispatchAiAction(
      "Vou verificar. Ação: Liberar Confiança",
      ticket,
      contact,
      wbot,
      1
    );

    expect(result).toBe("Vou verificar.");
    expect(SgpService.consultarCliente).toHaveBeenCalledWith("12345678900");
  });

  it("retorna o texto original quando não há frase-gatilho", async () => {
    const result = await dispatchAiAction(
      "Como posso te ajudar hoje?",
      ticket,
      contact,
      wbot,
      1
    );

    expect(result).toBe("Como posso te ajudar hoje?");
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
docker build --target builder -t stonechat-test-builder .
docker run --rm -e NODE_ENV=test stonechat-test-builder npx jest src/services/WbotServices/__tests__/AiAgentActions.spec.ts --coverage=false
```

Expected: FAIL — `dispatchAiAction is not a function`.

- [ ] **Step 3: Implementar**

Adicionar em `AiAgentActions.ts`:

```typescript
const ACTION_MARKERS = {
  transferirAtendimento: "Ação: Transferir para Atendimento",
  transferirTecnico: "Ação: Transferir para Técnico",
  buscarBoleto: "Ação: Buscar Boleto",
  liberarConfianca: "Ação: Liberar Confiança"
} as const;

export const dispatchAiAction = async (
  responseText: string,
  ticket: Ticket,
  contact: Contact,
  wbot: WASocket,
  companyId: number
): Promise<string> => {
  const cpfCnpj = contact.cpfCnpj;

  if (responseText.includes(ACTION_MARKERS.transferirAtendimento)) {
    await transferToQueueByName("Atendimento", ticket, companyId);
    return responseText.replace(ACTION_MARKERS.transferirAtendimento, "").trim();
  }

  if (responseText.includes(ACTION_MARKERS.transferirTecnico)) {
    await transferToQueueByName("Técnico", ticket, companyId);
    return responseText.replace(ACTION_MARKERS.transferirTecnico, "").trim();
  }

  if (responseText.includes(ACTION_MARKERS.buscarBoleto) && cpfCnpj) {
    await handleBuscarBoletoAction(cpfCnpj, ticket, contact, wbot, companyId);
    return responseText.replace(ACTION_MARKERS.buscarBoleto, "").trim();
  }

  if (responseText.includes(ACTION_MARKERS.liberarConfianca) && cpfCnpj) {
    await handleLiberarConfiancaAction(cpfCnpj, ticket, contact, wbot, companyId);
    return responseText.replace(ACTION_MARKERS.liberarConfianca, "").trim();
  }

  return responseText;
};
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
docker run --rm -e NODE_ENV=test stonechat-test-builder npx jest src/services/WbotServices/__tests__/AiAgentActions.spec.ts --coverage=false
```

Expected: `PASS`, 13 testes passando.

- [ ] **Step 5: Rodar a suíte completa do projeto (todas as tasks anteriores incluídas)**

```bash
docker run --rm -e NODE_ENV=test stonechat-test-builder npx jest --coverage=false
```

Expected: `PASS` em todos os arquivos de teste, sem regressão nos testes já existentes antes desta feature.

- [ ] **Step 6: Commit**

```bash
cd /home/edison/fontes/stonechat
git add backend/src/services/WbotServices/AiAgentActions.ts backend/src/services/WbotServices/__tests__/AiAgentActions.spec.ts
git commit -m "Adiciona despacho central de ações do agente de IA por frase-gatilho"
```

---

### Task 10: Integração no `handleOpenAi` — CPF, protocolo e despacho de ação

**Files:**
- Modify: `backend/src/services/WbotServices/wbotMessageListener.ts` (função `handleOpenAi`, hoje começando por volta da linha 645)

**Interfaces:**
- Consumes: `Contact.cpfCnpj` (Task 1), `registerAiAttendance` e `dispatchAiAction` (Tasks 5, 9), `validaCpfCnpj` (já existe no próprio arquivo)

**Atenção — `handleOpenAi` tem DOIS branches parecidos, só mexa no primeiro:** a função tem um branch pra mensagem de texto (`if (msg.message?.conversation || msg.message?.extendedTextMessage?.text)`) e outro pra mensagem de áudio (`else if (msg.message?.audioMessage)`, transcrita via Whisper). Os dois têm um bloco quase idêntico (`let response = chat.data.choices[0].message?.content; if (response?.includes("Ação: Transferir..."))...`). **Só edite a ocorrência do branch de TEXTO.** O branch de áudio tem um bug pré-existente e sem relação com esta feature — depois de calcular `response`, todo o código que enviaria a resposta (`wbot.sendMessage`) está dentro de um comentário `/* ... */` nunca executado, então mensagens de áudio hoje não recebem resposta nenhuma da IA. Isso é fora do escopo desta task — não tente consertar, só não edite esse segundo bloco por engano (`grep`/busca por esse trecho vai retornar 2 resultados; use o CONTEÚDO completo do bloco "antes" do Step 4, que inclui `wbot.sendMessage`+`verifyMessage` logo em seguida, pra identificar o branch certo — só o de texto tem esse final).

- [ ] **Step 1: Adicionar o import no topo de `wbotMessageListener.ts`**

```typescript
import { registerAiAttendance, dispatchAiAction } from "./AiAgentActions";
```

- [ ] **Step 2: Capturar e persistir o CPF quando o cliente responder**

Dentro de `handleOpenAi`, logo após a linha `const bodyMessage = getBodyMessage(msg);` (perto do início da função, antes de qualquer outra lógica), adicionar:

```typescript
  if (!contact.cpfCnpj && bodyMessage) {
    const possivelCpfCnpj = bodyMessage.replace(/\D/g, "");
    if (
      (possivelCpfCnpj.length === 11 || possivelCpfCnpj.length === 14) &&
      validaCpfCnpj(possivelCpfCnpj)
    ) {
      await contact.update({ cpfCnpj: possivelCpfCnpj });
    }
  }
```

- [ ] **Step 3: Atualizar o `promptSystem` (bloco `const promptSystem = ...`, usado pelos dois branches) com contexto de CPF, protocolo e as 4 instruções de ação**

Substituir o bloco atual:

```typescript
  const promptSystem = `Nas respostas utilize o nome ${sanitizeName(
    contact.name || "Amigo(a)"
  )} para identificar o cliente.\nSua resposta deve usar no máximo ${
    prompt.maxTokens
  } tokens e cuide para não truncar o final.\nSempre que possível, mencione o nome dele para ser mais personalizado o atendimento e mais educado. Quando a resposta requer uma transferência para o setor de atendimento, comece sua resposta com 'Ação: Transferir para o setor de atendimento'.\n
  ${prompt.prompt}\n`;
```

por:

```typescript
  const cpfContexto = contact.cpfCnpj
    ? `O CPF/CNPJ deste cliente já é conhecido: ${contact.cpfCnpj}. Não peça de novo.`
    : "O CPF/CNPJ deste cliente ainda não é conhecido. Antes de buscar boleto ou fazer liberação de confiança, peça o CPF/CNPJ dele.";

  const promptSystem = `Nas respostas utilize o nome ${sanitizeName(
    contact.name || "Amigo(a)"
  )} para identificar o cliente.\nSua resposta deve usar no máximo ${
    prompt.maxTokens
  } tokens e cuide para não truncar o final.\nSempre que possível, mencione o nome dele para ser mais personalizado o atendimento e mais educado.\n${cpfContexto}\nO protocolo deste atendimento é #${
    ticket.id
  } — informe ao cliente na saudação inicial e ao encerrar o atendimento.\n
Quando o cliente quiser falar com um atendente humano, termine sua resposta com a frase exata 'Ação: Transferir para Atendimento'.
Quando o cliente relatar um problema técnico (sem conexão, lentidão, equipamento com defeito), termine sua resposta com a frase exata 'Ação: Transferir para Técnico'.
Quando o cliente pedir boleto, 2ª via, fatura ou PIX, e o CPF/CNPJ já for conhecido, termine sua resposta com a frase exata 'Ação: Buscar Boleto'.
Quando o cliente pedir para liberar/religar a conexão por confiança (mesmo estando em débito), e o CPF/CNPJ já for conhecido, termine sua resposta com a frase exata 'Ação: Liberar Confiança'.
Nunca invente valores de boleto, datas ou resultados de liberação — o sistema é quem confirma isso ao cliente depois da sua resposta.\n
  ${prompt.prompt}\n`;
```

- [ ] **Step 4: Substituir o despacho de ação hardcoded pelo `dispatchAiAction`**

Substituir, **só no branch de TEXTO** (ver aviso no topo desta task):

```typescript
    let response = chat.data.choices[0].message?.content;

    if (response?.includes("Ação: Transferir para o setor de atendimento")) {
      await transferQueue(prompt.queueId, ticket, contact);
      response = response
        .replace("Ação: Transferir para o setor de atendimento", "")
        .trim();
    }

    const sentMessage = await wbot.sendMessage(msg.key.remoteJid!, {
      text: response!
    });
    await verifyMessage(sentMessage!, ticket, contact);
```

por:

```typescript
    let response = chat.data.choices[0].message?.content ?? "";

    await registerAiAttendance(ticket, ticket.companyId);

    response = await dispatchAiAction(
      response,
      ticket,
      contact,
      wbot,
      ticket.companyId
    );

    const sentMessage = await wbot.sendMessage(msg.key.remoteJid!, {
      text: response
    });
    await verifyMessage(sentMessage!, ticket, contact);
```

- [ ] **Step 5: Compilar e rodar a suíte completa**

```bash
cd /home/edison/fontes/stonechat/backend
docker build --target builder -t stonechat-test-builder .
docker run --rm -e NODE_ENV=test stonechat-test-builder npx jest --coverage=false
```

Expected: TypeScript compila sem erro (o build já roda `tsc` antes dos testes), todos os testes `PASS`.

- [ ] **Step 6: Commit**

```bash
cd /home/edison/fontes/stonechat
git add backend/src/services/WbotServices/wbotMessageListener.ts
git commit -m "Integra captura de CPF, protocolo e despacho de ações do agente de IA no handleOpenAi"
```

---

### Task 11: Variáveis de ambiente do SGP

**Pré-requisito já atendido:** token do SGP dedicado (`app: "StoneChat"`, exatamente essa capitalização) já foi gerado pelo Edison e testado com sucesso nesta sessão (ver Global Constraints). Valor real em `senhas.txt` — pegar de lá pro Step 3.

**Files:**
- Modify: `backend/.env.example`
- Modify: `docker-compose.yml`

**Interfaces:**
- Consumes: nenhuma
- Produces: `process.env.SGP_URL`, `process.env.SGP_TOKEN` disponíveis em produção — usado pelo `SgpService` (Task 2-4).

- [ ] **Step 1: Adicionar ao `.env.example`**

Em `backend/.env.example`, após o bloco `GERENCIANET_*`:

```
SGP_URL=https://snitelecom.sgp.net.br
SGP_TOKEN=
```

- [ ] **Step 2: Adicionar ao `docker-compose.yml`**

Na seção `environment:` do serviço `stonechat_backend`, após `- GERENCIANET_PIX_KEY=`:

```yaml
      - SGP_URL=${SGP_URL:-https://snitelecom.sgp.net.br}
      - SGP_TOKEN=${SGP_TOKEN:-}
```

- [ ] **Step 3: Adicionar o token real ao `.env` de produção (arquivo fora do git)**

Usar o token dedicado ao `app: "StoneChat"` (seção "SGP API - SNI Telecom" em `/home/edison/senhas.txt`) — **não** o token do SNILog, que só aceita `app: "snilog"`.

```bash
grep -q "^SGP_TOKEN=" /home/edison/fontes/stonechat/.env 2>/dev/null \
  && echo "SGP_TOKEN já existe em .env — confirme se é o token StoneChat (ver senhas.txt), não o do SNILog" \
  || echo "SGP_TOKEN=<token StoneChat, ver /home/edison/senhas.txt>" >> /home/edison/fontes/stonechat/.env
```

- [ ] **Step 4: Rebuild e restart do backend**

```bash
cd /home/edison/fontes/stonechat
docker compose build stonechat_backend
docker compose up -d --no-deps stonechat_backend
sleep 8
docker logs stonechat_backend --since 15s | grep -iE "Socket|Connection Update|error"
```

Expected: reconexão normal (`Socket 8817 Connection Update open`), sem erro.

- [ ] **Step 5: Commit (sem o `.env` real, que não é versionado)**

```bash
cd /home/edison/fontes/stonechat
git add backend/.env.example docker-compose.yml
git commit -m "Adiciona variáveis de ambiente SGP_URL/SGP_TOKEN"
```

---

### Task 12: Configuração manual — filas, Prompt e texto sugerido

Esta task é de configuração via painel administrativo do StoneChat (não é código) — feita pelo Edison ou por quem tiver acesso ao painel em `https://147.15.57.112/stonechat`.

- [ ] **Step 1: Criar as 3 filas**

Painel → Filas & Chatbot → Nova Fila, criar exatamente com estes nomes (o código busca por nome exato, ver Task 6):
- `Atendimento`
- `Técnico`
- `Financeiro`

- [ ] **Step 2: Criar o registro de Prompt (IA)**

Painel → Open.AI → Novo Prompt, preencher:
- **Nome:** Atendente Virtual SNI Telecom
- **API Key:** chave da OpenAI (mesma já usada em outros testes, ou nova dedicada)
- **Modelo:** `gpt-4o-mini` (ou o modelo já usado/testado no projeto)
- **Máximo de mensagens:** 15
- **Máximo de tokens:** 300
- **Temperatura:** 0.3 (baixa — queremos respostas consistentes, não criativas, já que a IA lida com dados financeiros)
- **Prompt (texto sugerido, colar exatamente):**

```
Você é o atendente virtual da SNI Telecom, um provedor de internet banda larga. Seja cordial, direto e use linguagem simples, sem jargão técnico desnecessário. Ao iniciar a conversa, se apresente como o atendente virtual da SNI Telecom.

Você atende quatro tipos de pedido: (1) o cliente quer falar com um atendente humano, (2) o cliente tem um problema técnico (sem internet, lentidão, equipamento com defeito), (3) o cliente quer a 2ª via do boleto ou PIX, (4) o cliente quer liberar/religar a conexão por confiança mesmo estando em débito.

Nunca informe valores de boleto, datas de vencimento, ou se uma liberação foi concedida por conta própria — isso é sempre confirmado pelo sistema depois da sua resposta, com base nos dados reais do SGP.
```

- [ ] **Step 3: Associar o Prompt à conexão WhatsApp "8817"**

Painel → Conexões → editar "8817" → aba de Chatbot/IA → selecionar o Prompt "Atendente Virtual SNI Telecom" criado no Step 2.

- [ ] **Step 4: Confirmar a associação no banco**

```bash
docker exec stonechat_postgres psql -U stonechat -d stonechat -c "SELECT id, name, \"promptId\" FROM \"Whatsapps\" WHERE id=4;"
```

Expected: `promptId` preenchido com o id do Prompt criado.

---

### Task 13: Validação end-to-end via Chromium real

Reaproveita a técnica de teste ad-hoc via Playwright já usada na investigação do bug de entrega (ver `feedback_playwright_adhoc_browser_test` na memória) — mas aqui o teste real é **mandar mensagens de um número de WhatsApp de verdade** para o número conectado, não simular via painel.

- [ ] **Step 1: Testar identificação de cliente novo**

De um número de teste real que nunca falou com o número conectado, mandar "oi". Confirmar que a IA se apresenta como atendente virtual da SNI Telecom e pede o CPF.

- [ ] **Step 2: Testar persistência de CPF**

Responder com um CPF válido de teste. Confirmar no banco que `Contacts.cpfCnpj` foi preenchido:

```bash
docker exec stonechat_postgres psql -U stonechat -d stonechat -c "SELECT id, name, number, \"cpfCnpj\" FROM \"Contacts\" ORDER BY \"updatedAt\" DESC LIMIT 1;"
```

Mandar uma segunda mensagem numa nova conversa (ou o mesmo dia) e confirmar que a IA **não pede o CPF de novo**.

- [ ] **Step 3: Testar os 4 fluxos**

Em conversas separadas (ou reiniciando o ticket entre cada teste), pedir: "quero falar com atendente", "minha internet não funciona", "preciso da segunda via do boleto", "minha internet foi bloqueada, pode liberar?". Para cada um, confirmar:
- A fila correta no painel (`Atendimento`/`Técnico` recebeu o ticket; boleto e liberação fecharam o ticket ou foram pra `Financeiro` conforme o caso).
- A tag "Atendimento IA" aparece no ticket.
- O protocolo (`#<id do ticket>`) foi mencionado pela IA.

- [ ] **Step 4: Confirmar nos logs que não há erro**

```bash
docker logs stonechat_backend --since 10m 2>&1 | grep -iE "error|SgpService" | grep -v "campanhas\|Campanha repeat"
```

Expected: sem erro relacionado a `SgpService`/`AiAgentActions`. Se houver erro de endpoint SGP (404, formato de resposta inesperado), revisar as Tasks 2-4 com o formato real confirmado.
