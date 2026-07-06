# StoneChat — Setup do Projeto (Design)

## Contexto

O repositório `github.com/ecswood/stonechat` foi criado com o conteúdo de dois zips
baixados do GitHub (`codatendechat-main`, `instalador-main`) — um fork do
**Atendechat** (baseado no projeto conhecido como "Whaticket"): sistema white-label
de atendimento multi-empresa via WhatsApp.

**Objetivo do stonechat:** produto white-label para revenda (multi-tenant real —
cada empresa é um cliente pagante), rodando no mesmo servidor que já hospeda
NetManager e SNILog (`147.15.57.112`), dockerizado nos mesmos moldes.

Esta primeira etapa é de **organização do projeto**: reestruturar o repositório,
dockerizar, rebranding leve e criar o agente/skill do projeto. Não inclui
mudanças de funcionalidade, deploy em produção ou configuração de multi-tenant
avançada — isso fica para etapas seguintes.

## Stack identificada

- **Backend:** Express + TypeScript, Sequelize (Postgres), Bull (filas via Redis),
  `@whiskeysockets/baileys` (WhatsApp Web nativo, sem depender da Evolution API),
  Socket.io, JWT, OpenAI (chatbot), Gerencianet (Pix/faturas)
- **Frontend:** React (CRA), Material UI
- **Models principais:** `Company`, `User`, `Plan`, `Subscriptions`, `Invoices`,
  `Whatsapp`, `Ticket`, `Queue`/`QueueOption`, `Campaign`, `Contact`, `Tag`,
  `Prompt` (integração OpenAI), `Schedule`, `QuickMessage`

## Escopo desta etapa

### 1. Reestruturação de diretórios

De:
```
codatendechat-main/{backend,frontend,instalador,package.json,...}
instalador-main/{...}
```
Para:
```
stonechat/
  backend/
  frontend/
  docker-compose.yml
  README.md
  .env.example
```

Remover: `codatendechat-main/instalador/`, `instalador-main/` (raiz),
`codatendechat-main/package.json` e `package-lock.json` de nível raiz (não usados —
backend e frontend têm seus próprios). O instalador bash não é mais necessário
porque o deploy passa a ser via Docker.

### 2. Dockerização

Não existem Dockerfiles de aplicação no repo original (só `Dockerfile.sqlsetup`
para rodar migrations). Criar:

- `backend/Dockerfile` — Node 20, build TypeScript (`npm run build`), roda
  `dist/server.js`
- `frontend/Dockerfile` — build React (`npm run build`) servido por nginx interno
- `docker-compose.yml` na raiz, com 4 serviços:

| Container | Imagem/Build | Função |
|---|---|---|
| `stonechat_backend` | build local | API Express + Baileys |
| `stonechat_frontend` | build local | UI React |
| `stonechat_postgres` | `postgres:15-alpine` | Banco de dados |
| `stonechat_redis` | `redis:7-alpine` | Filas Bull + cache |

Sem volumes montados no código (mesmo padrão do SNILog) — rebuild obrigatório
a cada mudança.

### 3. Rota nginx (deploy no servidor compartilhado)

`https://147.15.57.112/stonechat/` (frontend) e `/stonechat/api/` (backend),
seguindo o padrão de `sni_nginx` (config em
`/home/edison/fontes/SNILog/nginx/default.conf`). Ajuste de config +
`nginx -s reload` — fora do escopo desta primeira etapa de organização (fica
para quando o app estiver buildado e testado localmente primeiro).

### 4. Rebranding visível (Atendechat → StoneChat)

Nenhuma referência de marca existe no código-fonte (`src/`) de backend ou
frontend — só em 4 pontos:
- `frontend/public/index.html` — `<title>`
- `frontend/public/manifest.json` — `name`/`short_name`
- `README.md` do repo (novo, substituindo o do Atendechat)
- `.env.example` — comentários/exemplos

Não altera lógica de negócio nem nomes de variáveis/rotas internas.

### 5. Agente do projeto e skill

Seguindo exatamente o padrão já estabelecido para NetManager e SNILog
(`~/.claude/commands/netmanager.md`, `~/.claude/commands/snilog.md`):

- Criar `~/.claude/commands/stonechat.md` com: localização do projeto,
  repositório, stack, estrutura de pastas, models principais, containers
  Docker, comandos úteis (build, migrate, logs, git) e regras de modificação
  (não alterar segredos/URLs sem autorização, commit após cada mudança
  funcional, rebuild obrigatório por não ter volume montado — herdando as
  regras já validadas no NetManager/SNILog).

## Fora de escopo (próximas etapas)

- Configuração real de multi-tenant para revenda (planos, onboarding de novas
  empresas clientes)
- Deploy efetivo em produção / rota nginx ativa
- Testes de conexão WhatsApp via Baileys
- Rebranding de e-mails transacionais e templates de mensagem
