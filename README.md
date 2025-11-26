# 🗺️ Weather Mapping Application - Tech Stack

## Overview
Building an interactive weather visualization platform with multiple environmental data layers (wind, waves, cyclones, AQI).

---

## 🏗️ Core Technologies

### **MapLibre GL JS** - Map Rendering Engine
- **What:** WebGL-based map renderer
- **Why:** Fast, smooth, supports 3D terrain, handles complex visualizations
- **Does:** Draws the map on screen with hardware acceleration

### **MapTiler** - Map Data Provider
- **What:** Cloud service providing map tiles and styles
- **Why:** Beautiful base maps, global CDN, reliable
- **Does:** Supplies the actual map data (streets, satellite, terrain)

### **Deck.gl** - Data Visualization Layer
- **What:** High-performance WebGL visualization library
- **Why:** Renders millions of points at 60fps, perfect for weather animations
- **Does:** Creates animated particles, heatmaps, 3D layers on top of the map

---

## 📡 Data Sources

| Layer | Source | Why | Cost |
|-------|--------|-----|------|
| **Wind** | OpenWeatherMap | Reliable, well-documented | FREE |
| **Ocean Waves** | Open-Meteo | Clean JSON, no API key needed | FREE |
| **Cyclones** | NOAA NHC | Official government data, GeoJSON format | FREE |
| **AQI** | WAQI | 11,000+ stations globally | FREE |

---

## 🔄 How It Works Together

```
MapTiler (provides map tiles)
    ↓
MapLibre (renders map with WebGL)
    ↓
Deck.gl (adds weather visualizations)
    ↓
Weather APIs (provide real-time data)
    ↓
Beautiful animated weather map!
```

---

## 🚫 Why Not Windy?

- **Windy Map API:** Uses Leaflet (incompatible with MapLibre)
- **Windy Point API:** Compatible, but expensive (€990/year)

---

## 📚 Key Documentation and Imp Links 

- MapLibre: https://maplibre.org/
- MapTiler: https://docs.maptiler.com/
- Deck.gl: https://deck.gl/
- OpenWeatherMap: https://openweathermap.org/api
- Open-Meteo: https://open-meteo.com/
- WAQI: https://aqicn.org/api/
- https://github.com/maplibre/awesome-maplibre
- https://www.maptiler.com/tools/weather/
- https://weatherlayers.com/demo.html
- Deck.gl: https://deck.gl/examples/google-maps  
- https://docs.maptiler.com/sdk-js/examples/weather-wind-temperature/


---

## 🎯 Stack Summary

**Rendering:** MapLibre (the engine)  
**Data:** MapTiler (the maps)  
**Visualization:** Deck.gl (the weather layers)  
**Weather Data:** Various free APIs (the information)

**Result:** Custom weather app with Windy-like features, full control, modern tech.