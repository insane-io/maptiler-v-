import { useEffect, useRef, useState, FC } from 'react';
import * as maptilersdk from '@maptiler/sdk';
import '@maptiler/sdk/dist/maptiler-sdk.css';
import { MAPTILER_KEY, AQI_COLORS } from '../utils/constants';
import Sidebar from './Sidebar';
import Timeline from './Timeline';
import InfoPanel from './InfoPanel';
import type {
  VesselData,
  CycloneData,
  CycloneTrackData,
  WaveData,
  AQIData,
  GeoJSONProperties,
  MapPosition,
} from '../types';

// Import mock data
import mockVessels from '../data/mockVessels.json' with { type: 'json' };
import mockCyclones from '../data/mockCyclones.json' with { type: 'json' };
import mockCycloneTracks from '../data/mockCycloneTracks.json' with { type: 'json' };
import mockWaves from '../data/mockWaves.json' with { type: 'json' };
import mockAQI from '../data/mockAQI.json' with { type: 'json' };

const Map: FC = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maptilersdk.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState<boolean>(false);
  const [activeLayers, setActiveLayers] = useState<string[]>(['satellite']);
  const [hoveredFeature, setHoveredFeature] = useState<GeoJSONProperties | null>(null);
  const [clickedFeature, setClickedFeature] = useState<GeoJSONProperties | null>(null);
  const initialized = useRef<boolean>(false);
  const popup = useRef<maptilersdk.Popup | null>(null);

  useEffect(() => {
    if (initialized.current) return;
    if (map.current) return;

    initialized.current = true;
    maptilersdk.config.apiKey = MAPTILER_KEY;

    console.log('🗺️ Initializing Ocean Analysis Map...');

    map.current = new maptilersdk.Map({
      container: mapContainer.current!,
      style: `https://api.maptiler.com/maps/hybrid/style.json?key=${MAPTILER_KEY}`,
      center: [78.9629, 15.0], // Indian Ocean focus
      zoom: 5,
      attributionControl: false
    });

    // map.current.addControl(new maptilersdk.NavigationControl(), 'top-right');
    map.current.addControl(new maptilersdk.ScaleControl({ unit: 'metric' }), 'bottom-right');
    map.current.addControl(new maptilersdk.FullscreenControl(), 'top-right');

    map.current.on('load', () => {
      console.log('✅ Map loaded - Adding layers...');
      initializeLayers();
      setupInteractions();
      setMapLoaded(true);
    });

    return () => {
      if (map.current) map.current.remove();
    };
  }, []);

  const initializeLayers = (): void => {
    // 1. VESSELS LAYER
    map.current!.addSource('vessels', {
      type: 'geojson',
      data: mockVessels as unknown as VesselData
    });

    map.current!.addLayer({
      id: 'vessels-layer',
      type: 'circle',
      source: 'vessels',
      paint: {
        'circle-radius': 8,
        'circle-color': [
          'match',
          ['get', 'type'],
          'Container Ship', '#3498db',
          'Tanker', '#e74c3c',
          'Cargo Ship', '#f39c12',
          '#95a5a6'
        ],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff'
      },
      layout: {
        'visibility': 'none'
      }
    } as any);

    // Vessel labels
    map.current!.addLayer({
      id: 'vessels-labels',
      type: 'symbol',
      source: 'vessels',
      layout: {
        'text-field': ['get', 'vessel_name'],
        'text-size': 11,
        'text-offset': [0, 1.5],
        'text-anchor': 'top',
        'visibility': 'none'
      },
      paint: {
        'text-color': '#ffffff',
        'text-halo-color': '#000000',
        'text-halo-width': 1
      }
    } as any);

    // 2. CYCLONES LAYER
    map.current!.addSource('cyclones', {
      type: 'geojson',
      data: mockCyclones as unknown as CycloneData
    });

    map.current!.addLayer({
      id: 'cyclones-layer',
      type: 'circle',
      source: 'cyclones',
      paint: {
        'circle-radius': 12,
        'circle-color': [
          'match',
          ['get', 'category'],
          1, '#3498db',
          2, '#f39c12',
          3, '#e67e22',
          4, '#e74c3c',
          5, '#c0392b',
          '#95a5a6'
        ],
        'circle-stroke-width': 3,
        'circle-stroke-color': '#ffffff',
        'circle-opacity': 0.8
      },
      layout: {
        'visibility': 'none'
      }
    } as any);

    // Cyclone labels
    map.current!.addLayer({
      id: 'cyclones-labels',
      type: 'symbol',
      source: 'cyclones',
      layout: {
        'text-field': ['get', 'name'],
        'text-size': 12,
        'text-offset': [0, 2],
        'text-anchor': 'top',
        'visibility': 'none'
      },
      paint: {
        'text-color': '#ffffff',
        'text-halo-color': '#e74c3c',
        'text-halo-width': 2
      }
    } as any);

    // Cyclone tracks
    map.current!.addSource('cyclone-tracks', {
      type: 'geojson',
      data: mockCycloneTracks as unknown as CycloneTrackData
    });

    map.current!.addLayer({
      id: 'cyclone-tracks-layer',
      type: 'line',
      source: 'cyclone-tracks',
      paint: {
        'line-color': [
          'match',
          ['get', 'track_type'],
          'historical', '#e74c3c',
          'forecast', '#f39c12',
          '#95a5a6'
        ],
        'line-width': 2,
        'line-dasharray': [
          'match',
          ['get', 'track_type'],
          'forecast', ['literal', [2, 2]],
          ['literal', [1, 0]]
        ]
      },
      layout: {
        'visibility': 'none'
      }
    } as any);

    // 3. WAVES HEATMAP
    map.current!.addSource('waves', {
      type: 'geojson',
      data: mockWaves as unknown as WaveData
    });

    map.current!.addLayer({
      id: 'waves-heatmap',
      type: 'heatmap',
      source: 'waves',
      paint: {
        'heatmap-weight': [
          'interpolate',
          ['linear'],
          ['get', 'wave_height'],
          0, 0,
          6, 1
        ],
        'heatmap-intensity': 1,
        'heatmap-color': [
          'interpolate',
          ['linear'],
          ['heatmap-density'],
          0, 'rgba(33, 102, 172, 0)',
          0.2, 'rgb(103, 169, 207)',
          0.4, 'rgb(209, 229, 240)',
          0.6, 'rgb(253, 219, 199)',
          0.8, 'rgb(239, 138, 98)',
          1, 'rgb(178, 24, 43)'
        ],
        'heatmap-radius': 50,
        'heatmap-opacity': 0.7
      },
      layout: {
        'visibility': 'none'
      }
    } as any);

    // 4. AQI LAYER
    map.current!.addSource('aqi', {
      type: 'geojson',
      data: mockAQI as unknown as AQIData
    });

    map.current!.addLayer({
      id: 'aqi-layer',
      type: 'circle',
      source: 'aqi',
      paint: {
        'circle-radius': 20,
        'circle-color': [
          'step',
          ['get', 'aqi'],
          AQI_COLORS.GOOD, 50,
          AQI_COLORS.MODERATE, 100,
          AQI_COLORS.USG, 150,
          AQI_COLORS.UNHEALTHY, 200,
          AQI_COLORS.VERY_UNHEALTHY, 300,
          AQI_COLORS.HAZARDOUS
        ],
        'circle-opacity': 0.6,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff'
      },
      layout: {
        'visibility': 'none'
      }
    } as any);

    // AQI labels
    map.current!.addLayer({
      id: 'aqi-labels',
      type: 'symbol',
      source: 'aqi',
      layout: {
        'text-field': ['concat', ['get', 'city'], '\nAQI: ', ['get', 'aqi']],
        'text-size': 11,
        'text-anchor': 'top',
        'text-offset': [0, 1.5],
        'visibility': 'none'
      },
      paint: {
        'text-color': '#ffffff',
        'text-halo-color': '#000000',
        'text-halo-width': 1
      }
    } as any);

    // 5. WIND LAYER (OpenWeatherMap)
    map.current!.addSource('wind-tiles', {
      type: 'raster',
      tiles: [
        `https://tile.openweathermap.org/map/wind_new/{z}/{x}/{y}.png?appid=${import.meta.env.VITE_OPENWEATHER_KEY || 'demo'}`
      ],
      tileSize: 256
    });

    map.current!.addLayer({
      id: 'wind-layer',
      type: 'raster',
      source: 'wind-tiles',
      paint: {
        'raster-opacity': 0.6
      },
      layout: {
        'visibility': 'none'
      }
    } as any);

    // 6. PRECIPITATION LAYER
    map.current!.addSource('precipitation-tiles', {
      type: 'raster',
      tiles: [
        `https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${import.meta.env.VITE_OPENWEATHER_KEY || 'demo'}`
      ],
      tileSize: 256
    });

    map.current!.addLayer({
      id: 'precipitation-layer',
      type: 'raster',
      source: 'precipitation-tiles',
      paint: {
        'raster-opacity': 0.7
      },
      layout: {
        'visibility': 'none'
      }
    } as any);

    // 7. TEMPERATURE LAYER
    map.current!.addSource('temperature-tiles', {
      type: 'raster',
      tiles: [
        `https://tile.openweathermap.org/map/temp_new/{z}/{x}/{y}.png?appid=${import.meta.env.VITE_OPENWEATHER_KEY || 'demo'}`
      ],
      tileSize: 256
    });

    map.current!.addLayer({
      id: 'temperature-layer',
      type: 'raster',
      source: 'temperature-tiles',
      paint: {
        'raster-opacity': 0.6
      },
      layout: {
        'visibility': 'none'
      }
    } as any);

    // 8. PRESSURE LAYER
    map.current!.addSource('pressure-tiles', {
      type: 'raster',
      tiles: [
        `https://tile.openweathermap.org/map/pressure_new/{z}/{x}/{y}.png?appid=${import.meta.env.VITE_OPENWEATHER_KEY || 'demo'}`
      ],
      tileSize: 256
    });

    map.current!.addLayer({
      id: 'pressure-layer',
      type: 'raster',
      source: 'pressure-tiles',
      paint: {
        'raster-opacity': 0.5
      },
      layout: {
        'visibility': 'none'
      }
    } as any);

    // 9. CLOUDS LAYER (Instead of humidity - more visual)
    map.current!.addSource('clouds-tiles', {
      type: 'raster',
      tiles: [
        `https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=${import.meta.env.VITE_OPENWEATHER_KEY || 'demo'}`
      ],
      tileSize: 256
    });

    map.current!.addLayer({
      id: 'humidity-layer', 
      type: 'raster',
      source: 'clouds-tiles',
      paint: {
        'raster-opacity': 0.6
      },
      layout: {
        'visibility': 'none'
      }
    } as any);

    // 10. RADAR LAYER (Precipitation intensity)
    map.current!.addSource('radar-tiles', {
      type: 'raster',
      tiles: [
        `https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${import.meta.env.VITE_OPENWEATHER_KEY || 'demo'}`
      ],
      tileSize: 256
    });

    map.current!.addLayer({
      id: 'radar-layer',
      type: 'raster',
      source: 'radar-tiles',
      paint: {
        'raster-opacity': 0.8
      },
      layout: {
        'visibility': 'none'
      }
    } as any);

    console.log('✅ All layers initialized');
  };

  const setupInteractions = (): void => {
    // Hover effects for vessels
    map.current!.on('mouseenter', 'vessels-layer', (e: maptilersdk.MapLayerMouseEvent) => {
      map.current!.getCanvas().style.cursor = 'pointer';
      if (e.features && e.features.length > 0) {
        setHoveredFeature(e.features[0].properties);
      }
    });

    map.current!.on('mouseleave', 'vessels-layer', () => {
      map.current!.getCanvas().style.cursor = '';
      setHoveredFeature(null);
    });

    // Click for detailed popup
    map.current!.on('click', 'vessels-layer', (e: maptilersdk.MapLayerMouseEvent) => {
      const feature = e.features![0];
      const coordinates = (feature.geometry as any).coordinates as [number, number];
      const props = feature.properties;

      if (popup.current) popup.current.remove();

      popup.current = new maptilersdk.Popup()
        .setLngLat(coordinates)
        .setHTML(`
          <div style="padding: 8px; min-width: 200px;">
            <h3 style="margin: 0 0 8px 0; font-size: 14px; color: #2c3e50;">
              🚢 ${props.vessel_name}
            </h3>
            <div style="font-size: 12px; line-height: 1.6; color: #555;">
              <strong>Type:</strong> ${props.type}<br/>
              <strong>Speed:</strong> ${props.speed} knots<br/>
              <strong>Course:</strong> ${props.course}°<br/>
              <strong>Destination:</strong> ${props.destination}<br/>
              <strong>ETA:</strong> ${new Date(props.eta).toLocaleString()}<br/>
              <strong>Flag:</strong> ${props.flag}
            </div>
          </div>
        `)
        .addTo(map.current!);
    });

    // Similar interactions for cyclones
    map.current!.on('click', 'cyclones-layer', (e: maptilersdk.MapLayerMouseEvent) => {
      const feature = e.features![0];
      const coordinates = (feature.geometry as any).coordinates as [number, number];
      const props = feature.properties;

      if (popup.current) popup.current.remove();

      popup.current = new maptilersdk.Popup()
        .setLngLat(coordinates)
        .setHTML(`
          <div style="padding: 8px; min-width: 200px;">
            <h3 style="margin: 0 0 8px 0; font-size: 14px; color: #e74c3c;">
              🌀 ${props.name}
            </h3>
            <div style="font-size: 12px; line-height: 1.6; color: #555;">
              <strong>Category:</strong> ${props.category}<br/>
              <strong>Wind Speed:</strong> ${props.wind_speed} km/h<br/>
              <strong>Pressure:</strong> ${props.pressure} mb<br/>
              <strong>Movement:</strong> ${props.movement}<br/>
              <strong>Intensity:</strong> ${props.intensity}
            </div>
          </div>
        `)
        .addTo(map.current!);
    });

    // AQI clicks
    map.current!.on('click', 'aqi-layer', (e: maptilersdk.MapLayerMouseEvent) => {
      const feature = e.features![0];
      const coordinates = (feature.geometry as any).coordinates as [number, number];
      const props = feature.properties;

      if (popup.current) popup.current.remove();

      popup.current = new maptilersdk.Popup()
        .setLngLat(coordinates)
        .setHTML(`
          <div style="padding: 8px; min-width: 180px;">
            <h3 style="margin: 0 0 8px 0; font-size: 14px; color: #2c3e50;">
              💨 ${props.city}
            </h3>
            <div style="font-size: 12px; line-height: 1.6; color: #555;">
              <strong>AQI:</strong> ${props.aqi}<br/>
              <strong>PM2.5:</strong> ${props.pm25} μg/m³<br/>
              <strong>Category:</strong> ${props.category}
            </div>
          </div>
        `)
        .addTo(map.current!);
    });
  };

  const handleLayerToggle = (layerId: string): void => {
    if (!map.current) return;

    console.log('🔄 Toggle layer:', layerId);

    const layerMap: Record<string, string[]> = {
      'vessels': ['vessels-layer', 'vessels-labels'],
      'cyclones': ['cyclones-layer', 'cyclones-labels', 'cyclone-tracks-layer'],
      'waves': ['waves-heatmap'],
      'aqi': ['aqi-layer', 'aqi-labels'],
      'wind': ['wind-layer'],
      'precipitation': ['precipitation-layer'],
      'temperature': ['temperature-layer'],
      'pressure': ['pressure-layer'],
      'humidity': ['humidity-layer'],
      'radar': ['radar-layer']
    };

    const layers = layerMap[layerId];
    if (!layers) {
      console.warn(`⚠️ No layer mapping for: ${layerId}`);
      return;
    }

    setActiveLayers(prev => {
      const isActive = prev.includes(layerId);
      const newVisibility = isActive ? 'none' : 'visible';

      layers.forEach(layer => {
        if (map.current!.getLayer(layer)) {
          map.current!.setLayoutProperty(layer, 'visibility', newVisibility as 'visible' | 'none');
          console.log(`  ${isActive ? '❌' : '✅'} ${layer}: ${newVisibility}`);
        }
      });

      return isActive ? prev.filter(id => id !== layerId) : [...prev, layerId];
    });
  };

  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative', background: '#0a1929' }}>
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />

      {mapLoaded && (
        <>
          <Sidebar onLayerToggle={handleLayerToggle} activeLayers={activeLayers} />
          <Timeline onTimeChange={(time: any) => console.log('Time changed:', time)} />
          <InfoPanel
            data={hoveredFeature}
            position={map.current?.getCenter()}
          />
        </>
      )}
    </div>
  );
}

export default Map;