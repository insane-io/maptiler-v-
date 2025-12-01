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
from datetime import datetime, timezone, timedelta
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from typing import Dict, Tuple
import hashlib

load_dotenv()

# Configuration
AISSTREAM_API_KEY = os.getenv("AISSTREAM_API_KEY")
AQICN_TOKEN = os.getenv("AQICN_TOKEN")
AQICN_BASE_URL = "https://api.waqi.info/map/bounds"

SUBSCRIPTION_BOXES = [
    [[-60.0, -180.0], [72.0, -30.0]],
    [[35.0, -15.0], [72.0, 45.0]],
    [[20.0, 100.0], [50.0, 150.0]],
    [[-40.0, 30.0], [30.0, 120.0]],    # Indian Ocean
]

# Unified caching for all data types
vessels_cache: Dict[str, Tuple[dict, datetime]] = {}
api_cache: Dict[str, Tuple[dict, datetime]] = {}
CACHE_TTL = timedelta(minutes=10)
MAX_CACHE_SIZE = 100

# Open-Meteo setup
cache_session = requests_cache.CachedSession('.cache', expire_after=7200)
retry_session = retry(cache_session, retries=3, backoff_factor=0.3)
openmeteo = openmeteo_requests.Client(session=retry_session)

# Helper functions
def get_aqi_color(aqi: int) -> str:
    """Return color based on AQI value."""
    if aqi <= 50: return "#2ecc71"
    if aqi <= 100: return "#f1c40f"
    if aqi <= 150: return "#e67e22"
    if aqi <= 200: return "#e74c3c"
    if aqi <= 300: return "#8e44ad"
    return "#7d0505"

def get_wave_intensity(height: float) -> str:
    """Classify sea state based on wave height."""
    if height < 0.5: return "Calm"
    if height < 1.25: return "Smooth"
    if height < 2.5: return "Slight"
    if height < 4.0: return "Moderate"
    if height < 6.0: return "Rough"
    if height < 9.0: return "Very Rough"
    return "High"

def generate_grid(min_lat, min_lon, max_lat, max_lon, step=3.0):
    """Generate grid points for wave data sampling."""
    lats = np.arange(min_lat, max_lat, step)
    lons = np.arange(min_lon, max_lon, step)
    
    if len(lats) == 0: lats = np.array([min_lat])
    if len(lons) == 0: lons = np.array([min_lon])
    lat_grid, lon_grid = np.meshgrid(lats, lons)
    return lat_grid.flatten(), lon_grid.flatten()

def get_cache_key(prefix: str, min_lat: float, min_lon: float, max_lat: float, max_lon: float) -> str:
    """Generate cache key with rounding for better hit rate."""
    bbox_str = f"{prefix}_{min_lat:.1f}_{min_lon:.1f}_{max_lat:.1f}_{max_lon:.1f}"
    return hashlib.md5(bbox_str.encode()).hexdigest()

def get_cached_data(cache_key: str, cache_store: Dict) -> dict | None:
    """Retrieve cached data if not expired."""
    if cache_key in cache_store:
        data, timestamp = cache_store[cache_key]
        if datetime.now(timezone.utc) - timestamp < CACHE_TTL:
            return data
        else:
            del cache_store[cache_key]
    return None

def set_cached_data(cache_key: str, data: dict, cache_store: Dict):
    """Store data with LRU eviction."""
    if len(cache_store) >= MAX_CACHE_SIZE:
        oldest_key = min(cache_store.keys(), key=lambda k: cache_store[k][1])
        del cache_store[oldest_key]
    
    cache_store[cache_key] = (data, datetime.now(timezone.utc))

# Background vessel streaming
async def connect_ais_stream():
    """Connect to AISStream WebSocket and cache vessel data."""
    uri = "wss://stream.aisstream.io/v0/stream"
    while True:
        try:
            async with websockets.connect(uri) as websocket:
                print(f"[AIS] Connected to stream, monitoring {len(SUBSCRIPTION_BOXES)} regions")
                
                subscribe_message = {
                    "APIKey": AISSTREAM_API_KEY,
                    "BoundingBoxes": SUBSCRIPTION_BOXES,
                    "FilterMessageTypes": ["PositionReport"] 
                }
                await websocket.send(json.dumps(subscribe_message))
                async for message_json in websocket:
                    message = json.loads(message_json)
                    if message.get("MessageType") == "PositionReport":
                        data = message["Message"]["PositionReport"]
                        mmsi = data["UserID"]
                        
                        # Store in unified cache with timestamp
                        vessel_data = {
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
                        
                        # Cache vessel with MMSI as key
                        vessels_cache[str(mmsi)] = (vessel_data, datetime.now(timezone.utc))
                        
        except Exception as e:
            print(f"[AIS] Connection error: {e}")
            await asyncio.sleep(5)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage background tasks."""
    task = asyncio.create_task(connect_ais_stream())
    yield
    task.cancel()

app = FastAPI(title="Ocean Analysis API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Endpoints

@app.get("/")
async def health():
    """Health check endpoint with real-time statistics."""
    # Count actual data points from most recent cache entries
    aqi_stations = 0
    wave_points = 0
    
    for cache_key, (data, timestamp) in api_cache.items():
        # Only count recent entries (within TTL)
        if datetime.now(timezone.utc) - timestamp < CACHE_TTL:
            if 'features' in data:
                # Determine type from cache key pattern
                key_str = str(cache_key)
                if any(c in key_str for c in ['aqi', 'AQI']):
                    aqi_stations += len(data['features'])
                elif any(c in key_str for c in ['wave', 'WAVE']):
                    wave_points += len(data['features'])
    
    return {
        "status": "ok",
        "data_sources": {
            "vessels_streaming": len(vessels_cache),
            "aqi_stations": aqi_stations,
            "wave_points": wave_points
        },
        "cache": {
            "total_entries": len(api_cache),
            "ttl_minutes": int(CACHE_TTL.total_seconds() / 60),
            "max_size": MAX_CACHE_SIZE
        },
        "monitoring": {
            "regions": len(SUBSCRIPTION_BOXES),
            "aisstream_connected": len(vessels_cache) > 0
        },
        "endpoints": {
            "vessels": "/api/vessels?min_lat=X&min_lon=Y&max_lat=X&max_lon=Y",
            "aqi": "/api/aqi?min_lat=X&min_lon=Y&max_lat=X&max_lon=Y",
            "waves": "/api/waves?min_lat=X&min_lon=Y&max_lat=X&max_lon=Y",
            "wave_point": "/api/wave-point?lat=X&lon=Y"
        }
    }

@app.get("/api/vessels")
async def get_vessels(
    min_lat: float = Query(...), 
    min_lon: float = Query(...),
    max_lat: float = Query(...), 
    max_lon: float = Query(...)
):
    """Get vessels in viewport - unified caching approach."""
    cache_key = get_cache_key("vessels", min_lat, min_lon, max_lat, max_lon)
    
    # Check if we have cached result for this bounding box
    cached = get_cached_data(cache_key, api_cache)
    if cached:
        print(f"[VESSELS] Cache hit for bbox: {min_lat:.1f},{min_lon:.1f} ({len(cached.get('features', []))} vessels)")
        return cached
    
    # Filter vessels from vessel cache
    filtered = []
    now = datetime.now(timezone.utc)
    stale_count = 0
    
    for mmsi, (vessel_data, timestamp) in list(vessels_cache.items()):
        # Remove stale vessels (older than 30 minutes)
        if now - timestamp > timedelta(minutes=30):
            del vessels_cache[mmsi]
            stale_count += 1
            continue
            
        lat = vessel_data["properties"]["lat"]
        lon = vessel_data["properties"]["lon"]
        
        if min_lat <= lat <= max_lat and min_lon <= lon <= max_lon:
            filtered.append(vessel_data)
    
    result = {"type": "FeatureCollection", "features": filtered}
    
    # Cache the filtered result for this bounding box
    set_cached_data(cache_key, result, api_cache)
    
    if stale_count > 0:
        print(f"[VESSELS] Removed {stale_count} stale vessels")
    print(f"[VESSELS] Cached {len(filtered)} vessels for bbox (Total tracked: {len(vessels_cache)})")
    
    return result

@app.get("/api/aqi")
async def get_aqi_data(
    min_lat: float = Query(...), 
    min_lon: float = Query(...),
    max_lat: float = Query(...), 
    max_lon: float = Query(...)
):
    """Get AQI data from AQICN API with caching."""
    if not AQICN_TOKEN:
        raise HTTPException(status_code=500, detail="AQICN_TOKEN missing")

    cache_key = get_cache_key("aqi", min_lat, min_lon, max_lat, max_lon)
    cached = get_cached_data(cache_key, api_cache)
    if cached:
        print(f"[AQI] Cache hit for bbox: {min_lat:.1f},{min_lon:.1f}")
        return cached

    latlng = f"{min_lat},{min_lon},{max_lat},{max_lon}"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.get(
                AQICN_BASE_URL, 
                params={"latlng": latlng, "token": AQICN_TOKEN}
            )
            data = res.json()

        if data.get("status") != "ok": 
            result = {"type": "FeatureCollection", "features": []}
            set_cached_data(cache_key, result, api_cache)
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
                    "geometry": { "type": "Point", "coordinates": [station["lon"], station["lat"]] }
                })
            except (ValueError, TypeError): 
                continue

        result = {"type": "FeatureCollection", "features": features}
        set_cached_data(cache_key, result, api_cache)
        print(f"[AQI] Cached {len(features)} stations")
        return result

    except httpx.TimeoutException:
        print("[AQI] Request timeout")
        return {"type": "FeatureCollection", "features": []}
    except Exception as e:
        print(f"[AQI] Error: {e}")
        return {"type": "FeatureCollection", "features": []}

@app.get("/api/waves")
async def get_waves(
    min_lat: float = Query(...), 
    min_lon: float = Query(...),
    max_lat: float = Query(...), 
    max_lon: float = Query(...)
):
    """Get wave data grid with caching."""
    cache_key = get_cache_key("waves", min_lat, min_lon, max_lat, max_lon)
    cached = get_cached_data(cache_key, api_cache)
    if cached:
        print(f"[WAVES] Cache hit for bbox: {min_lat:.1f},{min_lon:.1f}")
        return cached
    
    lats, lons = generate_grid(min_lat, min_lon, max_lat, max_lon, step=3.0)
    
    # Limit to 50 points for performance
    max_points = 50
    if len(lats) > max_points:
        indices = np.linspace(0, len(lats)-1, max_points, dtype=int)
        lats = lats[indices]
        lons = lons[indices]
        print(f"[WAVES] Sampled to {max_points} points")
    
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
        set_cached_data(cache_key, result, api_cache)
        print(f"[WAVES] Cached {len(features)} points")
        return result

    except Exception as e:
        print(f"[WAVES] API Error: {e}")
        return {"type": "FeatureCollection", "features": []}

@app.get("/api/waves")
async def get_waves(
    min_lat: float = Query(...), 
    min_lon: float = Query(...),
    max_lat: float = Query(...), 
    max_lon: float = Query(...)
):
    """Get wave data grid with caching."""
    cache_key = get_cache_key("waves", min_lat, min_lon, max_lat, max_lon)
    cached = get_cached_data(cache_key, api_cache)
    if cached:
        print(f"[WAVES] Cache hit for bbox: {min_lat:.1f},{min_lon:.1f}")
        return cached
    
    lats, lons = generate_grid(min_lat, min_lon, max_lat, max_lon, step=3.0)
    
    # Limit to 50 points for performance
    max_points = 50
    if len(lats) > max_points:
        indices = np.linspace(0, len(lats)-1, max_points, dtype=int)
        lats = lats[indices]
        lons = lons[indices]
        print(f"[WAVES] Sampled to {max_points} points")
    
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
            
            # Skip invalid data points (None or NaN)
            if wave_height is None or np.isnan(wave_height):
                continue

            # Clean all values to avoid NaN in JSON
            wave_height = round(wave_height, 2)
            wave_dir = round(wave_dir, 0) if wave_dir and not np.isnan(wave_dir) else 0
            wave_period = round(wave_period, 1) if wave_period and not np.isnan(wave_period) else 0
            swell_height = round(swell_height, 2) if swell_height and not np.isnan(swell_height) else 0

            features.append({
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [float(lons[i]), float(lats[i])]
                },
                "properties": {
                    "wave_height": wave_height,
                    "wave_direction": wave_dir,
                    "wave_period": wave_period,
                    "swell_wave_height": swell_height,
                    "condition": get_wave_intensity(wave_height)
                }
            })

        result = {"type": "FeatureCollection", "features": features}
        set_cached_data(cache_key, result, api_cache)
        print(f"[WAVES] Cached {len(features)} points")
        return result

    except Exception as e:
        print(f"[WAVES] API Error: {e}")
        return {"type": "FeatureCollection", "features": []}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)