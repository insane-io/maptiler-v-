import asyncio
import json
import os
import websockets
import httpx
import numpy as np
import openmeteo_requests
import requests_cache
from retry_requests import retry
from datetime import datetime, timezone, timedelta
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from typing import Dict, Tuple
import hashlib

load_dotenv()

# --- CONFIGURATION ---
AISSTREAM_API_KEY = os.getenv("AISSTREAM_API_KEY")
AQICN_TOKEN = os.getenv("AQICN_TOKEN")
AQICN_BASE_URL = "https://api.waqi.info/map/bounds"

# Multiple bounding boxes for global coverage
# Split into manageable regions to avoid overwhelming AISStream
SUBSCRIPTION_BOXES = [
    [[-60.0, -180.0], [72.0, -30.0]],  # Americas
    [[35.0, -15.0], [72.0, 45.0]],     # Europe
    [[20.0, 100.0], [50.0, 150.0]],    # East Asia
    [[-40.0, 30.0], [30.0, 120.0]],    # Indian Ocean
]

# --- Global Data Storage ---
vessels = {}  # Store vessel data by MMSI

# --- Enhanced Caching ---
# Increased cache TTL and better management
api_cache: Dict[str, Tuple[dict, datetime]] = {}
CACHE_TTL = timedelta(minutes=10)  # Increased from 5 to 10 minutes
MAX_CACHE_SIZE = 100  # Limit cache size

# --- OPEN-METEO SETUP ---
cache_session = requests_cache.CachedSession('.cache', expire_after=7200)  # 2 hours
retry_session = retry(cache_session, retries=3, backoff_factor=0.3)
openmeteo = openmeteo_requests.Client(session=retry_session)

# --- HELPER FUNCTIONS ---
def get_aqi_color(aqi: int) -> str:
    if aqi <= 50: return "#2ecc71"
    if aqi <= 100: return "#f1c40f"
    if aqi <= 150: return "#e67e22"
    if aqi <= 200: return "#e74c3c"
    if aqi <= 300: return "#8e44ad"
    return "#7d0505"

def generate_grid(min_lat, min_lon, max_lat, max_lon, step=3.0):
    """
    Generates a grid with LARGER step size for better performance.
    step=3.0 degrees is approx 300km (Reduced data points for faster loading)
    """
    lats = np.arange(min_lat, max_lat, step)
    lons = np.arange(min_lon, max_lon, step)
    
    if len(lats) == 0: lats = np.array([min_lat])
    if len(lons) == 0: lons = np.array([min_lon])
    
    lat_grid, lon_grid = np.meshgrid(lats, lons)
    return lat_grid.flatten(), lon_grid.flatten()

def get_cache_key(prefix: str, min_lat: float, min_lon: float, max_lat: float, max_lon: float) -> str:
    """Generate cache key with rounding to increase cache hits"""
    # Round to 1 decimal place to increase cache hit rate
    bbox_str = f"{prefix}_{min_lat:.1f}_{min_lon:.1f}_{max_lat:.1f}_{max_lon:.1f}"
    return hashlib.md5(bbox_str.encode()).hexdigest()

def get_cached_data(cache_key: str) -> dict | None:
    """Get cached data if not expired"""
    if cache_key in api_cache:
        data, timestamp = api_cache[cache_key]
        if datetime.now(timezone.utc) - timestamp < CACHE_TTL:
            return data
        else:
            del api_cache[cache_key]
    return None

def set_cached_data(cache_key: str, data: dict):
    """Store data with cache size management"""
    # Simple LRU: remove oldest if cache too large
    if len(api_cache) >= MAX_CACHE_SIZE:
        oldest_key = min(api_cache.keys(), key=lambda k: api_cache[k][1])
        del api_cache[oldest_key]
    
    api_cache[cache_key] = (data, datetime.now(timezone.utc))

# --- BACKGROUND TASKS ---
async def connect_ais_stream():
    """
    Connects to AISStream and continuously updates vessel data.
    Uses multiple bounding boxes for global coverage.
    """
    uri = "wss://stream.aisstream.io/v0/stream"
    
    while True:
        try:
            async with websockets.connect(uri) as websocket:
                print("⚓ Connected to AISStream WebSocket")
                
                subscribe_message = {
                    "APIKey": AISSTREAM_API_KEY,
                    "BoundingBoxes": SUBSCRIPTION_BOXES,
                    "FilterMessageTypes": ["PositionReport"] 
                }
                await websocket.send(json.dumps(subscribe_message))
                print(f"📡 Subscribed to {len(SUBSCRIPTION_BOXES)} regions")

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
            print(f"❌ AISStream connection lost: {e}")
            await asyncio.sleep(5)

@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(connect_ais_stream())
    yield
    task.cancel()

app = FastAPI(title="MapTiler Vessel & Environmental API (Optimized)", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- API ENDPOINTS ---

@app.get("/")
async def health():
    return {
        "status": "ok", 
        "vessels_tracked": len(vessels),
        "cache_size": len(api_cache),
        "regions_monitored": len(SUBSCRIPTION_BOXES)
    }

@app.get("/api/vessels")
async def get_vessels(
    min_lat: float = Query(...), 
    min_lon: float = Query(...),
    max_lat: float = Query(...), 
    max_lon: float = Query(...)
):
    """Filter vessels within viewport - instant response from memory"""
    vessels_snapshot = list(vessels.values())
    filtered = [
        v for v in vessels_snapshot
        if min_lat <= v["properties"]["lat"] <= max_lat 
        and min_lon <= v["properties"]["lon"] <= max_lon
    ]
    print(f"🚢 Vessels filtered: {len(filtered)}/{len(vessels_snapshot)}")
    return {"type": "FeatureCollection", "features": filtered}

@app.get("/api/aqi")
async def get_aqi_data(
    min_lat: float = Query(...), 
    min_lon: float = Query(...),
    max_lat: float = Query(...), 
    max_lon: float = Query(...)
):
    """Fetch AQI data with aggressive caching"""
    if not AQICN_TOKEN:
        raise HTTPException(status_code=500, detail="AQICN_TOKEN missing")

    # Check cache first
    cache_key = get_cache_key("aqi", min_lat, min_lon, max_lat, max_lon)
    cached = get_cached_data(cache_key)
    if cached:
        print(f"✅ AQI cache HIT (bbox: {min_lat:.1f},{min_lon:.1f} to {max_lat:.1f},{max_lon:.1f})")
        return cached

    latlng = f"{min_lat},{min_lon},{max_lat},{max_lon}"
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:  # Reduced timeout
            res = await client.get(
                AQICN_BASE_URL, 
                params={"latlng": latlng, "token": AQICN_TOKEN}
            )
            data = res.json()

        if data.get("status") != "ok": 
            result = {"type": "FeatureCollection", "features": []}
            set_cached_data(cache_key, result)
            return result

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
            except (ValueError, TypeError): 
                continue

        result = {"type": "FeatureCollection", "features": features}
        set_cached_data(cache_key, result)
        print(f"💨 AQI cached: {len(features)} stations (bbox: {min_lat:.1f},{min_lon:.1f})")
        return result

    except httpx.TimeoutException:
        print(f"⏱️ AQI request timeout")
        return {"type": "FeatureCollection", "features": []}
    except Exception as e:
        print(f"❌ AQI Error: {e}")
        return {"type": "FeatureCollection", "features": []}

def get_wave_intensity(height: float) -> str:
    """Classify sea state based on wave height"""
    if height < 0.5: return "Calm"
    if height < 1.25: return "Smooth"
    if height < 2.5: return "Slight"
    if height < 4.0: return "Moderate"
    if height < 6.0: return "Rough"
    if height < 9.0: return "Very Rough"
    return "High"

@app.get("/api/waves")
async def get_waves(
    min_lat: float = Query(...), 
    min_lon: float = Query(...),
    max_lat: float = Query(...), 
    max_lon: float = Query(...)
):
    """Fetch wave data with larger grid spacing for performance"""
    # Check cache
    cache_key = get_cache_key("waves", min_lat, min_lon, max_lat, max_lon)
    cached = get_cached_data(cache_key)
    if cached:
        print(f"✅ Waves cache HIT (bbox: {min_lat:.1f},{min_lon:.1f} to {max_lat:.1f},{max_lon:.1f})")
        return cached
    
    # Generate grid with LARGER step for fewer API calls
    lats, lons = generate_grid(min_lat, min_lon, max_lat, max_lon, step=3.0)
    
    # Limit maximum grid points to prevent slowness
    max_points = 50
    if len(lats) > max_points:
        # Sample evenly to stay under limit
        indices = np.linspace(0, len(lats)-1, max_points, dtype=int)
        lats = lats[indices]
        lons = lons[indices]
        print(f"⚠️ Waves: Sampled to {max_points} points for performance")
    
    url = "https://marine-api.open-meteo.com/v1/marine"
    
    params = {
        "latitude": lats.tolist(),
        "longitude": lons.tolist(),
        "current": ["wave_height", "wave_direction", "wave_period", "swell_wave_height"],
        "timezone": "auto"
    }
    
    try:
        responses = openmeteo.weather_api(url, params=params)
        features = []
        
        for i, response in enumerate(responses):
            current = response.Current()
            
            wave_height = current.Variables(0).Value()
            wave_dir = current.Variables(1).Value()
            wave_period = current.Variables(2).Value()
            swell_height = current.Variables(3).Value()
            
            if wave_height is None: 
                continue

            features.append({
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [float(lons[i]), float(lats[i])]
                },
                "properties": {
                    "wave_height": round(wave_height, 2),
                    "wave_direction": round(wave_dir, 0),
                    "wave_period": round(wave_period, 1),
                    "swell_wave_height": round(swell_height, 2),
                    "condition": get_wave_intensity(wave_height)
                }
            })

        result = {"type": "FeatureCollection", "features": features}
        set_cached_data(cache_key, result)
        print(f"🌊 Waves cached: {len(features)} points (bbox: {min_lat:.1f},{min_lon:.1f})")
        return result

    except Exception as e:
        print(f"❌ Wave API Error: {e}")
        return {"type": "FeatureCollection", "features": []}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)