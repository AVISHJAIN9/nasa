import pytest
from httpx import AsyncClient, ASGITransport
from backend.app.main import app

@pytest.mark.asyncio
async def test_health_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/health")
        assert response.status_code in [200, 503]
        data = response.json()
        assert "status" in data
        assert "components" in data

@pytest.mark.asyncio
async def test_gateway_info():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/api/v1/gateway/info")
        assert response.status_code == 200
        data = response.json()
        assert "AstroCare" in data.get("project_name", "")
        assert data.get("api_version") == "v1"

@pytest.mark.asyncio
async def test_flags_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/api/v1/flags")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

@pytest.mark.asyncio
async def test_sensors_state():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/api/v1/sensors/state?crew_id=vega")
        assert response.status_code == 200
        data = response.json()
        assert data.get("crew_id") == "vega"
        assert "sensors" in data
        assert "camera" in data["sensors"]
