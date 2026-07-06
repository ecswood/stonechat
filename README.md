# StoneChat

Sistema white-label de atendimento multi-empresa via WhatsApp (fork do Atendechat/Whaticket).

## Stack

- Backend: Express + TypeScript + Sequelize (PostgreSQL) + Bull (Redis) + Baileys (WhatsApp Web)
- Frontend: React

## Rodando localmente com Docker

```bash
cp .env.example .env
# editar .env com senhas/segredos próprios
docker compose build
docker compose up -d
docker compose exec backend npx sequelize db:migrate
docker compose exec backend npx sequelize db:seed:all
```

Login padrão pós-seed: `admin@admin.com` / `123456`.
