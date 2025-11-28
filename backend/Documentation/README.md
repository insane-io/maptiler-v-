# Backend Documentation — Vessel Finder Service

This document describes the backend service for the Vessel Finder component of the project. It explains how to set up, run, and debug the FastAPI service, the API endpoints provided, the WebSocket/AIS integration, runtime behavior and troubleshooting guidance.

**Contents**
- Overview
- Project structure (backend)
- Prerequisites
- Setup & run (development)
- API reference (endpoints, params, examples)
- WebSocket / AIS stream details
- Data model (vessel Feature schema)
- Troubleshooting & debugging
- Deployment & security notes
- Next steps

---

## Overview

The backend is a FastAPI application that:
- Maintains an in-memory store of vessel positions (updated from an AIS stream WebSocket).
- Exposes HTTP endpoints for clients (frontend) to request GeoJSON FeatureCollections of vessels for a bounding box.
- Optionally provides AQI data endpoints and simple health/debug endpoints.

The service is designed for local development and as a lightweight middle-tier between AIS data providers and the frontend map UI.

## Project structure (backend)

Key files and folders (relative to `backend/`):
- `app/main.py` — FastAPI app, route handlers (`/api/vessels`, `/api/aqi`), WebSocket AIS consumer, in-memory `vessels` store.
- `requirements.txt` — Python dependencies.
- `Documentation/Vessel_Finder_Documnetation.md` — (this file) documentation and usage.
- other modules — helpers or additional services if present.

## Prerequisites

- Python 3.10+ (3.12 used in previous runs). Ensure `python3` points to a compatible interpreter.
- Network connectivity to the AIS stream provider (e.g., `aisstream.io`) if running live.

## Setup & run (development)

Create and activate a virtual environment, install dependencies, then start the app with Uvicorn:

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

- The service will be available at `http://127.0.0.1:8000`.
- Interactive API docs (Swagger UI) are at `http://127.0.0.1:8000/docs`.
- OpenAPI JSON is at `http://127.0.0.1:8000/openapi.json`.

If you want to run the server in the background or in production use an ASGI server and process manager (see Deployment section).

## Environment variables & configuration

The code may reference the following configuration values (check `app/main.py` for exact variable names):
- `AIS_STREAM_URL` — the WebSocket URL for AIS stream provider.
- `AIS_API_KEY` / `API_KEY` — API key/token if required by the provider.
- `BBOX_POLL_INTERVAL` / `CACHE_TTL` — (optional) numeric intervals for caching or polling behavior.

Set these in your shell or a `.env` file (if you add dotenv support). Avoid committing secrets to source control.

## API Reference

Base URL: `http://localhost:8000`

### GET /api/vessels

Description: Return vessel positions as a GeoJSON FeatureCollection within a bounding box.

Query parameters:
- `min_lat` (required) — minimum latitude
- `min_lon` (required) — minimum longitude
- `max_lat` (required) — maximum latitude
- `max_lon` (required) — maximum longitude

Response: `200 OK` with body like:

```json
{
  "type": "FeatureCollection",
  "features": [ /* array of GeoJSON Point features */ ]
}
```

Example curl (from screenshot):

```bash
curl -X GET "http://localhost:8000/api/vessels?min_lat=18.0&min_lon=72.0&max_lat=20.0&max_lon=74.0" -H "accept: application/json"
```

If the response is `{"type":"FeatureCollection","features":[]}`, the service currently has no vessels inside the requested bbox (or the AIS stream hasn't provided any data yet).

### GET /api/aqi

If present, this endpoint returns AQI/air-quality related data (check `app/main.py` for exact parameterization). Example usage: `GET /api/aqi?lat=...&lon=...`

### Swagger UI

Use `http://localhost:8000/docs` to try the endpoints interactively.

## WebSocket / AIS stream integration

How it works:
- On startup, the FastAPI application creates an asynchronous background task that opens a WebSocket to the AIS stream provider (e.g., `aisstream.io`) and listens for incoming messages.
- Each incoming AIS message is parsed and used to update the in-memory `vessels` dictionary keyed by MMSI (or a suitable unique identifier).
- The `vessels` dict values are typically small objects containing position, course, speed, and last update timestamp.

Important implementation notes (see `app/main.py`):
- The WebSocket consumer must be resilient: reconnect on failure, backoff between retries, and log connection state.
- Incoming message format differ between providers; the code should parse JSON and defensively handle missing fields.
- Example message handling (pseudocode):

```py
async def on_message(msg):
    data = json.loads(msg)
    mmsi = data.get("mmsi")
    if not mmsi: return
    vessels[mmsi] = {
        "lat": data.get("lat"),
        "lon": data.get("lon"),
        "speed": data.get("speed"),
        "course": data.get("course"),
        "last_updated": data.get("timestamp") or datetime.utcnow().isoformat()
    }
```

TTL / cleanup:
- For long-running services, periodically remove stale vessels (e.g., last_updated older than N minutes) to keep memory bounded.

Concurrency:
- The `vessels` store is a plain dict. If you access it from multiple async tasks, ensure operations are atomic or protected (e.g., use `asyncio.Lock` if you have race conditions).

## Data model — Vessel Feature schema

Each vessel is serialized to a GeoJSON Point Feature when returned via `/api/vessels`. Example Feature shape:

```json
{
  "type": "Feature",
  "properties": {
    "mmsi": 244012012,
    "speed": 6.3,
    "course": 157.7,
    "last_updated": "2025-11-27T17:07:51.656962+00:00"
  },
  "geometry": {
    "type": "Point",
    "coordinates": [lon, lat]
  }
}
```

The exact properties may include additional fields (vessel name, type, destination) depending on the AIS provider.

## Troubleshooting & debugging

1. Endpoint returns empty features array
   - Confirm backend is running: check the terminal where `uvicorn` is started.
   - Open Swagger UI `http://localhost:8000/docs` and call `/api/vessels` with a very large bbox to see if any vessel exists:

```bash
curl "http://localhost:8000/api/vessels?min_lat=-90&min_lon=-180&max_lat=90&max_lon=180"
```

   - If still empty: the `vessels` store may be empty because the AIS websocket did not connect or no messages have been received.

2. Check uvicorn logs
   - Look for WebSocket connection logs and any stack traces. The server should log when it connects to the AIS provider and when messages are processed.

3. WebSocket connectivity
   - Verify the AIS stream URL and API key (if required). If the provider rejects the connection, logs usually show HTTP 401/403 or connection refused errors.

4. Frontend shows nothing but backend returns features
   - Open browser DevTools → Network and inspect the `/api/vessels` response returned to the frontend.
   - Verify map layers are enabled and sources are created in the frontend code (`src/components/Map.tsx`, `VesselLayer.tsx`).

5. Add temporary debug endpoint
   - If you want a quick check of the in-memory state, add a debug route in `app/main.py`:

```py
@app.get("/api/vessels/debug")
def vessels_debug():
    return {"count": len(vessels), "sample": list(vessels.values())[:10]}
```

Be cautious with returning full state in production.

## Logs & monitoring

- Watch the `uvicorn` console for startup messages and background task logs.
- Add structured logging (JSON or key=value) if you plan to ship metrics to a log aggregator.

## Deployment & production notes

- Use a production-grade ASGI server (e.g., `uvicorn` with multiple workers behind a reverse proxy like `nginx`) or `gunicorn` with `uvicorn.workers.UvicornWorker`.
- Run the app as a service (systemd) or containerize it (Docker) for reproducible deployment.
- Secure any API keys via environment variables or a secrets manager.
- Use HTTPS for public endpoints and configure CORS rules narrowly to only allow the frontend host.

Example systemd service snippet:

```
[Unit]
Description=Vessel Finder API

[Service]
User=www-data
WorkingDirectory=/path/to/backend
Environment="PATH=/path/to/backend/venv/bin"
ExecStart=/path/to/backend/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 3

[Install]
WantedBy=multi-user.target
```

## Security & cost considerations

- Do not stream or poll the AIS provider indefinitely if costs or rate limits apply — implement on-demand fetching and caching.
- Sanitize and validate incoming data from external providers.
- Limit debug endpoints to development/testing only.

## Example checks & quick commands

Check server running and API docs:

```bash
curl -I http://localhost:8000/docs
```

Query vessels for a bbox:

```bash
curl "http://localhost:8000/api/vessels?min_lat=18.0&min_lon=72.0&max_lat=20.0&max_lon=74.0"
```

Add debug endpoint and test it (if you added `/api/vessels/debug`):

```bash
curl http://localhost:8000/api/vessels/debug
```

## Next steps / improvements

- Persist recent AIS data in Redis (for quick multi-process access and TTL-based expiry).
- Add unit tests for parsing AIS messages.
- Add metrics (Prometheus) for connection status, message throughput, and feature counts.
- Harden reconnection/backoff logic for the AIS WebSocket.

---

If you want, I can:
- Add the optional `/api/vessels/debug` endpoint now.
- Add sample unit tests and a small pytest harness.
- Create a short `backend/README.md` with trimmed run steps for developers.

Tell me which follow-up action you'd like me to do next.
