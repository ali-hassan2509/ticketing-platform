.PHONY: up down logs migrate seed test-lock shell-backend shell-db clean

## Start all services
up:
	@cp -n .env.example .env 2>/dev/null || true
	docker compose up --build -d
	@echo ""
	@echo "🚀 Services starting..."
	@echo "   Frontend:  http://localhost"
	@echo "   Backend:   http://localhost:8000/docs"
	@echo "   Kafka UI:  http://localhost:8080"
	@echo ""
	@echo "Run 'make logs' to follow logs, 'make seed' to add test data."

## Stop all services
down:
	docker compose down

## Follow all logs
logs:
	docker compose logs -f

## Follow backend logs only
logs-backend:
	docker compose logs -f backend

## Run Alembic migrations
migrate:
	docker compose exec backend alembic upgrade head

## Seed the database with test data
seed:
	docker compose exec backend python seed.py

## Run concurrent seat locking load test
test-lock:
	docker compose exec backend python load_test.py --users 20 --event 1

## Open a bash shell in the backend container
shell-backend:
	docker compose exec backend bash

## Open a psql shell
shell-db:
	docker compose exec postgres psql -U ticketing -d ticketing_db

## Rebuild backend only (after code changes)
rebuild-backend:
	docker compose up -d --build backend

## Reset everything (WARNING: deletes all data)
clean:
	docker compose down -v
	@echo "All volumes deleted."

## Show running container status
status:
	docker compose ps
