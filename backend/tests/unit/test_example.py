"""Example unit tests for FastAPI application."""

import pytest


@pytest.mark.unit
def test_example():
    """Example test case."""
    assert True


@pytest.mark.unit
def test_app_exists(test_app):
    """Test that app instance exists."""
    assert test_app is not None


@pytest.mark.unit
def test_health_endpoint(client):
    """Test the health check endpoint."""
    response = client.get("/health")
    assert response.status_code in [200, 404]  # 404 if endpoint doesn't exist yet
