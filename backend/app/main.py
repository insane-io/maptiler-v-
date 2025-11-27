import asyncio
import json
import websockets
from datetime import datetime, timezone
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

AISSTREAM_API_KEY = "698cd1a0f38a0ef1bf2f5d78937ad643c0c39aae" 

BOUNDING_BOX = [[30.0, -10.0], [70.0, 40.0]]
vessels = {}

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
            print(f"⚠️ Connection lost: {e}. Reconnecting in 5s...")
            await asyncio.sleep(5)

@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(connect_ais_stream())
    yield
    task.cancel()

app = FastAPI(
    title="MapTiler Vessel Tracker API",
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
    """Health check endpoint."""
    return {"status": "ok", "vessels_tracked": len(vessels)}

@app.get("/api/vessels")
async def get_vessels():
    """
    Returns the current list of vessels in GeoJSON format.
    This is what MapTiler will poll.
    """
    return {
        "type": "FeatureCollection",
        "features": list(vessels.values())
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)