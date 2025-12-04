"""Pytest configuration and shared fixtures."""

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    """Create test client for FastAPI."""
    return TestClient(app)


@pytest.fixture
def test_app():
    """Return the FastAPI app instance for testing."""
    return app
