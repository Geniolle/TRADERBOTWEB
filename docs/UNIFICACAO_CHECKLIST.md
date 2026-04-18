# Checklist de unificação

## Estrutura

- [x] Trazer o backend Python para dentro deste repositório em `backend/`
- [x] Preservar o frontend existente em `web/`
- [ ] Limpar artefatos antigos da raiz (`package.json`, `package-lock.json`, `node_modules`, `.db` vazios) depois de validar a nova estrutura

## Configuração

- [x] Centralizar a base HTTP/WS do frontend para suportar proxy e Docker dev
- [x] Remover hardcodes principais de `127.0.0.1:8000`
- [x] Tornar `CORS_ORIGINS` configurável no backend
- [x] Adicionar defaults faltantes de bootstrap/sync no backend
- [ ] Consolidar variáveis locais antigas em `backend/.env` e `web/.env`

## Docker dev

- [x] Criar `backend/Dockerfile.dev` com `uvicorn --reload`
- [x] Criar `web/Dockerfile.dev` com Vite em modo dev
- [x] Criar `docker-compose.yml` com bind mounts para hot reload
- [x] Configurar polling (`WATCHFILES_FORCE_POLLING`, `CHOKIDAR_USEPOLLING`) para atualizações em tempo real
- [x] Criar volume persistente para o SQLite em `/data/market_research_lab.db`
- [x] Validar build e subida dos containers localmente

## Persistência e limpeza

- [x] Criar `.gitignore` na raiz para `.env`, bancos e caches
- [x] Criar `.dockerignore`
- [x] Criar exemplos de ambiente em `backend/.env.example` e `web/.env.example`
- [ ] Remover do Git os arquivos `market_research_lab.db` e `web/market_research_lab.db`
- [ ] Decidir se o SQLite continua como baseline ou se haverá migração futura para Postgres

## Como subir em dev

```bash
docker compose up --build
```

Frontend:

```text
http://localhost:5173
```

Backend:

```text
http://localhost:8000
http://localhost:8000/api/v1/health
```

## Notas

- O frontend usa proxy Vite para `/api`, então em dev o browser continua a falar com `localhost:5173`.
- O backend continua em SQLite porque `stage_tests` ainda depende diretamente do ficheiro `.db`.
