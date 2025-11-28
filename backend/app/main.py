import asyncio
import json
import os
import websockets
import httpx
import numpy as np
import openmeteo_requests
import requests_cache
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

# Static Bounding Box for AISStream Subscription (Background Data Collection)
# We subscribe to a large area, but filter the view in the API
SUBSCRIPTION_BOX = [[30.0, -10.0], [70.0, 40.0]] 

# --- OPEN-METEO SETUP ---
# Setup the client with caching to prevent rate limiting
cache_session = requests_cache.CachedSession('.cache', expire_after=3600)
retry_session = retry(cache_session, retries=5, backoff_factor=0.2)
openmeteo = openmeteo_requests.Client(session=retry_session)

# In-memory storage
vessels = {}

# --- HELPER FUNCTIONS ---
def get_aqi_color(aqi: int) -> str:
    if aqi <= 50: return "#2ecc71"   # Good
    if aqi <= 100: return "#f1c40f"  # Moderate
    if aqi <= 150: return "#e67e22"  # Sensitive Groups
    if aqi <= 200: return "#e74c3c"  # Unhealthy
    if aqi <= 300: return "#8e44ad"  # Very Unhealthy
    return "#7d0505"                 # Hazardous

def generate_grid(min_lat, min_lon, max_lat, max_lon, step=2.5):
    """
    Generates a grid of Lat/Lon points within the viewport.
    step=2.5 degrees is approx 250km (Good balance for performance).
    """
    lats = np.arange(min_lat, max_lat, step)
    lons = np.arange(min_lon, max_lon, step)
    
    # Handle edge case where viewport is smaller than step
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
                            "geometry": {
                                "type": "Point",
                                "coordinates": [data["Longitude"], data["Latitude"]]
                            }
                        }
                        
        except Exception as e:
            print(f"Connection lost: {e}")
            await asyncio.sleep(5)

@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(connect_ais_stream())
    yield
    task.cancel()

app = FastAPI(title="MapTiler Vessel & Environmental API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- API ENDPOINTS ---

@app.get("/")
async def health():
    return {"status": "ok", "vessels_tracked": len(vessels)}

@app.get("/api/vessels")
async def get_vessels(
    min_lat: float = Query(...), min_lon: float = Query(...),
    max_lat: float = Query(...), max_lon: float = Query(...)
):
    # Filter in-memory vessels based on the viewport requested by frontend
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
    if not AQICN_TOKEN:
        raise HTTPException(status_code=500, detail="AQICN_TOKEN missing")

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
                    "geometry": {
                        "type": "Point",
                        "coordinates": [station["lon"], station["lat"]]
                    }
                })
            except (ValueError, TypeError): continue

        return {"type": "FeatureCollection", "features": features}

    except Exception as e:
        print(f"AQI Error: {e}")
        return {"type": "FeatureCollection", "features": []}

def get_wave_intensity(height: float) -> str:
    """
    Classifies sea state based on wave height (Douglas Sea Scale).
    """
    if height < 0.5: return "Calm"          # Glassy to rippled
    if height < 1.25: return "Smooth"       # Wavelets
    if height < 2.5: return "Slight"        # Small waves
    if height < 4.0: return "Moderate"      # Many whitecaps
    if height < 6.0: return "Rough"         # Large waves
    if height < 9.0: return "Very Rough"    # Heaping seas
    return "High"                           # Dangerous

@app.get("/api/waves")
async def get_waves(
    min_lat: float = Query(...), min_lon: float = Query(...),
    max_lat: float = Query(...), max_lon: float = Query(...)
):
    """
    Fetches Wave Height, Direction, Period, and Swell data.
    """
    # 1. Generate grid points
    lats, lons = generate_grid(min_lat, min_lon, max_lat, max_lon)
    
    url = "https://marine-api.open-meteo.com/v1/marine"
    
    # 2. Update params to include period and swell
    # IMPORTANT: The order in this list determines the index in the response (0, 1, 2, 3)
    params = {
        "latitude": lats,
        "longitude": lons,
        "current": ["wave_height", "wave_direction", "wave_period", "swell_wave_height"],
        "timezone": "auto"
    }
    
    try:
        responses = openmeteo.weather_api(url, params=params)
        features = []
        
        for i, response in enumerate(responses):
            current = response.Current()
            
            # 3. Extract variables by index (matching the params list order)
            wave_height = current.Variables(0).Value()
            wave_dir = current.Variables(1).Value()
            wave_period = current.Variables(2).Value()
            swell_height = current.Variables(3).Value()
            
            if wave_height is None: continue

            features.append({
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [lons[i], lats[i]]
                },
                "properties": {
                    "wave_height": round(wave_height, 2),
                    "wave_direction": round(wave_dir, 0),
                    "wave_period": round(wave_period, 1),      # New Field
                    "swell_wave_height": round(swell_height, 2), # New Field
                    "condition": get_wave_intensity(wave_height) # New Helper
                }
            })

        return {"type": "FeatureCollection", "features": features}

    except Exception as e:
        print(f"Wave API Error: {e}")
        return {"type": "FeatureCollection", "features": []}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)