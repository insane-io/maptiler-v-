# Waves API Documentation

## API Source
- **Provider:** Open-Meteo Marine API
- **Endpoint:** `https://marine-api.open-meteo.com/v1/marine`
- **Cost:** FREE (unlimited)
- **Resolution:** 11km grid, updated every 6 hours

## Backend Endpoints

### Grid Data
```
GET /api/waves?min_lat={lat}&min_lon={lon}&max_lat={lat}&max_lon={lon}
```
- Returns max 50 points (3° spacing)

### Single Point
```
GET /api/wave-point?lat={lat}&lon={lon}
```

## Response Format

**Grid:**
```json
{
  "type": "FeatureCollection",
  "features": [{
    "type": "Feature",
    "geometry": {"type": "Point", "coordinates": [75.5, 10.2]},
    "properties": {
      "wave_height": 2.5,
      "wave_direction": 270,
      "wave_period": 8.5,
      "swell_wave_height": 1.8,
      "condition": "Slight"
    }
  }]
}
```

**Point:**
```json
{
  "wave_height": 2.5,
  "wave_direction": 270,
  "wave_period": 8.5,
  "swell_wave_height": 1.8,
  "condition": "Slight"
}
```

## Response Fields
| Field | Unit | Description |
|-------|------|-------------|
| `wave_height` | meters | Significant wave height |
| `wave_direction` | degrees | Direction (0-359°) |
| `wave_period` | seconds | Time between crests |
| `swell_wave_height` | meters | Swell wave height |
| `condition` | string | Sea state (WMO) |

## Sea State (WMO)
| Height | Condition |
|--------|-----------|
| < 0.5m | Calm |
| 0.5-1.25m | Smooth |
| 1.25-2.5m | Slight |
| 2.5-4m | Moderate |
| 4-6m | Rough |
| 6-9m | Very Rough |
| > 9m | High |

## Paid Alternatives
| Provider | Cost/mo | Key Feature |
|----------|---------|-------------|
| Copernicus Marine | €0-500 | 4km, hourly updates |
| StormGlass.io | $50-999 | Forecast + historical |
| Windy API | $99-990/yr | Multi-model data |
