# Multi-stage Dockerfile for FastAPI Backend

# Stage 1: Base Python image with dependencies
FROM python:3.12-slim as base

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# ============================================
# Stage 2: Development image
# ============================================
FROM base as development

# Copy requirements files
COPY requirements.txt ./
# Copy requirements-dev.txt if it exists (use wildcard to make it optional)
COPY requirements-dev.tx[t] ./

# Install production dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Install dev dependencies if file exists
RUN if [ -f requirements-dev.txt ]; then \
        pip install --no-cache-dir -r requirements-dev.txt; \
    fi

# Copy application code
COPY . .

# Expose port
EXPOSE 8000

# Development command (with hot reload)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

# ============================================
# Stage 3: Production image (optimized)
# ============================================
FROM base as production

# Copy only production requirements
COPY requirements.txt ./

# Install only production dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app ./app

# Create non-root user for security
RUN useradd -m -u 1000 appuser && \
    chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8000/health')" || exit 1

# Production command (optimized with workers)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]