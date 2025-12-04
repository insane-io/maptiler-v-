.PHONY: help install lint format test qa clean build dev

# Variables
NPM := npm
NODE := node

help:
	@echo "╔════════════════════════════════════════════════════════════╗"
	@echo "║           Frontend Makefile Commands                       ║"
	@echo "╚════════════════════════════════════════════════════════════╝"
	@echo ""
	@echo "Setup:"
	@echo "  make install    - Install dependencies"
	@echo ""
	@echo "Development:"
	@echo "  make dev        - Start development server"
	@echo "  make build      - Build production bundle"
	@echo ""
	@echo "Code Quality:"
	@echo "  make lint       - Run ESLint"
	@echo "  make format     - Format code with Prettier"
	@echo ""
	@echo "Testing:"
	@echo "  make test       - Run tests with coverage"
	@echo ""
	@echo "Complete QA:"
	@echo "  make qa         - Run full QA suite (format + lint + test)"
	@echo ""
	@echo "Maintenance:"
	@echo "  make clean      - Clean build artifacts and dependencies"
	@echo ""

install:
	@echo "📦 Installing frontend dependencies..."
	$(NPM) install
	@echo "✓ Dependencies installed"

dev:
	@echo "🚀 Starting development server..."
	$(NPM) start

lint:
	@echo ""
	@echo "═══════════════════════════════════════"
	@echo "Running Frontend Linting..."
	@echo "═══════════════════════════════════════"
	@echo ""
	@echo "1️⃣  Running ESLint..."
	@$(NPM) run lint || (echo "❌ ESLint found issues" && exit 1)
	@echo "✓ ESLint passed"
	@echo ""
	@echo "2️⃣  Checking code formatting..."
	@$(NPM) run format:check || (echo "❌ Code not formatted correctly" && exit 1)
	@echo "✓ Code formatting is correct"
	@echo ""
	@echo "✅ All linting checks passed!"

format:
	@echo "🎨 Formatting frontend code..."
	@$(NPM) run format
	@echo "✓ Code formatted"

test:
	@echo ""
	@echo "═══════════════════════════════════════"
	@echo "Running Frontend Tests..."
	@echo "═══════════════════════════════════════"
	@echo ""
	@$(NPM) test || (echo "❌ Tests failed" && exit 1)
	@echo ""
	@echo "✅ All tests passed!"
	@echo "📊 Coverage report generated in coverage/"

build:
	@echo "🏗️  Building production bundle..."
	@$(NPM) run build
	@echo "✓ Build complete! Output in build/"

qa: format lint test
	@echo ""
	@echo "╔════════════════════════════════════════════════════════════╗"
	@echo "║                                                            ║"
	@echo "║        ✅  FRONTEND QA SUITE COMPLETED SUCCESSFULLY!       ║"
	@echo "║                                                            ║"
	@echo "╚════════════════════════════════════════════════════════════╝"
	@echo ""

clean:
	@echo "🧹 Cleaning frontend..."
	@rm -rf node_modules build dist coverage .cache
	@rm -f package-lock.json
	@echo "✓ Cleanup complete!"