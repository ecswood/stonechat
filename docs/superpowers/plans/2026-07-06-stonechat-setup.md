# StoneChat — Setup do Projeto Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reestruturar o repositório `stonechat` (fork do Atendechat), dockerizá-lo nos mesmos moldes de NetManager/SNILog, aplicar rebranding textual leve e criar o skill `/stonechat` — deixando o projeto pronto para rodar localmente no servidor compartilhado (147.15.57.112), sem ainda expor via nginx público nem mexer em funcionalidades.

**Architecture:** Monorepo `backend/` (Express + TypeScript + Sequelize/Postgres + Bull/Redis + Baileys) e `frontend/` (React/CRA), cada um com seu `Dockerfile` multi-stage, orquestrados por um `docker-compose.yml` na raiz que já se conecta à rede Docker externa `snilog_sni_network` (mesma usada pelo NetManager), preparando o terreno para uma rota nginx futura sem expor nada publicamente ainda.

**Tech Stack:** Node.js 20, Express, TypeScript, Sequelize, PostgreSQL 15, Redis 7, React (CRA), Docker/Docker Compose, Nginx (só para servir o frontend estático).

## Global Constraints

- Repositório local: `/home/edison/fontes/stonechat/` (já clonado de `git@github.com:ecswood/stonechat.git`)
- Não alterar lógica de negócio, rotas, models ou nomes de variáveis internas do código-fonte
- Não expor o projeto publicamente via nginx nesta etapa (fica para um plano seguinte)
- Sem volumes de código montados nos containers (mesmo padrão do SNILog) — rebuild obrigatório a cada mudança futura
- Rebranding limitado a: `frontend/public/index.html`, `frontend/public/manifest.json`, `frontend/package.json` (`nomeEmpresa`), `README.md`, `.env.example`
- Commit após cada tarefa concluída (padrão já validado no NetManager/SNILog)
- Usuário/senha padrão pós-seed do banco: `admin@admin.com` / `123456` (login de teste local, não usar em produção)

---

### Task 1: Reestruturar diretórios do repositório

**Files:**
- Move: `codatendechat-main/backend/` → `backend/`
- Move: `codatendechat-main/frontend/` → `frontend/`
- Delete: `codatendechat-main/instalador/`, `codatendechat-main/package.json`, `codatendechat-main/package-lock.json`, `codatendechat-main/README.md`, `codatendechat-main/.gitattributes`, `codatendechat-main/.gitignore`, `codatendechat-main/.github/`
- Delete: `instalador-main/` (pasta raiz inteira)
- Create: `.gitignore` (raiz)

**Interfaces:**
- Produces: layout final `backend/` e `frontend/` na raiz do repo, consumido por todas as tarefas seguintes (Dockerfiles referenciam `./backend` e `./frontend` como build context)

- [ ] **Step 1: Mover backend e frontend para a raiz**

```bash
cd /home/edison/fontes/stonechat
git mv codatendechat-main/backend backend
git mv codatendechat-main/frontend frontend
```

- [ ] **Step 2: Remover instalador e arquivos órfãos do Atendechat**

```bash
git rm -r codatendechat-main/instalador
git rm codatendechat-main/package.json codatendechat-main/package-lock.json
git rm codatendechat-main/README.md codatendechat-main/.gitattributes codatendechat-main/.gitignore
git rm -r codatendechat-main/.github
git rm -r instalador-main
rmdir codatendechat-main 2>/dev/null || true
```

- [ ] **Step 3: Criar `.gitignore` na raiz**

```
node_modules
dist
build
.env
.env.*
!.env.example
*.log
.DS_Store
```

Salvar como `/home/edison/fontes/stonechat/.gitignore`.

- [ ] **Step 4: Verificar estrutura final**

```bash
find . -maxdepth 1 -not -path '*/.git*' | sort
```

Expected:
```
.
./.gitignore
./backend
./frontend
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Reestrutura repositório: backend/frontend na raiz, remove instalador bash"
```

---

### Task 2: Rebranding textual (Atendechat → StoneChat)

**Files:**
- Modify: `frontend/public/index.html`
- Modify: `frontend/public/manifest.json`
- Modify: `frontend/package.json`
- Create: `README.md` (raiz, substitui o antigo removido na Task 1)

**Interfaces:**
- Consumes: layout da Task 1
- Produces: nenhuma interface de código — só texto visível ao usuário

- [ ] **Step 1: Trocar título da página**

Em `frontend/public/index.html`, trocar:
```html
<title>Atendechat</title>
```
por:
```html
<title>StoneChat</title>
```

- [ ] **Step 2: Trocar manifest.json**

Em `frontend/public/manifest.json`, trocar `"short_name": "Atendechat"` e `"name": "Atendechat"` por `"short_name": "StoneChat"` e `"name": "StoneChat"`.

- [ ] **Step 3: Trocar nome exibido no Login**

Em `frontend/package.json`, trocar:
```json
"nomeEmpresa": "Atendechat",
```
por:
```json
"nomeEmpresa": "StoneChat",
```

(Esse valor é importado em `frontend/src/pages/Login/index.js:15` e exibido no rodapé da tela de login — não precisa mexer nesse arquivo, só no `package.json`.)

- [ ] **Step 4: Criar README.md novo na raiz**

```markdown
# StoneChat

Sistema white-label de atendimento multi-empresa via WhatsApp (fork do Atendechat/Whaticket).

## Stack

- Backend: Express + TypeScript + Sequelize (PostgreSQL) + Bull (Redis) + Baileys (WhatsApp Web)
- Frontend: React

## Rodando localmente com Docker

\`\`\`bash
cp .env.example .env
# editar .env com senhas/segredos próprios
docker compose build
docker compose up -d
docker compose exec backend npx sequelize db:migrate
docker compose exec backend npx sequelize db:seed:all
\`\`\`

Login padrão pós-seed: `admin@admin.com` / `123456`.
```

- [ ] **Step 5: Verificar que não sobrou "Atendechat" visível**

```bash
grep -ril "atendechat" frontend/public frontend/package.json README.md
```

Expected: nenhuma saída (comando não encontra nada, exit code 1)

- [ ] **Step 6: Commit**

```bash
git add frontend/public/index.html frontend/public/manifest.json frontend/package.json README.md
git commit -m "Rebranding: Atendechat -> StoneChat (título, manifest, package.json, README)"
```

---

### Task 3: Dockerfile do backend

**Files:**
- Create: `backend/Dockerfile`
- Create: `backend/.dockerignore`

**Interfaces:**
- Consumes: `backend/` da Task 1 (com `package.json`, `.sequelizerc`, `src/`, `public/.gitkeep`)
- Produces: imagem Docker que expõe porta `8080` e roda `node dist/server.js`; consumida pelo `docker-compose.yml` da Task 5 como `build.context: ./backend`

- [ ] **Step 1: Criar `.dockerignore`**

```
node_modules
dist
.env
.env.test
*.log
```

Salvar como `backend/.dockerignore`.

- [ ] **Step 2: Criar o Dockerfile**

```dockerfile
# Stage 1: Build
FROM node:20-bullseye-slim AS builder

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install --force

COPY . .

RUN npm run build

# Stage 2: Production Runtime
FROM node:20-bullseye-slim

# Dependências de sistema exigidas pelo Chromium baixado pelo puppeteer
# (usado em src/services/WbotServices/providers.ts)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates fonts-liberation libasound2 libatk-bridge2.0-0 libatk1.0-0 \
    libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgbm1 \
    libgcc1 libglib2.0-0 libgtk-3-0 libnspr4 libnss3 libpango-1.0-0 libpangocairo-1.0-0 \
    libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 \
    libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 lsb-release \
    wget xdg-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

COPY package*.json ./
COPY .sequelizerc ./

COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/public ./public

EXPOSE 8080

CMD ["node", "dist/server.js"]
```

Salvar como `backend/Dockerfile`.

- [ ] **Step 3: Build isolado para verificar que a imagem compila**

```bash
cd /home/edison/fontes/stonechat
docker build -t stonechat-backend-test ./backend
```

Expected: build termina com `Successfully tagged stonechat-backend-test:latest` (ou linha final `naming to docker.io/library/stonechat-backend-test` no BuildKit), sem erros de `tsc` nem de `apt-get`.

- [ ] **Step 4: Commit**

```bash
git add backend/Dockerfile backend/.dockerignore
git commit -m "Adiciona Dockerfile multi-stage do backend"
```

---

### Task 4: Dockerfile do frontend

**Files:**
- Create: `frontend/Dockerfile`
- Create: `frontend/nginx.conf`
- Create: `frontend/.dockerignore`

**Interfaces:**
- Consumes: `frontend/` da Task 1 e 2 (já rebrandado)
- Produces: imagem Docker que serve o build estático na porta `80`; consumida pelo `docker-compose.yml` da Task 5 como `build.context: ./frontend`
- Aceita build arg `REACT_APP_BACKEND_URL` (default `http://147.15.57.112:8081`), consumido pelo `docker-compose.yml` da Task 5

- [ ] **Step 1: Criar `.dockerignore`**

```
node_modules
build
.env
```

Salvar como `frontend/.dockerignore`.

- [ ] **Step 2: Criar `nginx.conf`**

```nginx
server {
    listen 80;
    server_name localhost;

    location / {
        root /usr/share/nginx/html;
        index index.html index.htm;
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|otf)$ {
        root /usr/share/nginx/html;
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }

    error_page 500 502 503 504 /50x.html;
    location = /50x.html {
        root /usr/share/nginx/html;
    }
}
```

Salvar como `frontend/nginx.conf`.

- [ ] **Step 3: Criar o Dockerfile**

```dockerfile
# Stage 1: Build React SPA
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

ARG REACT_APP_BACKEND_URL=http://147.15.57.112:8081
ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL
ENV NODE_OPTIONS=--openssl-legacy-provider
ENV GENERATE_SOURCEMAP=false

COPY package*.json ./

RUN npm install --force

COPY . .

RUN npm run build

# Stage 2: Serve using Nginx
FROM nginx:stable-alpine

COPY --from=builder /usr/src/app/build /usr/share/nginx/html

COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

Salvar como `frontend/Dockerfile`.

- [ ] **Step 4: Build isolado para verificar que a imagem compila**

```bash
cd /home/edison/fontes/stonechat
docker build -t stonechat-frontend-test ./frontend
```

Expected: build termina sem erros do `react-scripts build` (pode gerar warnings de ESLint, isso é normal e não impede o build).

- [ ] **Step 5: Commit**

```bash
git add frontend/Dockerfile frontend/nginx.conf frontend/.dockerignore
git commit -m "Adiciona Dockerfile multi-stage do frontend com nginx"
```

---

### Task 5: docker-compose.yml e variáveis de ambiente

**Files:**
- Create: `docker-compose.yml` (raiz)
- Create: `.env.example` (raiz)

**Interfaces:**
- Consumes: `backend/Dockerfile` (Task 3), `frontend/Dockerfile` (Task 4)
- Produces: rede `sni_network` (externa, `snilog_sni_network`) usada pelos containers `stonechat_backend`/`stonechat_frontend` — mesma rede já usada pelo `netmanager_app`, preparando conexão futura ao `sni_nginx` sem expor nada publicamente ainda

- [ ] **Step 1: Criar `.env.example`**

```
DB_NAME=stonechat
DB_USER=stonechat
DB_PASS=mudar_senha_forte_123

JWT_SECRET=troque_este_segredo_jwt
JWT_REFRESH_SECRET=troque_este_segredo_refresh

BACKEND_URL=http://147.15.57.112:8081
FRONTEND_URL=http://147.15.57.112:8082
```

Salvar como `.env.example` (raiz).

- [ ] **Step 2: Criar `docker-compose.yml`**

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: stonechat_postgres
    environment:
      POSTGRES_DB: ${DB_NAME:-stonechat}
      POSTGRES_USER: ${DB_USER:-stonechat}
      POSTGRES_PASSWORD: ${DB_PASS:-mudar_senha_forte_123}
    volumes:
      - stonechat_pgdata:/var/lib/postgresql/data
    restart: always
    networks:
      - sni_network

  redis:
    image: redis:7-alpine
    container_name: stonechat_redis
    command: redis-server --save 60 1 --loglevel warning
    restart: always
    volumes:
      - stonechat_redis_data:/data
    networks:
      - sni_network

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: stonechat_backend
    environment:
      - NODE_ENV=production
      - BACKEND_URL=${BACKEND_URL:-http://147.15.57.112:8081}
      - FRONTEND_URL=${FRONTEND_URL:-http://147.15.57.112:8082}
      - PROXY_PORT=8080
      - PORT=8080
      - DB_DIALECT=postgres
      - DB_HOST=postgres
      - DB_PORT=5432
      - DB_USER=${DB_USER:-stonechat}
      - DB_PASS=${DB_PASS:-mudar_senha_forte_123}
      - DB_NAME=${DB_NAME:-stonechat}
      - JWT_SECRET=${JWT_SECRET:-troque_este_segredo_jwt}
      - JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET:-troque_este_segredo_refresh}
      - REDIS_URI=redis://redis:6379
      - REDIS_OPT_LIMITER_MAX=1
      - REDIS_OPT_LIMITER_DURATION=3000
      - USER_LIMIT=10000
      - CONNECTIONS_LIMIT=10
      - CLOSED_SEND_BY_ME=true
      - GERENCIANET_SANDBOX=false
      - GERENCIANET_CLIENT_ID=
      - GERENCIANET_CLIENT_SECRET=
      - GERENCIANET_PIX_CERT=
      - GERENCIANET_PIX_KEY=
      - MAIL_HOST=smtp.gmail.com
      - MAIL_USER=
      - MAIL_PASS=
      - MAIL_FROM=
      - MAIL_PORT=465
    ports:
      - "8081:8080"
    volumes:
      - stonechat_backend_public:/usr/src/app/public
    depends_on:
      - postgres
      - redis
    restart: always
    networks:
      - sni_network

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      args:
        REACT_APP_BACKEND_URL: ${BACKEND_URL:-http://147.15.57.112:8081}
    container_name: stonechat_frontend
    ports:
      - "8082:80"
    depends_on:
      - backend
    restart: always
    networks:
      - sni_network

networks:
  sni_network:
    external: true
    name: snilog_sni_network

volumes:
  stonechat_pgdata:
  stonechat_redis_data:
  stonechat_backend_public:
```

Salvar como `docker-compose.yml` (raiz).

- [ ] **Step 3: Validar sintaxe do compose**

```bash
cd /home/edison/fontes/stonechat
cp .env.example .env
docker compose config --quiet
```

Expected: nenhuma saída (exit code 0 = YAML e variáveis válidas)

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml .env.example
git commit -m "Adiciona docker-compose.yml e .env.example"
```

---

### Task 6: Subir os containers, migrar o banco e verificar

**Files:**
- Nenhum arquivo novo — só execução e verificação

**Interfaces:**
- Consumes: tudo das Tasks 1-5
- Produces: ambiente local funcional em `http://147.15.57.112:8081` (API) e `http://147.15.57.112:8082` (frontend)

- [ ] **Step 1: Confirmar que a rede externa existe**

```bash
docker network ls | grep snilog_sni_network
```

Expected: uma linha com `snilog_sni_network` (criada pelo SNILog). Se não existir, rodar `docker compose up -d` uma vez no diretório do SNILog antes de continuar.

- [ ] **Step 2: Build e subir os containers**

```bash
cd /home/edison/fontes/stonechat
docker compose build
docker compose up -d
```

Expected: `docker compose ps` mostra `stonechat_postgres`, `stonechat_redis`, `stonechat_backend`, `stonechat_frontend` com status `running`/`Up`.

- [ ] **Step 3: Rodar migrations e seed**

```bash
docker compose exec backend npx sequelize db:migrate
docker compose exec backend npx sequelize db:seed:all
```

Expected: saída lista as 142 migrations com `== ... migrated (Xs)` e os seeds sem erro `SequelizeConnectionError`.

- [ ] **Step 4: Testar login da API**

```bash
curl -s -X POST http://147.15.57.112:8081/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@admin.com","password":"123456"}'
```

Expected: JSON contendo `"token"` e `"user"` (login bem-sucedido usando o usuário criado pelo seed).

- [ ] **Step 5: Testar frontend**

```bash
curl -s -o /dev/null -w "%{http_code}" http://147.15.57.112:8082/
```

Expected: `200`

- [ ] **Step 6: Checar logs por erros**

```bash
docker compose logs backend --tail=50
```

Expected: sem stack traces de erro; deve aparecer `Server started on port: 8080`

- [ ] **Step 7: Commit (se algum ajuste foi necessário durante a verificação)**

```bash
git add -A
git commit -m "Ajustes de verificação do ambiente Docker do stonechat"
```

(Pular este commit se nenhum arquivo foi alterado nesta tarefa.)

---

### Task 7: Criar skill `/stonechat`

**Files:**
- Create: `~/.claude/commands/stonechat.md`

**Interfaces:**
- Consumes: toda a estrutura e decisões das Tasks 1-6 (documenta o estado real do projeto)
- Produces: skill invocável via `/stonechat <tarefa>`, no mesmo padrão de `~/.claude/commands/netmanager.md` e `~/.claude/commands/snilog.md`

- [ ] **Step 1: Criar o arquivo do skill**

```markdown
# Skill: StoneChat

Quando este skill for invocado, carregue todo o contexto do projeto StoneChat e ajude o usuário com qualquer tarefa relacionada a ele.

## Contexto do projeto

**Localização:** `/home/edison/fontes/stonechat/`
**Repositório:** `git@github.com:ecswood/stonechat.git`
**Stack:** Express + TypeScript + Sequelize (PostgreSQL) + Bull (Redis) + Baileys (WhatsApp Web nativo) + Socket.io + React (CRA) + Docker Compose
**Objetivo:** produto white-label de atendimento via WhatsApp multi-empresa, para revenda (multi-tenant real — cada empresa é um cliente pagante)

## O que é o StoneChat

Fork do Atendechat (baseado no projeto conhecido como "Whaticket"). Sistema de atendimento multi-empresa via WhatsApp com:
- Conexão WhatsApp via Baileys (sessão salva no banco, model `Whatsapp.session`, sem depender da Evolution API)
- Filas de atendimento (`Queue`/`QueueOption`) com chatbot de opções
- Tickets (`Ticket`, `TicketNote`, `TicketTag`, `TicketTraking`) com transferência automática (`wbotTransferTicketQueue.ts`, cron a cada minuto)
- Campanhas de disparo em massa (`Campaign`, `CampaignShipping`, `CampaignSetting`)
- Integração OpenAI para chatbot com IA (`Prompt` model)
- Planos/assinaturas/faturas (`Plan`, `Subscriptions`, `Invoices`) com Gerencianet (Pix)
- Multi-empresa (`Company`) — cada empresa isolada por `companyId` nas tabelas

## Estrutura de pastas

```
backend/src/
  app.ts, server.ts, bootstrap.ts
  config/            — database.ts (dialect via DB_DIALECT), upload.ts (pasta public/)
  models/            — Company, User, Plan, Whatsapp, Ticket, Queue, Campaign, Prompt, etc.
  controllers/, routes/, services/
  libs/wbot.ts        — conexão Baileys
  helpers/authState.ts — persiste sessão Baileys em Whatsapp.session (banco, não filesystem)
  database/migrations/ — 142 migrations (rodar via `npx sequelize db:migrate`, exige build antes — aponta pra dist/)
  database/seeds/     — seed cria Plano 1, Empresa 1 e usuário admin@admin.com/123456
  queues.ts           — filas Bull
  wbotTransferTicketQueue.ts — transferência automática de tickets (cron * * * * *)

frontend/src/
  pages/Login/index.js — exibe `nomeEmpresa` do package.json
  App.js, routes/, components/, pages/, services/
```

## Containers Docker

| Container | Imagem/Build | Função |
|---|---|---|
| `stonechat_backend` | build `./backend` | API Express + Baileys, porta 8080 (host 8081) |
| `stonechat_frontend` | build `./frontend` | React servido por nginx, porta 80 (host 8082) |
| `stonechat_postgres` | `postgres:15-alpine` | Banco de dados |
| `stonechat_redis` | `redis:7-alpine` | Filas Bull + cache |

Rede Docker: `snilog_sni_network` (externa, compartilhada com NetManager) — preparado para receber rota nginx futura em `sni_nginx`, mas **ainda não exposto publicamente**.

## Comandos úteis

\`\`\`bash
# Logs em tempo real
docker compose -f /home/edison/fontes/stonechat/docker-compose.yml logs backend -f
docker compose -f /home/edison/fontes/stonechat/docker-compose.yml logs frontend -f

# Rebuild obrigatório para qualquer mudança de código (sem volume montado)
cd /home/edison/fontes/stonechat
docker compose build backend && docker compose up -d --no-deps backend
docker compose build frontend && docker compose up -d --no-deps frontend

# Rodar migrations/seed
docker compose exec backend npx sequelize db:migrate
docker compose exec backend npx sequelize db:seed:all

# Testar login
curl -s -X POST http://147.15.57.112:8081/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"email":"admin@admin.com","password":"123456"}'

# Acessar banco
docker exec -it stonechat_postgres psql -U stonechat -d stonechat

# Git — commitar após cada alteração funcional
cd /home/edison/fontes/stonechat
git add <arquivos> && git commit -m "msg" && git push origin main
\`\`\`

## Regras ao modificar o projeto

1. **Rebuild obrigatório** — sem volume montado no backend nem no frontend (exceto `public/` do backend, que é volume de dados, não de código)
2. **Não expor via nginx público** sem confirmar com o Edison — ainda não é etapa aprovada
3. **Não alterar senhas, secrets, `.env` ou credenciais** sem pedir permissão ao Edison primeiro
4. **Sessão WhatsApp fica no banco** (`Whatsapp.session`, via Baileys) — não criar volume de filesystem pra isso, seria redundante
5. **Migrations rodam contra `dist/`** (ver `.sequelizerc`) — sempre `npm run build`/rebuild da imagem antes de `db:migrate` depois de mudar uma migration
6. **Puppeteer** (`src/services/WbotServices/providers.ts`) exige as libs de sistema do Chromium instaladas no Dockerfile — não remover esse bloco `apt-get install` ao editar a imagem
7. **Multi-empresa é o modelo de negócio** (`Company`/`Plan`/`Subscriptions`) — ao adicionar features, sempre isolar por `companyId`, nunca vazar dados entre empresas
8. **Commitar imediatamente** após cada alteração funcional

## Tarefa

$ARGUMENTS

Leia os arquivos relevantes antes de propor ou executar qualquer mudança. Confirme o entendimento e o plano com o Edison antes de modificar código de produção.
```

Salvar como `/home/edison/.claude/commands/stonechat.md`.

- [ ] **Step 2: Verificar que o arquivo foi criado corretamente**

```bash
head -5 /home/edison/.claude/commands/stonechat.md
```

Expected: mostra `# Skill: StoneChat` e as linhas seguintes do cabeçalho.

- [ ] **Step 3: Commit (apenas no repo stonechat, o arquivo do skill fica fora do repo git)**

Este arquivo vive em `~/.claude/commands/`, fora do repositório `stonechat` — não precisa de commit git, mas confirme que os outros commits das tarefas anteriores já foram todos feitos:

```bash
cd /home/edison/fontes/stonechat
git status
git push origin main
```

Expected: `git status` limpo (`nothing to commit, working tree clean`) e push bem-sucedido.

---

## Self-Review Notes

- **Cobertura do spec:** reestruturação (Task 1), rebranding (Task 2), Dockerfiles (Tasks 3-4), compose+env (Task 5), verificação end-to-end (Task 6) e skill (Task 7) — todas as seções do spec `2026-07-06-stonechat-setup-design.md` têm tarefa correspondente. Rota nginx pública fica explicitamente fora do escopo (Global Constraints).
- **Placeholders:** nenhum "TBD"/"TODO" — todos os arquivos têm conteúdo completo copiável.
- **Consistência:** portas (backend 8080→8081, frontend 80→8082), nomes de containers (`stonechat_*`), rede (`snilog_sni_network`) e variáveis de ambiente (`DB_NAME`, `DB_USER`, `DB_PASS`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `BACKEND_URL`, `FRONTEND_URL`) usadas de forma idêntica entre `.env.example`, `docker-compose.yml` e o skill.
