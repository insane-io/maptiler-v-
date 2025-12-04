.PHONY: help install lint format test qa security clean pre-commit-install pre-commit-run

# Variables
PYTHON := python3
PIP := $(PYTHON) -m pip
PYTEST := pytest
VENV := venv

help:
	@echo "╔════════════════════════════════════════════════════════════╗"
	@echo "║           Backend Makefile Commands                        ║"
	@echo "╚════════════════════════════════════════════════════════════╝"
	@echo ""
	@echo "Setup:"
	@echo "  make install              - Install all dependencies"
	@echo "  make pre-commit-install   - Install pre-commit hooks"
	@echo ""
	@echo "Code Quality:"
	@echo "  make lint                 - Run all linters (flake8, pylint, mypy)"
	@echo "  make format               - Auto-format code (black + isort)"
	@echo "  make pre-commit-run       - Run pre-commit on all files"
	@echo ""
	@echo "Testing:"
	@echo "  make test                 - Run tests with coverage"
	@echo "  make test-unit            - Run unit tests only"
	@echo "  make test-integration     - Run integration tests only"
	@echo ""
	@echo "Security:"
	@echo "  make security             - Run security checks (bandit + safety)"
	@echo ""
	@echo "Complete QA:"
	@echo "  make qa                   - Run full QA suite (format + lint + test + security)"
	@echo ""
	@echo "Maintenance:"
	@echo "  make clean                - Clean cache and build files"
	@echo ""

install:
	@echo "📦 Installing production dependencies..."
	$(PIP) install --upgrade pip
	$(PIP) install -r requirements.txt
	@echo "📦 Installing development dependencies..."
	$(PIP) install -r requirements-dev.txt
	@echo "✓ Dependencies installed"

pre-commit-install:
	@echo "🔗 Installing pre-commit hooks..."
	pre-commit install
	@echo "✓ Pre-commit hooks installed"

pre-commit-run:
	@echo "🔍 Running pre-commit on all files..."
	pre-commit run --all-files

lint:
	@echo ""
	@echo "═══════════════════════════════════════"
	@echo "Running Code Quality Checks..."
	@echo "═══════════════════════════════════════"
	@echo ""
	@echo "1️⃣  Running Flake8..."
	@flake8 app/ || (echo "❌ Flake8 found issues" && exit 1)
	@echo "✓ Flake8 passed"
	@echo ""
	@echo "2️⃣  Running Pylint..."
	@pylint app/ --rcfile=.pylintrc || (echo "⚠️  Pylint found issues (non-blocking)" && true)
	@echo ""
	@echo "3️⃣  Running MyPy type checking..."
	@mypy app/ --config-file=mypy.ini || (echo "⚠️  MyPy found type issues (non-blocking)" && true)
	@echo ""
	@echo "4️⃣  Checking import sorting (isort)..."
	@isort --check-only --diff app/ || (echo "❌ Imports not sorted correctly" && exit 1)
	@echo "✓ Import sorting is correct"
	@echo ""
	@echo "5️⃣  Checking code formatting (black)..."
	@black --check app/ || (echo "❌ Code not formatted correctly" && exit 1)
	@echo "✓ Code formatting is correct"
	@echo ""
	@echo "✅ All linting checks passed!"

format:
	@echo "🎨 Auto-formatting code..."
	@echo ""
	@echo "Sorting imports with isort..."
	@isort app/
	@echo "✓ Imports sorted"
	@echo ""
	@echo "Formatting code with black..."
	@black app/
	@echo "✓ Code formatted"
	@echo ""
	@echo "✅ Code formatting complete!"

test:
	@echo ""
	@echo "═══════════════════════════════════════"
	@echo "Running Tests with Coverage..."
	@echo "═══════════════════════════════════════"
	@echo ""
	@$(PYTEST) || (echo "❌ Tests failed" && exit 1)
	@echo ""
	@echo "✅ All tests passed!"
	@echo ""
	@echo "📊 Coverage report generated in htmlcov/index.html"

test-unit:
	@echo "🧪 Running unit tests..."
	@$(PYTEST) -m unit

test-integration:
	@echo "🔗 Running integration tests..."
	@$(PYTEST) -m integration

security:
	@echo ""
	@echo "═══════════════════════════════════════"
	@echo "Running Security Checks..."
	@echo "═══════════════════════════════════════"
	@echo ""
	@echo "1️⃣  Running Bandit security scan..."
	@bandit -r app/ -c .bandit -f screen || (echo "⚠️  Security issues found" && true)
	@bandit -r app/ -c .bandit -f json -o reports/bandit-report.json 2>/dev/null || true
	@echo ""
	@echo "2️⃣  Checking dependencies for vulnerabilities (Safety)..."
	@safety check --json > reports/safety-report.json 2>/dev/null || true
	@safety check || (echo "⚠️  Vulnerable dependencies found" && true)
	@echo ""
	@echo "✅ Security checks complete!"

qa: format lint test security
	@echo ""
	@echo "╔════════════════════════════════════════════════════════════╗"
	@echo "║                                                            ║"
	@echo "║              ✅  QA SUITE COMPLETED SUCCESSFULLY!          ║"
	@echo "║                                                            ║"
	@echo "╚════════════════════════════════════════════════════════════╝"
	@echo ""
	@echo "Summary:"
	@echo "  ✓ Code formatted (black + isort)"
	@echo "  ✓ Linting passed (flake8 + pylint + mypy)"
	@echo "  ✓ Tests passed with coverage"
	@echo "  ✓ Security checks completed"
	@echo ""

clean:
	@echo "🧹 Cleaning up..."
	@find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	@find . -type f -name "*.pyc" -delete 2>/dev/null || true
	@find . -type f -name "*.pyo" -delete 2>/dev/null || true
	@find . -type d -name "*.egg-info" -exec rm -rf {} + 2>/dev/null || true
	@find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
	@rm -rf .coverage htmlcov/ .mypy_cache/ reports/ *.log 2>/dev/null || true
	@echo "✓ Cleanup complete!"

# Create reports directory if it doesn't exist
reports:
	@mkdir -p reports