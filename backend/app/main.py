import asyncio
import json
import os
import websockets
import httpx
import numpy as np
import openmeteo_requests
import requests_cache
import feedparser
from retry_requests import retry
from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from dotenv import load_dotenv

load_dotenv()

# --- CONFIGURATION ---
AISSTREAM_API_KEY = os.getenv("AISSTREAM_API_KEY")
AQICN_TOKEN = os.getenv("AQICN_TOKEN")
AQICN_BASE_URL = "https://api.waqi.info/map/bounds"

SUBSCRIPTION_BOX = [[30.0, -10.0], [70.0, 40.0]] 

# --- DATA STORAGE ---
vessels = {} 

# --- OPEN-METEO ---
cache_session = requests_cache.CachedSession('.cache', expire_after=3600)
retry_session = retry(cache_session, retries=5, backoff_factor=0.2)
openmeteo = openmeteo_requests.Client(session=retry_session)

# --- HELPER FUNCTIONS ---
def get_aqi_color(aqi: int) -> str:
    if aqi <= 50: return "#2ecc71"
    if aqi <= 100: return "#f1c40f"
    if aqi <= 150: return "#e67e22"
    if aqi <= 200: return "#e74c3c"
    if aqi <= 300: return "#8e44ad"
    return "#7d0505"

def get_wave_intensity(height: float) -> str:
    if height < 0.5: return "Calm"
    if height < 1.25: return "Smooth"
    if height < 2.5: return "Slight"
    if height < 4.0: return "Moderate"
    if height < 6.0: return "Rough"
    if height < 9.0: return "Very Rough"
    return "High"

def get_cyclone_severity_color(level: str) -> str:
    level = level.lower()
    if "red" in level: return "#e74c3c"    # High (Red)
    if "orange" in level: return "#e67e22" # Medium (Orange)
    if "green" in level: return "#2ecc71"  # Low (Green)
    return "#95a5a6"                       # Unknown (Grey)

def generate_grid(min_lat, min_lon, max_lat, max_lon, step=2.5):
    lats = np.arange(min_lat, max_lat, step)
    lons = np.arange(min_lon, max_lon, step)
    if len(lats) == 0: lats = np.array([min_lat])
    if len(lons) == 0: lons = np.array([min_lon])
    lat_grid, lon_grid = np.meshgrid(lats, lons)
    return lat_grid.flatten(), lon_grid.flatten()

# --- BACKGROUND TASKS ---
async def connect_ais_stream():
    uri = "wss://stream.aisstream.io/v0/stream"
    while True:
        try:
            async with websockets.connect(uri) as websocket:
                print("⚓ Connected to AISStream WebSocket")
                subscribe_message = {
                    "APIKey": AISSTREAM_API_KEY,
                    "BoundingBoxes": [SUBSCRIPTION_BOX],
                    "FilterMessageTypes": ["PositionReport"] 
                }
                await websocket.send(json.dumps(subscribe_message))
                async for message_json in websocket:
                    message = json.loads(message_json)
                    if message.get("MessageType") == "PositionReport":
                        data = message["Message"]["PositionReport"]
                        mmsi = data["UserID"]
                        vessels[mmsi] = {
                            "type": "Feature",
                            "properties": {
                                "mmsi": mmsi,
                                "speed": data.get("Sog", 0),
                                "course": data.get("Cog", 0),
                                "lat": data["Latitude"],
                                "lon": data["Longitude"],
                                "last_updated": datetime.now(timezone.utc).isoformat()
                            },
                            "geometry": { "type": "Point", "coordinates": [data["Longitude"], data["Latitude"]] }
                        }
        except Exception as e:
            print(f"Connection lost: {e}")
            await asyncio.sleep(5)

@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(connect_ais_stream())
    yield
    task.cancel()

app = FastAPI(title="Maritime Real-Time Data API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def health():
    return {"status": "ok", "system": "active"}

@app.get("/api/vessels")
async def get_vessels(
    min_lat: float = Query(...), min_lon: float = Query(...),
    max_lat: float = Query(...), max_lon: float = Query(...)
):
    vessels_snapshot = list(vessels.values())
    filtered = [
        v for v in vessels_snapshot
        if min_lat <= v["properties"]["lat"] <= max_lat 
        and min_lon <= v["properties"]["lon"] <= max_lon
    ]
    return {"type": "FeatureCollection", "features": filtered}

@app.get("/api/aqi")
async def get_aqi_data(
    min_lat: float = Query(...), min_lon: float = Query(...),
    max_lat: float = Query(...), max_lon: float = Query(...)
):
    if not AQICN_TOKEN: raise HTTPException(status_code=500, detail="AQICN_TOKEN missing")
    latlng = f"{min_lat},{min_lon},{max_lat},{max_lon}"
    try:
        async with httpx.AsyncClient() as client:
            res = await client.get(AQICN_BASE_URL, params={"latlng": latlng, "token": AQICN_TOKEN})
            data = res.json()
        if data.get("status") != "ok": return {"type": "FeatureCollection", "features": []}
        features = []
        for station in data.get("data", []):
            try:
                aqi = int(station.get("aqi"))
                features.append({
                    "type": "Feature",
                    "properties": {
                        "aqi": aqi,
                        "name": station.get("station", {}).get("name", "Unknown"),
                        "color": get_aqi_color(aqi),
                        "last_updated": station.get("station", {}).get("time", "")
                    },
                    "geometry": { "type": "Point", "coordinates": [station["lon"], station["lat"]] }
                })
            except (ValueError, TypeError): continue
        return {"type": "FeatureCollection", "features": features}
    except Exception:
        return {"type": "FeatureCollection", "features": []}

@app.get("/api/waves")
async def get_waves(
    min_lat: float = Query(...), min_lon: float = Query(...),
    max_lat: float = Query(...), max_lon: float = Query(...)
):
    lats, lons = generate_grid(min_lat, min_lon, max_lat, max_lon)
    url = "https://marine-api.open-meteo.com/v1/marine"
    params = {
        "latitude": lats, "longitude": lons,
        "current": ["wave_height", "wave_direction", "wave_period", "swell_wave_height"],
        "timezone": "auto"
    }
    try:
        responses = openmeteo.weather_api(url, params=params)
        features = []
        for i, response in enumerate(responses):
            current = response.Current()
            wave_height = current.Variables(0).Value()
            if wave_height is None: continue
            features.append({
                "type": "Feature",
                "geometry": { "type": "Point", "coordinates": [lons[i], lats[i]] },
                "properties": {
                    "wave_height": round(wave_height, 2),
                    "wave_direction": round(current.Variables(1).Value(), 0),
                    "wave_period": round(current.Variables(2).Value(), 1),
                    "swell_wave_height": round(current.Variables(3).Value(), 2),
                    "condition": get_wave_intensity(wave_height)
                }
            })
        return {"type": "FeatureCollection", "features": features}
    except Exception:
        return {"type": "FeatureCollection", "features": []}

@app.get("/api/cyclones")
async def get_cyclones(
    min_lat: float = Query(..., description="South-West Latitude"),
    min_lon: float = Query(..., description="South-West Longitude"),
    max_lat: float = Query(..., description="North-East Latitude"),
    max_lon: float = Query(..., description="North-East Longitude")
):
    rss_url = "https://www.gdacs.org/xml/rss.xml" 
    features = []
    
    try:
        # 1. Fetch Global Data
        feed = await asyncio.to_thread(feedparser.parse, rss_url)
        
        # Debugging: Print total events found (Earthquakes, Floods, etc.)
        print(f"DEBUG: GDACS Main Feed found {len(feed.entries)} total events.")

        for entry in feed.entries:
            try:
                # 2. FILTER: Only look for Tropical Cyclones (TC)
                # GDACS uses 'gdacs_eventtype' tag: 'TC' = Tropical Cyclone, 'EQ' = Earthquake
                event_type = entry.get('gdacs_eventtype', '')
                if event_type != 'TC':
                    continue # Skip earthquakes, floods, etc.

                # 3. Extract Location
                if hasattr(entry, 'geo_lat'):
                    lat = float(entry.geo_lat)
                    lon = float(entry.geo_long)
                elif hasattr(entry, 'georss_point'):
                     lat, lon = map(float, entry.georss_point.split(" "))
                else:
                    continue

                # 4. FILTER: Bounding Box Check
                if min_lat <= lat <= max_lat and min_lon <= lon <= max_lon:
                    
                    severity = entry.get('gdacs_alertlevel', 'Green')
                    country = entry.get('gdacs_country', 'International Waters')

                    features.append({
                        "type": "Feature",
                        "geometry": {
                            "type": "Point",
                            "coordinates": [lon, lat]
                        },
                        "properties": {
                            "name": entry.title,
                            "severity": severity,
                            "color": get_cyclone_severity_color(severity),
                            "country": country,
                            "description": entry.description,
                            "link": entry.link,
                            "source": "GDACS"
                        }
                    })
            except Exception as e:
                print(f"Skipping entry: {e}")
                continue

    except Exception as e:
        print(f"GDACS Error: {e}")
        return {"type": "FeatureCollection", "features": []}

    print(f"DEBUG: Found {len(features)} cyclones in viewport.")
    
    return {
        "type": "FeatureCollection",
        "features": features
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)