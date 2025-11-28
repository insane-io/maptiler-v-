import asyncio
import json
import os
import websockets
import httpx
from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from dotenv import load_dotenv

load_dotenv()

# --- Configuration ---
AISSTREAM_API_KEY = os.getenv("AISSTREAM_API_KEY")
AQICN_TOKEN = os.getenv("AQICN_TOKEN")
AQICN_BASE_URL = "https://api.waqi.info/map/bounds"

BOUNDING_BOX = [[0.0, 30.0], [50.0, 150.0]]  # Covers Indian Ocean, SE Asia, China, Japan

# --- Global Data Storage ---
vessels = {}  # Store vessel data by MMSI

def get_aqi_color(aqi: int) -> str:
    """
    Returns the hex color based on AQI value (Source: Project PDF).
    """
    if aqi <= 50: return "#2ecc71"   # Good
    if aqi <= 100: return "#f1c40f"  # Moderate
    if aqi <= 150: return "#e67e22"  # Sensitive Groups
    if aqi <= 200: return "#e74c3c"  # Unhealthy
    if aqi <= 300: return "#8e44ad"  # Very Unhealthy
    return "#7d0505"                 # Hazardous

# --- Background Tasks ---
async def connect_ais_stream():
    uri = "wss://stream.aisstream.io/v0/stream"
    
    while True:
        try:
            async with websockets.connect(uri) as websocket:
                print("⚓ Connected to AISStream WebSocket")
                
                subscribe_message = {
                    "APIKey": AISSTREAM_API_KEY,
                    "BoundingBoxes": [BOUNDING_BOX],
                    "FilterMessageTypes": ["PositionReport"] 
                }
                await websocket.send(json.dumps(subscribe_message))

                async for message_json in websocket:
                    message = json.loads(message_json)
     
            # Just return empty collection on error to prevent map breaking               
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

app = FastAPI(
    title="MapTiler Vessel Tracker & AQI API",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def health():
    return {"status": "ok", "vessels_tracked": len(vessels)}

@app.get("/api/vessels")
async def get_vessels(
    min_lat: float = Query(..., description="South-West Latitude"),
    min_lon: float = Query(..., description="South-West Longitude"),
    max_lat: float = Query(..., description="North-East Latitude"),
    max_lon: float = Query(..., description="North-East Longitude")
):
    vessels_snapshot = list(vessels.values())
    
    filtered_vessels = [
        vessel for vessel in vessels_snapshot
        if min_lat <= vessel["properties"]["lat"] <= max_lat 
        and min_lon <= vessel["properties"]["lon"] <= max_lon
    ]
    
    return {
        "type": "FeatureCollection",
        "features": filtered_vessels
    }

@app.get("/api/aqi")
async def get_aqi_data(
    min_lat: float = Query(..., description="South-West Latitude"),
    min_lon: float = Query(..., description="South-West Longitude"),
    max_lat: float = Query(..., description="North-East Latitude"),
    max_lon: float = Query(..., description="North-East Longitude")
):
    if not AQICN_TOKEN:
        raise HTTPException(status_code=500, detail="AQICN_TOKEN not configured")

    latlng_param = f"{min_lat},{min_lon},{max_lat},{max_lon}"

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                AQICN_BASE_URL,
                params={"latlng": latlng_param, "token": AQICN_TOKEN}
            )
            data = response.json()

        if data.get("status") != "ok":
            return {"type": "FeatureCollection", "features": []}

        features = []
        for station in data.get("data", []):
            try:
                raw_aqi = station.get("aqi")
                if raw_aqi == "-": continue
                
                aqi_val = int(raw_aqi)
                
                feature = {
                    "type": "Feature",
                    "properties": {
                        "aqi": aqi_val,
                        "name": station.get("station", {}).get("name", "Unknown"),
                        "color": get_aqi_color(aqi_val),
                        "last_updated": station.get("station", {}).get("time", "")
                    },
                    "geometry": {
                        "type": "Point",
                        "coordinates": [station["lon"], station["lat"]]
                    }
                }
                features.append(feature)
            except (ValueError, TypeError):
                continue

        return {
            "type": "FeatureCollection",
            "features": features
        }

    except httpx.RequestError as e:
        print(f"AQI Fetch Error: {e}")
        raise HTTPException(status_code=503, detail="External API error")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)