# Backend API Documentation

FastAPI-based backend for maritime, environmental, and weather data.

## Documentation Files
- **[AQI_Values.md](./AQI_Values.md)** - Air Quality API
- **[Vessel_Finder_Documnetation.md](./Vessel_Finder_Documnetation.md)** - Vessel Tracking
- **[Waves_API.md](./Waves_API.md)** - Ocean Waves
- **[Documentation.md](./Documentation.md)** - Dev notes

## Tech Stack
- FastAPI 0.122.0
- WebSockets (AIS streaming)
- httpx (async HTTP)
- numpy (data processing)
- In-memory LRU cache

## Environment Setup
```bash
cd backend
python3 -m venv env
source env/bin/activate
pip install -r requirements.txt
```

Create `.env`:
```env
AISSTREAM_API_KEY=your_key
AQICN_TOKEN=your_token
```

Get keys:
- AISStream: https://aisstream.io
- WAQI: https://aqicn.org/data-platform/token

## Run Server
```bash
python app/main.py
# or
uvicorn app.main:app --reload --port 8000
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Health check + stats |
| `/api/vessels?bbox` | GET | Vessel positions |
| `/api/aqi?bbox` | GET | AQI stations |
| `/api/waves?bbox` | GET | Wave grid data |
| `/api/wave-point?lat&lon` | GET | Single point wave |

**bbox params:** `min_lat`, `min_lon`, `max_lat`, `max_lon`

## Response Format
All endpoints return GeoJSON:
```json
{
  "type": "FeatureCollection",
  "features": [...]
}
```

## Caching
- **TTL:** 10 minutes
- **Max Size:** 100 entries (LRU)
- **Key:** MD5 hash of `type_bbox`

## Data Sources & Costs

| Service | Provider | Cost | Limit |
|---------|----------|------|-------|
| Vessels | AISStream | FREE | Regional |
| AQI | WAQI | FREE | 1000/day |
| Waves | Open-Meteo | FREE | Unlimited |

## Paid Upgrades (Production)

| Service | Alternative | Cost/mo |
|---------|-------------|---------|
| Vessels | MarineTraffic | $99-999 |
| AQI | IQAir | $199-999 |
| Waves | Copernicus | €150-500 |

## Production TODO
- Add JWT authentication
- Implement rate limiting
- Replace in-memory cache with Redis
- Add PostgreSQL for vessel history
- Enable HTTPS only
