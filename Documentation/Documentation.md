# 📋 Complete Command Reference

## **Backend Commands** (in `backend/` folder)

### Setup & Installation
```bash
make install              # Install all dependencies (production + dev)
make pre-commit-install   # Install git pre-commit hooks
```

### Code Quality
```bash
make format              # Auto-format code (black + isort)
make lint                # Run all linters (flake8, pylint, mypy)
make pre-commit-run      # Run pre-commit hooks manually
```

### Testing
```bash
make test                # Run all tests with coverage
make test-unit           # Run only unit tests
make test-integration    # Run only integration tests
```

### Security
```bash
make security            # Run security scans (bandit + safety)
```

### Complete QA
```bash
make qa                  # Run EVERYTHING (format + lint + test + security)
```

### Maintenance
```bash
make clean               # Clean cache and build files
make help                # Show all available commands
```

---

## **Frontend Commands** (in `frontend/` folder)

### Setup & Installation
```bash
make install             # Install all node dependencies
```

### Development
```bash
make dev                 # Start development server (localhost:3000)
make build               # Build production bundle
```

### Code Quality
```bash
make format              # Auto-format code (prettier)
make lint                # Run ESLint + check formatting
```

### Testing
```bash
make test                # Run tests with coverage
```

### Complete QA
```bash
make qa                  # Run EVERYTHING (format + lint + test)
```

### Maintenance
```bash
make clean               # Clean build artifacts and node_modules
make help                # Show all available commands
```

---

## **Root Level Commands** (in project root folder)

### Setup
```bash
make install             # Install BOTH backend + frontend dependencies
make pre-commit-setup    # Setup pre-commit hooks for backend
```

### Code Quality
```bash
make format              # Format BOTH backend + frontend
make lint                # Lint BOTH backend + frontend
```

### Testing
```bash
make test                # Test BOTH backend + frontend
make test-backend        # Test backend only
make test-frontend       # Test frontend only
```

### Security
```bash
make security            # Run backend security checks
```

### Complete QA
```bash
make qa                  # Run COMPLETE QA for ENTIRE project
                         # (format + lint + test + security for both)
```

### Build
```bash
make build               # Build frontend for production
```

### Maintenance
```bash
make clean               # Clean BOTH backend + frontend
make clean-all           # Deep clean (remove dependencies too)
make help                # Show all available commands
```

---

##  **IMP**

1. **Always run `make qa` from root before committing** - catches all issues in both backend and frontend

2. **Use `make format` first, then `make lint`** - formatting fixes many lint issues automatically

3. **Run `make test` frequently** - don't let bugs accumulate

4. **Backend: activate venv first** - `source venv/bin/activate` before running commands

5. **Check coverage reports:**
   - Backend: `backend/htmlcov/index.html`
   - Frontend: `frontend/coverage/lcov-report/index.html`

---

## Frontend Workflow Now:
```
Your React Code (src/)
    ↓
[Prettier] → Auto-formats code
    ↓
[ESLint] → Checks for errors & best practices
    ↓
[Jest + RTL] → Runs tests with coverage (50% minimum)
    ↓
Frontend is clean, tested, and ready!

```
## Backend Workflow Now:
```
Your Code (app/)
    ↓
[Black] → Formats code automatically (line length, spacing)
    ↓
[isort] → Organizes imports alphabetically
    ↓
[Flake8] → Checks style rules (PEP 8)
    ↓
[Pylint] → Deep code analysis (quality, bugs)
    ↓
[MyPy] → Type checking
    ↓
[Pytest] → Runs tests + coverage
    ↓
[Bandit] → Security scanning
    ↓
[Safety] → Checks for vulnerable dependencies
    ↓
Code is clean, tested, and secure!
```