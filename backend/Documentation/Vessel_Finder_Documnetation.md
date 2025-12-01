# Vessel Tracking API Documentation

## API Source
- **Provider:** AISStream.io (WebSocket)
- **Endpoint:** `wss://stream.aisstream.io/v0/stream`
- **Cost:** FREE (limited regions)
- **Type:** Real-time AIS streaming

## How It Works
- WebSocket connects on server startup
- Streams vessel positions to in-memory cache
- Stale data removed after 30 minutes
- 4 monitored regions: Atlantic, Europe, Pacific Asia, Indian Ocean

## Backend Endpoint
```
GET /api/vessels?min_lat={lat}&min_lon={lon}&max_lat={lat}&max_lon={lon}
```

## Response Format
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "mmsi": 244012012,
        "speed": 6.3,
        "course": 157.7,
        "lat": 51.697,
        "lon": 4.610,
        "last_updated": "2025-11-27T17:07:51Z"
      },
      "geometry": {
        "type": "Point",
        "coordinates": [4.610, 51.697]
      }
    }
  ]
}
```

## Response Fields
| Field | Type | Description |
|-------|------|-------------|
| `mmsi` | int | Unique vessel ID |
| `speed` | float | Speed in knots |
| `course` | float | Direction (0-359°) |
| `lat/lon` | float | Position |
| `last_updated` | string | Timestamp |

## Paid Alternatives
| Provider | Cost/mo | Key Feature |
|----------|---------|-------------|
| MarineTraffic | $99-999 | Global + metadata |
| VesselFinder | €200-2000 | Ship details + ports |
| Spire Maritime | $500-5000 | Satellite coverage |

## Production Notes
- Use Redis cache for multi-instance support
- Implement per-user rate limiting
- Debounce viewport changes (500ms)
- Cache results for 2 minutes per bbox