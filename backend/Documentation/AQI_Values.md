# AQI API Documentation

## API Source
- **Provider:** WAQI (World Air Quality Index)
- **Endpoint:** `https://api.waqi.info/map/bounds`
- **Cost:** FREE (1000 req/day)
- **Auth:** Token required

## Backend Endpoint
```
GET /api/aqi?min_lat={lat}&min_lon={lon}&max_lat={lat}&max_lon={lon}
```

## Response Format
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "aqi": 146,
        "name": "Vile Parle West, Mumbai, India",
        "color": "#e67e22",
        "last_updated": "2025-11-28T02:30:00+09:00"
      },
      "geometry": {
        "type": "Point",
        "coordinates": [72.83622, 19.10861]
      }
    }
  ]
}
```

## AQI Color Scale
| AQI Range | Color | Hex |
|-----------|-------|-----|
| 0-50 | Green | `#2ecc71` |
| 51-100 | Yellow | `#f1c40f` |
| 101-150 | Orange | `#e67e22` |
| 151-200 | Red | `#e74c3c` |
| 201-300 | Purple | `#8e44ad` |
| 300+ | Maroon | `#7d0505` |

## Paid Alternatives
| Provider | Cost/mo | Key Feature |
|----------|---------|-------------|
| IQAir | $199-999 | Hyperlocal + forecast |
| Breezometer | $299-2000 | Historical + pollutants |