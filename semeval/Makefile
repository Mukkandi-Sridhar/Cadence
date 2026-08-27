.PHONY: up down migrate migration migration-history test test-unit lint-backend fmt-backend lint-frontend typecheck-backend typecheck-frontend gate-0 clean logs db-shell redis-cli

DOCKER_COMPOSE := docker compose
BACKEND_RUN    := $(DOCKER_COMPOSE) run --rm backend
FRONTEND_RUN   := $(DOCKER_COMPOSE) run --rm frontend

# ── Infrastructure ────────────────────────────────────────────────────────────

## Start all services (build if needed)
up:
	cp -n .env.example .env 2>/dev/null || true
	$(DOCKER_COMPOSE) up --build -d
	@echo "Waiting for services to be healthy..."
	$(DOCKER_COMPOSE) run --rm backend sh -c "until pg_isready -h db -U semeval; do sleep 1; done"

## Stop all services
down:
	$(DOCKER_COMPOSE) down

## Stop and remove all data volumes
clean:
	$(DOCKER_COMPOSE) down -v --remove-orphans

# ── Database ──────────────────────────────────────────────────────────────────

## Apply all Alembic migrations
migrate:
	$(BACKEND_RUN) alembic upgrade head

## Create a new migration (usage: make migration MSG="add foo table")
migration:
	$(BACKEND_RUN) alembic revision --autogenerate -m "$(MSG)"

## Show migration history
migration-history:
	$(BACKEND_RUN) alembic history --verbose

# ── Quality gates ─────────────────────────────────────────────────────────────

## Run ruff linter on backend
lint-backend:
	$(BACKEND_RUN) ruff check semeval/ tests/

## Run ruff formatter check on backend
fmt-backend:
	$(BACKEND_RUN) ruff format --check semeval/ tests/

## Run frontend linter
lint-frontend:
	$(FRONTEND_RUN) npm run lint

## Run backend type-check (mypy)
typecheck-backend:
	$(BACKEND_RUN) mypy semeval/

## Run frontend type-check
typecheck-frontend:
	$(FRONTEND_RUN) npm run typecheck

## Run unit tests only
test-unit:
	$(BACKEND_RUN) python -m pytest tests/unit/ -v --tb=short

## Run all tests
test:
	$(BACKEND_RUN) python -m pytest tests/ -v --tb=short

# ── Phase 0 gate ──────────────────────────────────────────────────────────────

## GATE 0: clean start → services healthy → migrations → lint → typecheck → unit tests
gate-0: up migrate lint-backend typecheck-frontend test-unit
	@echo ""
	@echo "╔══════════════════════════════════════════════╗"
	@echo "║         GATE 0 PASSED ✓                      ║"
	@echo "║  Services: healthy  Migrations: applied       ║"
	@echo "║  Lint: clean  Typecheck: clean  Tests: green  ║"
	@echo "╚══════════════════════════════════════════════╝"

# ── Utilities ─────────────────────────────────────────────────────────────────

## Tail logs
logs:
	$(DOCKER_COMPOSE) logs -f

## Open a psql shell
db-shell:
	$(DOCKER_COMPOSE) exec db psql -U semeval semeval

## Open a Redis CLI
redis-cli:
	$(DOCKER_COMPOSE) exec redis redis-cli
