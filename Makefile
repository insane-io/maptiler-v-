.PHONY: help install lint format test qa security clean build docker-build docker-up docker-down docker-logs all pre-commit-setup

# Colors for pretty output
GREEN=\033[0;32m
BLUE=\033[0;34m
YELLOW=\033[1;33m
RED=\033[0;31m
NC=\033[0m # No Color

help:
	@echo ""
	@echo "╔══════════════════════════════════════════════════════════════════╗"
	@echo "║                                                                  ║"
	@echo "║              🗺️  MAPTILER-V PROJECT MAKEFILE                     ║"
	@echo "║                                                                  ║"
	@echo "╚══════════════════════════════════════════════════════════════════╝"
	@echo ""
	@echo "📋 SETUP COMMANDS:"
	@echo "  make install              - Install all dependencies (backend + frontend)"
	@echo "  make pre-commit-setup     - Setup pre-commit hooks for backend"
	@echo ""
	@echo "🎨 CODE QUALITY:"
	@echo "  make format               - Auto-format all code"
	@echo "  make lint                 - Lint all code"
	@echo ""
	@echo "🧪 TESTING:"
	@echo "  make test                 - Run all tests"
	@echo "  make test-backend         - Run backend tests only"
	@echo "  make test-frontend        - Run frontend tests only"
	@echo ""
	@echo "🔒 SECURITY:"
	@echo "  make security             - Run security checks"
	@echo ""
	@echo "✅ COMPLETE QA:"
	@echo "  make qa                   - Run complete QA suite (format + lint + test + security)"
	@echo ""
	@echo "🏗️  BUILD:"
	@echo "  make build                - Build frontend for production"
	@echo ""
	@echo "🐳 DOCKER:"
	@echo "  make docker-build         - Build Docker images"
	@echo "  make docker-up            - Start all services"
	@echo "  make docker-down          - Stop all services"
	@echo "  make docker-logs          - View Docker logs"
	@echo ""
	@echo "🧹 MAINTENANCE:"
	@echo "  make clean                - Clean all build artifacts"
	@echo "  make clean-all            - Deep clean (including dependencies)"
	@echo ""
	@echo "🚀 QUICK START:"
	@echo "  make all                  - Install + QA + Build + Docker Build"
	@echo ""

install:
	@echo ""
	@echo "╔══════════════════════════════════════════════════════════════════╗"
	@echo "║                                                                  ║"
	@echo "║                    📦 INSTALLING DEPENDENCIES                    ║"
	@echo "║                                                                  ║"
	@echo "╚══════════════════════════════════════════════════════════════════╝"
	@echo ""
	@echo "$(BLUE)→ Installing backend dependencies...$(NC)"
	@cd backend && $(MAKE) install
	@echo ""
	@echo "$(BLUE)→ Installing frontend dependencies...$(NC)"
	@cd frontend && $(MAKE) install
	@echo ""
	@echo "$(GREEN)✅ All dependencies installed successfully!$(NC)"
	@echo ""

pre-commit-setup:
	@echo ""
	@echo "$(BLUE)→ Setting up pre-commit hooks...$(NC)"
	@cd backend && $(MAKE) pre-commit-install
	@echo ""
	@echo "$(BLUE)→ Running pre-commit on all files...$(NC)"
	@cd backend && $(MAKE) pre-commit-run
	@echo ""
	@echo "$(GREEN)✅ Pre-commit hooks configured!$(NC)"

format:
	@echo ""
	@echo "╔══════════════════════════════════════════════════════════════════╗"
	@echo "║                                                                  ║"
	@echo "║                    🎨 FORMATTING ALL CODE                        ║"
	@echo "║                                                                  ║"
	@echo "╚══════════════════════════════════════════════════════════════════╝"
	@echo ""
	@echo "$(BLUE)→ Formatting backend...$(NC)"
	@cd backend && $(MAKE) format
	@echo ""
	@echo "$(BLUE)→ Formatting frontend...$(NC)"
	@cd frontend && $(MAKE) format
	@echo ""
	@echo "$(GREEN)✅ All code formatted successfully!$(NC)"
	@echo ""

lint:
	@echo ""
	@echo "╔══════════════════════════════════════════════════════════════════╗"
	@echo "║                                                                  ║"
	@echo "║                    🔍 LINTING ALL CODE                           ║"
	@echo "║                                                                  ║"
	@echo "╚══════════════════════════════════════════════════════════════════╝"
	@echo ""
	@echo "$(YELLOW)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(NC)"
	@echo "$(BLUE)  BACKEND LINTING$(NC)"
	@echo "$(YELLOW)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(NC)"
	@cd backend && $(MAKE) lint || (echo "$(RED)❌ Backend linting failed$(NC)" && exit 1)
	@echo ""
	@echo "$(YELLOW)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(NC)"
	@echo "$(BLUE)  FRONTEND LINTING$(NC)"
	@echo "$(YELLOW)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(NC)"
	@cd frontend && $(MAKE) lint || (echo "$(RED)❌ Frontend linting failed$(NC)" && exit 1)
	@echo ""
	@echo "$(GREEN)✅ All linting checks passed!$(NC)"
	@echo ""

test:
	@echo ""
	@echo "╔══════════════════════════════════════════════════════════════════╗"
	@echo "║                                                                  ║"
	@echo "║                    🧪 RUNNING ALL TESTS                          ║"
	@echo "║                                                                  ║"
	@echo "╚══════════════════════════════════════════════════════════════════╝"
	@echo ""
	@$(MAKE) test-backend
	@echo ""
	@$(MAKE) test-frontend
	@echo ""
	@echo "$(GREEN)✅ All tests passed!$(NC)"
	@echo ""

test-backend:
	@echo "$(YELLOW)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(NC)"
	@echo "$(BLUE)  BACKEND TESTS$(NC)"
	@echo "$(YELLOW)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(NC)"
	@cd backend && $(MAKE) test || (echo "$(RED)❌ Backend tests failed$(NC)" && exit 1)

test-frontend:
	@echo "$(YELLOW)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(NC)"
	@echo "$(BLUE)  FRONTEND TESTS$(NC)"
	@echo "$(YELLOW)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(NC)"
	@cd frontend && $(MAKE) test || (echo "$(RED)❌ Frontend tests failed$(NC)" && exit 1)

security:
	@echo ""
	@echo "╔══════════════════════════════════════════════════════════════════╗"
	@echo "║                                                                  ║"
	@echo "║                    🔒 SECURITY CHECKS                            ║"
	@echo "║                                                                  ║"
	@echo "╚══════════════════════════════════════════════════════════════════╝"
	@echo ""
	@cd backend && $(MAKE) security
	@echo ""
	@echo "$(GREEN)✅ Security checks complete!$(NC)"
	@echo ""

qa: format lint test security
	@echo ""
	@echo "╔══════════════════════════════════════════════════════════════════╗"
	@echo "║                                                                  ║"
	@echo "║              ✅  COMPLETE QA SUITE PASSED! 🎉                    ║"
	@echo "║                                                                  ║"
	@echo "╚══════════════════════════════════════════════════════════════════╝"
	@echo ""
	@echo "$(GREEN)Summary:$(NC)"
	@echo "  ✓ Code formatted (backend + frontend)"
	@echo "  ✓ Linting passed (backend + frontend)"
	@echo "  ✓ Tests passed with coverage (backend + frontend)"
	@echo "  ✓ Security checks completed (backend)"
	@echo ""
	@echo "$(BLUE)📊 Coverage Reports:$(NC)"
	@echo "  Backend:  backend/htmlcov/index.html"
	@echo "  Frontend: frontend/coverage/lcov-report/index.html"
	@echo ""
	@echo "$(GREEN)🚀 Ready to commit!$(NC)"
	@echo ""

build:
	@echo ""
	@echo "╔══════════════════════════════════════════════════════════════════╗"
	@echo "║                                                                  ║"
	@echo "║                    🏗️  BUILDING FRONTEND                         ║"
	@echo "║                                                                  ║"
	@echo "╚══════════════════════════════════════════════════════════════════╝"
	@echo ""
	@cd frontend && $(MAKE) build
	@echo ""
	@echo "$(GREEN)✅ Frontend build complete!$(NC)"
	@echo "$(BLUE)📦 Output: frontend/build/$(NC)"
	@echo ""

docker-build:
	@echo ""
	@echo "╔══════════════════════════════════════════════════════════════════╗"
	@echo "║                                                                  ║"
	@echo "║                    🐳 BUILDING DOCKER IMAGES                     ║"
	@echo "║                                                                  ║"
	@echo "╚══════════════════════════════════════════════════════════════════╝"
	@echo ""
	@docker-compose build --no-cache || (echo "$(RED)❌ Docker build failed$(NC)" && exit 1)
	@echo ""
	@echo "$(GREEN)✅ Docker images built successfully!$(NC)"
	@echo ""

docker-build-dev:
	@echo "$(BLUE)🐳 Building development Docker images...$(NC)"
	@docker-compose -f docker-compose.dev.yml build
	@echo "$(GREEN)✅ Development images built!$(NC)"

docker-up:
	@echo ""
	@echo "$(BLUE)🐳 Starting production services...$(NC)"
	@docker-compose up -d
	@echo ""
	@echo "$(GREEN)✅ Services started!$(NC)"
	@echo ""
	@echo "$(BLUE)📍 Services:$(NC)"
	@echo "  Backend:  http://localhost:8000"
	@echo "  Frontend: http://localhost"
	@echo ""
	@echo "$(YELLOW)💡 View logs: make docker-logs$(NC)"
	@echo ""

docker-up-dev:
	@echo "$(BLUE)🐳 Starting development services...$(NC)"
	@docker-compose -f docker-compose.dev.yml up -d
	@echo ""
	@echo "$(GREEN)✅ Development services started!$(NC)"
	@echo "  Backend:  http://localhost:8000 (hot reload)"
	@echo "  Frontend: http://localhost:3000 (hot reload)"
	@echo ""

docker-down:
	@echo ""
	@echo "$(BLUE)🐳 Stopping all services...$(NC)"
	@docker-compose down
	@docker-compose -f docker-compose.dev.yml down 2>/dev/null || true
	@echo ""
	@echo "$(GREEN)✅ Services stopped!$(NC)"
	@echo ""

docker-logs:
	@echo ""
	@echo "$(BLUE)📜 Viewing Docker logs (Ctrl+C to exit)...$(NC)"
	@echo ""
	@docker-compose logs -f

docker-restart:
	@echo "$(BLUE)🔄 Restarting services...$(NC)"
	@docker-compose restart
	@echo "$(GREEN)✅ Services restarted!$(NC)"

docker-ps:
	@echo "$(BLUE)📊 Running containers:$(NC)"
	@docker-compose ps

deploy:
	@echo "$(BLUE)🚀 Running deployment script...$(NC)"
	@chmod +x deploy.sh
	@./deploy.sh

clean:
	@echo ""
	@echo "$(BLUE)🧹 Cleaning build artifacts...$(NC)"
	@cd backend && $(MAKE) clean
	@cd frontend && $(MAKE) clean
	@rm -rf .pytest_cache
	@echo ""
	@echo "$(GREEN)✅ Cleanup complete!$(NC)"
	@echo ""

clean-all: clean
	@echo ""
	@echo "$(YELLOW)🧹 Deep cleaning (removing dependencies)...$(NC)"
	@cd backend && rm -rf venv .venv
	@cd frontend && rm -rf node_modules
	@docker-compose down -v --remove-orphans 2>/dev/null || true
	@echo ""
	@echo "$(GREEN)✅ Deep clean complete!$(NC)"
	@echo ""

all: install qa build docker-build
	@echo ""
	@echo "╔══════════════════════════════════════════════════════════════════╗"
	@echo "║                                                                  ║"
	@echo "║              🎉  PROJECT SETUP COMPLETE!                         ║"
	@echo "║                                                                  ║"
	@echo "║  ✓ Dependencies installed                                        ║"
	@echo "║  ✓ QA checks passed                                              ║"
	@echo "║  ✓ Frontend built                                                ║"
	@echo "║  ✓ Docker images ready                                           ║"
	@echo "║                                                                  ║"
	@echo "║  Run 'make docker-up' to start the application!                 ║"
	@echo "║                                                                  ║"
	@echo "╚══════════════════════════════════════════════════════════════════╝"
	@echo ""



# Production commands  
docker-build-prod:
	@echo "$(BLUE)🐳 Building production Docker images...$(NC)"
	@docker-compose -p maptiler build
	@echo "$(GREEN)✅ Production images built!$(NC)"

docker-up-prod:
	@echo "$(BLUE)🐳 Starting production services...$(NC)"
	@docker-compose -p maptiler up -d
	@echo ""
	@echo "$(GREEN)✅ Production services started!$(NC)"
	@echo "  Backend:  http://localhost:8000"
	@echo "  Frontend: http://localhost"
