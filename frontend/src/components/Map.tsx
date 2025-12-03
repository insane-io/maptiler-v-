import '@maptiler/sdk/dist/maptiler-sdk.css';

import * as maptilersdk from '@maptiler/sdk';
import React, { FC, useCallback, useEffect, useRef, useState } from 'react';

import type { GeoJSONFeatureCollection, GeoJSONProperties } from '../types';
import { AQI_COLORS, MAPTILER_KEY } from '../utils/constants';
import InfoPanel from './InfoPanel';
import Sidebar from './Sidebar';
import Timeline from './Timeline';

const BACKEND_API_URL = 'http://localhost:8000';

// Unified fetch function - same approach for all data types
const fetchDataFromBackend = async (
  endpoint: string,
  minLat: number,
  minLon: number,
  maxLat: number,
  maxLon: number
): Promise<GeoJSONFeatureCollection | null> => {
  try {
    const params = new URLSearchParams({
      min_lat: minLat.toString(),
      min_lon: minLon.toString(),
      max_lat: maxLat.toString(),
      max_lon: maxLon.toString(),
    });

    const response = await fetch(`${BACKEND_API_URL}${endpoint}?${params}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-cache',
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();

    if (!data || !Array.isArray(data.features)) {
      return { type: 'FeatureCollection', features: [] };
    }

    const layerName = endpoint.split('/').pop()?.toUpperCase() || 'DATA';
    console.log(`[${layerName}] Fetched ${data.features.length} items`);
    return data;
  } catch (error: unknown) {
    const layerName = endpoint.split('/').pop()?.toUpperCase() || 'DATA';
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    console.error(`[${layerName}] Fetch error:`, errorMessage);
    return { type: 'FeatureCollection', features: [] };
  }
};

const fetchCyclonesFromBackend = async (
  minLat: number,
  minLon: number,
  maxLat: number,
  maxLon: number
): Promise<GeoJSONFeatureCollection | null> => {
  try {
    const params = new URLSearchParams({
      min_lat: minLat.toString(),
      min_lon: minLon.toString(),
      max_lat: maxLat.toString(),
      max_lon: maxLon.toString(),
    });

    const response = await fetch(`${BACKEND_API_URL}/api/cyclones?${params}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      console.warn(`Backend Cyclones API error: ${response.status}`);
      // return empty collection (no mock data)
      return { type: 'FeatureCollection', features: [] };
    }

    const data = await response.json();
    console.log(
      `✅ Fetched ${data.features?.length ?? 0} cyclones from backend`
    );
    return data;
  } catch (error) {
    console.error('❌ Failed to fetch cyclones from backend:', error);
    console.log('⚠️ No cyclones data available (empty collection)');
    return { type: 'FeatureCollection', features: [] };
  }
};

const Map: FC = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maptilersdk.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState<boolean>(false);
  const [activeLayers, setActiveLayers] = useState<string[]>(['satellite']);
  const activeLayersRef = useRef<string[]>(['satellite']);
  const [hoveredFeature, setHoveredFeature] =
    useState<GeoJSONProperties | null>(null);
  const initialized = useRef<boolean>(false);
  const popup = useRef<maptilersdk.Popup | null>(null);
  const fetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mapCenter, setMapCenter] = useState<
    { lng: number; lat: number } | undefined
  >(undefined);

  // Unified data update function - same approach for vessels, AQI, and waves
  const updateDataFromBackend = useCallback(async (): Promise<void> => {
    if (!map.current) {
      return;
    }

    const bounds = map.current.getBounds();
    if (!bounds) {
      return;
    }

    const minLat = bounds.getSouth();
    const minLon = bounds.getWest();
    const maxLat = bounds.getNorth();
    const maxLon = bounds.getEast();

    const currentActiveLayers = activeLayersRef.current;

    console.log(
      `[MAP] Updating data for bbox: [${minLat.toFixed(2)}, ${minLon.toFixed(2)}] to [${maxLat.toFixed(2)}, ${maxLon.toFixed(2)}]`
    );

    // Build fetch requests for all active data layers
    const dataRequests: Array<{ endpoint: string; sourceId: string }> = [];

    if (currentActiveLayers.includes('vessels')) {
      dataRequests.push({ endpoint: '/api/vessels', sourceId: 'vessels' });
    }
    if (currentActiveLayers.includes('aqi')) {
      dataRequests.push({ endpoint: '/api/aqi', sourceId: 'aqi' });
    }
    if (currentActiveLayers.includes('waves')) {
      dataRequests.push({ endpoint: '/api/waves', sourceId: 'waves' });
    }

    if (dataRequests.length === 0) {
      console.log('[MAP] No active data layers to fetch');
      return;
    }

    // Fetch and update all layers in parallel - unified approach
    dataRequests.forEach(({ endpoint, sourceId }) => {
      fetchDataFromBackend(endpoint, minLat, minLon, maxLat, maxLon)
        .then((data) => {
          if (!map.current || !data) {
            return;
          }

          const source = map.current.getSource(sourceId) as
            | maptilersdk.GeoJSONSource
            | undefined;
          if (source) {
            try {
              source.setData(data);
              console.log(
                `[${sourceId.toUpperCase()}] Updated: ${data.features?.length || 0} features`
              );
            } catch (error) {
              console.error(`[${sourceId.toUpperCase()}] Update error:`, error);
            }
          }
        })
        .catch((error) => {
          console.error(`[${sourceId.toUpperCase()}] Fetch failed:`, error);
        });
    });
  }, []);

  const initializeLayers = useCallback((): void => {
    // 1. VESSELS LAYER - Enhanced with better clustering
    map.current!.addSource('vessels', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
      cluster: true,
      clusterMaxZoom: 14,
      clusterRadius: 50,
    });

    // Cluster circles with gradient effect
    map.current!.addLayer({
      id: 'vessels-clusters',
      type: 'circle',
      source: 'vessels',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': [
          'step',
          ['get', 'point_count'],
          '#3498db',
          10,
          '#2ecc71',
          50,
          '#f39c12',
          100,
          '#e74c3c',
          500,
          '#9b59b6',
        ],
        'circle-radius': [
          'step',
          ['get', 'point_count'],
          18,
          10,
          24,
          50,
          30,
          100,
          38,
          500,
          46,
        ],
        'circle-stroke-width': 3,
        'circle-stroke-color': '#ffffff',
        'circle-opacity': 0.9,
      },
      layout: { visibility: 'none' },
    });

    // Cluster count with better styling
    map.current!.addLayer({
      id: 'vessels-cluster-count',
      type: 'symbol',
      source: 'vessels',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': ['get', 'point_count'],
        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
        'text-size': 14,
        visibility: 'none',
      },
      paint: {
        'text-color': '#ffffff',
        'text-halo-color': '#000000',
        'text-halo-width': 2,
      },
    });

    // Individual vessels with icons
    map.current!.addLayer({
      id: 'vessels-unclustered',
      type: 'circle',
      source: 'vessels',
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-radius': 8,
        'circle-color': '#3498db',
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
        'circle-opacity': 0.95,
      },
      layout: { visibility: 'none' },
    });

    // Vessel direction indicator (optional - add if you have bearing data)
    map.current!.addLayer({
      id: 'vessels-direction',
      type: 'symbol',
      source: 'vessels',
      filter: ['!', ['has', 'point_count']],
      layout: {
        'text-field': ['get', 'vessel_name'],
        'text-size': 11,
        'text-offset': [0, 1.2],
        'text-anchor': 'top',
        visibility: 'none',
      },
      paint: {
        'text-color': '#ffffff',
        'text-halo-color': '#000000',
        'text-halo-width': 1,
      },
    });

    // 2. CYCLONES LAYER
    // Initialize source empty — DO NOT preload cyclones here (we load on-demand)
    map.current!.addSource('cyclones', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [],
      },
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
          1,
          '#3498db',
          2,
          '#f39c12',
          3,
          '#e67e22',
          4,
          '#e74c3c',
          5,
          '#c0392b',
          '#95a5a6',
        ],
        'circle-stroke-width': 3,
        'circle-stroke-color': '#ffffff',
        'circle-opacity': 0.8,
      },
      layout: {
        visibility: 'none',
      },
    });

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
        visibility: 'none',
      },
      paint: {
        'text-color': '#ffffff',
        'text-halo-color': '#e74c3c',
        'text-halo-width': 2,
      },
    });

    // Cyclone tracks - initialize empty (no mock tracks)
    map.current!.addSource('cyclone-tracks', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });

    map.current!.addLayer({
      id: 'cyclone-tracks-layer',
      type: 'line',
      source: 'cyclone-tracks',
      paint: {
        'line-color': [
          'match',
          ['get', 'track_type'],
          'historical',
          '#e74c3c',
          'forecast',
          '#f39c12',
          '#95a5a6',
        ],
        'line-width': 2,
        'line-dasharray': [
          'match',
          ['get', 'track_type'],
          'forecast',
          ['literal', [2, 2]],
          ['literal', [1, 0]],
        ],
      },
      layout: {
        visibility: 'none',
      },
    });

    // 3. WAVES HEATMAP
    // Removed mockWaves — waves source will be initialized empty and populated from backend when enabled.
    // (Actual waves source + layers are added later in this initialization block.)

    // 4. AQI LAYER (initially empty, will be populated from backend)
    map.current!.addSource('aqi', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });

    // AQI rectangular background
    map.current!.addLayer({
      id: 'aqi-rectangles',
      type: 'symbol',
      source: 'aqi',
      layout: {
        'icon-image': 'marker-15', // Will be replaced with rectangle
        'icon-size': 2.5,
        'icon-allow-overlap': true,
        visibility: 'none',
      },
      paint: {
        'icon-opacity': 0.95,
      },
    });

    // AQI value text - BOLD and LARGE
    map.current!.addLayer({
      id: 'aqi-labels',
      type: 'symbol',
      source: 'aqi',
      layout: {
        'text-field': ['to-string', ['get', 'aqi']],
        'text-size': 18,
        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
        'text-anchor': 'center',
        'text-allow-overlap': true,
        visibility: 'none',
      },
      paint: {
        'text-color': '#ffffff',
        'text-halo-color': [
          'step',
          ['get', 'aqi'],
          '#2ecc71',
          50,
          '#f1c40f',
          100,
          '#e67e22',
          150,
          '#e74c3c',
          200,
          '#8e44ad',
          300,
          '#7d0505',
        ],
        'text-halo-width': 8,
        'text-halo-blur': 0,
      },
    });

    // AQI colored circles behind text
    map.current!.addLayer({
      id: 'aqi-circles',
      type: 'circle',
      source: 'aqi',
      paint: {
        'circle-radius': 22,
        'circle-color': [
          'step',
          ['get', 'aqi'],
          AQI_COLORS.GOOD,
          50,
          AQI_COLORS.MODERATE,
          100,
          AQI_COLORS.USG,
          150,
          AQI_COLORS.UNHEALTHY,
          200,
          AQI_COLORS.VERY_UNHEALTHY,
          300,
          AQI_COLORS.HAZARDOUS,
        ],
        'circle-opacity': 0.9,
        'circle-stroke-width': 3,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-opacity': 1,
      },
      layout: { visibility: 'none' },
    });

    // 3. WAVES LAYER - Pinpoint markers with wave height
    map.current!.addSource('waves', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });

    // Wave heatmap background
    map.current!.addLayer({
      id: 'waves-heatmap',
      type: 'heatmap',
      source: 'waves',
      paint: {
        'heatmap-weight': [
          'interpolate',
          ['linear'],
          ['get', 'wave_height'],
          0,
          0,
          6,
          1,
        ],
        'heatmap-intensity': 0.8,
        'heatmap-color': [
          'interpolate',
          ['linear'],
          ['heatmap-density'],
          0,
          'rgba(33, 102, 172, 0)',
          0.2,
          'rgb(103, 169, 207)',
          0.4,
          'rgb(209, 229, 240)',
          0.6,
          'rgb(253, 219, 199)',
          0.8,
          'rgb(239, 138, 98)',
          1,
          'rgb(178, 24, 43)',
        ],
        'heatmap-radius': 40,
        'heatmap-opacity': 0.6,
      },
      layout: { visibility: 'none' },
    });

    // Wave pinpoint markers
    map.current!.addLayer({
      id: 'waves-points',
      type: 'circle',
      source: 'waves',
      paint: {
        'circle-radius': 6,
        'circle-color': [
          'step',
          ['get', 'wave_height'],
          '#2ecc71',
          1,
          '#3498db',
          2,
          '#f1c40f',
          3,
          '#e67e22',
          4,
          '#e74c3c',
          5,
          '#c0392b',
        ],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
        'circle-opacity': 0.9,
      },
      layout: { visibility: 'none' },
    });

    // Wave height labels
    map.current!.addLayer({
      id: 'waves-labels',
      type: 'symbol',
      source: 'waves',
      layout: {
        'text-field': ['concat', ['to-string', ['get', 'wave_height']], 'm'],
        'text-size': 11,
        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
        'text-anchor': 'top',
        'text-offset': [0, 0.8],
        visibility: 'none',
      },
      paint: {
        'text-color': '#ffffff',
        'text-halo-color': '#0077be',
        'text-halo-width': 2,
      },
    });

    // 4. WEATHER LAYERS - OpenWeatherMap tiles
    const owmKey =
      (import.meta as unknown as { env: { VITE_OPENWEATHER_KEY?: string } }).env
        .VITE_OPENWEATHER_KEY || 'demo';
    const weatherLayers = [
      { id: 'wind-layer', url: 'wind_new', opacity: 0.6 },
      { id: 'precipitation-layer', url: 'precipitation_new', opacity: 0.7 },
      { id: 'temperature-layer', url: 'temp_new', opacity: 0.6 },
      { id: 'pressure-layer', url: 'pressure_new', opacity: 0.5 },
      { id: 'humidity-layer', url: 'clouds_new', opacity: 0.6 },
      { id: 'radar-layer', url: 'precipitation_new', opacity: 0.8 },
    ];

    weatherLayers.forEach((layer) => {
      map.current!.addSource(`${layer.id}-tiles`, {
        type: 'raster',
        tiles: [
          `https://tile.openweathermap.org/map/${layer.url}/{z}/{x}/{y}.png?appid=${owmKey}`,
        ],
        tileSize: 256,
      });

      map.current!.addLayer({
        id: layer.id,
        type: 'raster',
        source: `${layer.id}-tiles`,
        paint: { 'raster-opacity': layer.opacity },
        layout: { visibility: 'none' },
      });
    });

    console.log('[MAP] All layers initialized');
  }, []);

  const setupInteractions = useCallback((): void => {
    // Vessel hover
    map.current!.on(
      'mouseenter',
      'vessels-unclustered',
      (e: maptilersdk.MapLayerMouseEvent) => {
        map.current!.getCanvas().style.cursor = 'pointer';
        if (e.features && e.features.length > 0) {
          setHoveredFeature(e.features[0].properties);
        }
      }
    );

    map.current!.on('mouseleave', 'vessels-unclustered', () => {
      map.current!.getCanvas().style.cursor = '';
      setHoveredFeature(null);
    });

    map.current!.on(
      'click',
      'vessels-unclustered',
      (e: maptilersdk.MapLayerMouseEvent) => {
        const feature = e.features![0];
        const geometry = feature.geometry as {
          type: string;
          coordinates: [number, number];
        };
        const coordinates = geometry.coordinates;
        const props = feature.properties;

        if (popup.current) {
          popup.current.remove();
        }

        const speed = props.speed || 0;
        const getSpeedStatus = () => {
          if (speed === 0) {
            return { text: 'Stationary', color: '#95a5a6', emoji: '⚓' };
          }
          if (speed < 5) {
            return { text: 'Slow', color: '#3498db', emoji: '🐌' };
          }
          if (speed < 15) {
            return { text: 'Moderate', color: '#2ecc71', emoji: '⛵' };
          }
          if (speed < 25) {
            return { text: 'Fast', color: '#f39c12', emoji: '🚤' };
          }
          return { text: 'Very Fast', color: '#e74c3c', emoji: '🚀' };
        };

        const speedStatus = getSpeedStatus();

        popup.current = new maptilersdk.Popup({ offset: 25 })
          .setLngLat(coordinates)
          .setHTML(
            `
          <div style="padding: 16px; min-width: 280px; background: linear-gradient(135deg, #1e3a5f 0%, #0a1929 100%); border-radius: 14px; border: 2px solid #3498db;">
            <!-- Header -->
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 14px; padding-bottom: 12px; border-bottom: 2px solid rgba(255,255,255,0.1);">
              <div style="font-size: 36px;">${speedStatus.emoji}</div>
              <div>
                <h3 style="margin: 0; font-size: 17px; color: white; font-weight: bold;">
                  🚢 Vessel MMSI: ${props.mmsi || 'Unknown'}
                </h3>
                <p style="margin: 2px 0 0 0; font-size: 12px; color: #64748b;">Maritime vessel tracking</p>
              </div>
            </div>

            <!-- Stats Grid -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px;">
              <div style="background: rgba(255,255,255,0.05); border-radius: 8px; padding: 10px, text-align: center;">
                <div style="font-size: 22px; font-weight: bold; color: ${speedStatus.color};">${speed.toFixed(1)}</div>
                <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">Speed (knots)</div>
              </div>
              <div style="background: rgba(255,255,255,0.05); border-radius: 8px; padding: 10px, text-align: center;">
                <div style="font-size: 22px; font-weight: bold; color: #9b59b6;">${props.course || 0}°</div>
                <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">Course</div>
              </div>
            </div>

            <!-- Position Info -->
            <div style="background: rgba(255,255,255,0.05); border-radius: 8px; padding: 12px; margin-bottom: 12px;">
              <div style="color: #cbd5e1; font-size: 12px; font-weight: 600; margin-bottom: 8px;">POSITION</div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                <div>
                  <div style="color: #94a3b8; font-size: 10px;">LATITUDE</div>
                  <div style="color: white; font-size: 14px; font-weight: 600; font-family: monospace;">${props.lat?.toFixed(4) || 'N/A'}°</div>
                </div>
                <div>
                  <div style="color: #94a3b8; font-size: 10px;">LONGITUDE</div>
                  <div style="color: white; font-size: 14px; font-weight: 600; font-family: monospace;">${props.lon?.toFixed(4) || 'N/A'}°</div>
                </div>
              </div>
            </div>

            <!-- Status Banner -->
            <div style="background: linear-gradient(90deg, ${speedStatus.color}20, ${speedStatus.color}40); border-left: 4px solid ${speedStatus.color}; border-radius: 8px; padding: 10px; margin-bottom: 12px;">
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <span style="color: #cbd5e1; font-size: 12px; font-weight: 600;">STATUS</span>
                <span style="color: ${speedStatus.color}; font-size: 14px; font-weight: bold;">${speedStatus.text}</span>
              </div>
            </div>

            <!-- Footer -->
            <div style="display: flex; align-items: center; justify-content: space-between; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.1);">
              <span style="color: #64748b; font-size: 10px;">🕐 ${props.last_updated ? new Date(props.last_updated).toLocaleTimeString() : 'N/A'}</span>
              <span style="background: rgba(34,197,94,0.2); color: #22c55e; padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: 600;">● AIS</span>
            </div>
          </div>
        `
          )
          .addTo(map.current!);
      }
    );

    // Vessel cluster zoom
    map.current!.on(
      'click',
      'vessels-clusters',
      (e: maptilersdk.MapLayerMouseEvent) => {
        const features = e.features!;
        const clusterId = features[0].properties?.cluster_id;
        const geometry = features[0].geometry as {
          type: string;
          coordinates: [number, number];
        };

        if (clusterId && map.current) {
          const source = map.current.getSource(
            'vessels'
          ) as maptilersdk.GeoJSONSource;

          // Use Promise-based approach instead of callback
          source
            .getClusterExpansionZoom(clusterId)
            .then((zoom: number) => {
              if (map.current) {
                map.current.easeTo({
                  center: geometry.coordinates,
                  zoom: zoom,
                });
              }
            })
            .catch((err: Error) => {
              console.error('[CLUSTER] Expansion zoom error:', err);
            });
        }
      }
    );

    // AQI click - Enhanced popup
    map.current!.on(
      'click',
      'aqi-circles',
      (e: maptilersdk.MapLayerMouseEvent) => {
        const feature = e.features![0];
        const geometry = feature.geometry as {
          type: string;
          coordinates: [number, number];
        };
        const coordinates = geometry.coordinates;
        const props = feature.properties;

        if (popup.current) {
          popup.current.remove();
        }

        const getAQIStatus = (aqi: number) => {
          if (aqi <= 50) {
            return {
              text: 'Good',
              color: AQI_COLORS.GOOD,
              emoji: '😊',
              description: 'Air quality is satisfactory',
            };
          }
          if (aqi <= 100) {
            return {
              text: 'Moderate',
              color: AQI_COLORS.MODERATE,
              emoji: '😐',
              description: 'Acceptable for most people',
            };
          }
          if (aqi <= 150) {
            return {
              text: 'Unhealthy for Sensitive Groups',
              color: AQI_COLORS.USG,
              emoji: '😷',
              description: 'May affect sensitive individuals',
            };
          }
          if (aqi <= 200) {
            return {
              text: 'Unhealthy',
              color: AQI_COLORS.UNHEALTHY,
              emoji: '😨',
              description: 'Everyone may experience health effects',
            };
          }
          if (aqi <= 300) {
            return {
              text: 'Very Unhealthy',
              color: AQI_COLORS.VERY_UNHEALTHY,
              emoji: '🤢',
              description: 'Health alert: everyone may be affected',
            };
          }
          return {
            text: 'Hazardous',
            color: AQI_COLORS.HAZARDOUS,
            emoji: '☠️',
            description: 'Health warnings of emergency conditions',
          };
        };

        const status = getAQIStatus(props.aqi);

        popup.current = new maptilersdk.Popup({ offset: 25 })
          .setLngLat(coordinates)
          .setHTML(
            `
          <div style="padding: 14px; min-width: 260px; background: linear-gradient(135deg, #1e3a5f 0%, #0a1929 100%); border-radius: 12px;">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 2px solid ${status.color};">
              <div style="font-size: 32px;">${status.emoji}</div>
              <div>
                <h3 style="margin: 0; font-size: 16px; color: white; font-weight: bold;">
                  ${props.name || 'AQI Station'}
                </h3>
                <p style="margin: 0; font-size: 11px; color: #94a3b8;">Air Quality Index</p>
              </div>
            </div>
            
            <div style="background: rgba(255,255,255,0.05); border-radius: 8px; padding: 12px, margin-bottom: 12px;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                <span style="color: #94a3b8; font-size: 13px;">AQI Value</span>
                <span style="font-size: 28px; font-weight: bold; color: ${status.color};">${props.aqi}</span>
              </div>
              <div style="height: 8px; background: rgba(0,0,0,0.2); border-radius: 4px; overflow: hidden;">
                <div style="height: 100%; width: ${Math.min((props.aqi / 500) * 100, 100)}%; background: ${status.color}; transition: width 0.3s;"></div>
              </div>
            </div>

            <div style="background: rgba(255,255,255,0.05); border-radius: 8px; padding: 10px, margin-bottom: 10px;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                <div style="width: 12px; height: 12px; background: ${status.color}; border-radius: 50%;"></div>
                <span style="color: ${status.color}; font-weight: bold; font-size: 14px;">${status.text}</span>
              </div>
              <p style="margin: 0; color: #cbd5e1; font-size: 12px; line-height: 1.5;">${status.description}</p>
            </div>

            <div style="color: #64748b; font-size: 11px; text-align: center;">
              📍 ${coordinates[1].toFixed(4)}°, ${coordinates[0].toFixed(4)}°<br/>
              🕐 ${props.last_updated || 'Real-time'}
            </div>
          </div>
        `
          )
          .addTo(map.current!);
      }
    );

    // Cyclone click - Enhanced popup
    map.current!.on(
      'click',
      'cyclones-layer',
      (e: maptilersdk.MapLayerMouseEvent) => {
        const feature = e.features![0];
        const geometry = feature.geometry as {
          type: string;
          coordinates: [number, number];
        };
        const coordinates = geometry.coordinates;
        const props = feature.properties;

        if (popup.current) {
          popup.current.remove();
        }

        const getCategoryColor = (category: number) => {
          const colors: Record<number, string> = {
            1: '#3498db',
            2: '#f39c12',
            3: '#e67e22',
            4: '#e74c3c',
            5: '#c0392b',
          };
          return colors[category] || '#95a5a6';
        };

        const getCategoryName = (category: number) => {
          const names: Record<number, string> = {
            1: 'Category 1',
            2: 'Category 2',
            3: 'Category 3',
            4: 'Category 4',
            5: 'Category 5',
          };
          return names[category] || 'Unknown';
        };

        const categoryColor = getCategoryColor(props.category);
        const categoryName = getCategoryName(props.category);

        popup.current = new maptilersdk.Popup({ offset: 25 })
          .setLngLat(coordinates)
          .setHTML(
            `
          <div style="padding: 16px; min-width: 280px; background: linear-gradient(135deg, #1e3a5f 0%, #0a1929 100%); border-radius: 14px; border: 2px solid ${categoryColor};">
            <!-- Header -->
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 14px; padding-bottom: 12px; border-bottom: 2px solid rgba(255,255,255,0.1);">
              <div style="font-size: 36px;">🌀</div>
              <div>
                <h3 style="margin: 0; font-size: 17px; color: white; font-weight: bold;">
                  ${props.name || 'Cyclone'}
                </h3>
                <p style="margin: 2px 0 0 0; font-size: 12px; color: #64748b;">Tropical Cyclone</p>
              </div>
            </div>

            <!-- Stats Grid -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px;">
              <div style="background: rgba(255,255,255,0.05); border-radius: 8px; padding: 10px, text-align: center;">
                <div style="font-size: 22px; font-weight: bold; color: ${categoryColor};">${props.wind_speed || 0}</div>
                <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">Wind Speed (km/h)</div>
              </div>
              <div style="background: rgba(255,255,255,0.05); border-radius: 8px; padding: 10px, text-align: center;">
                <div style="font-size: 22px; font-weight: bold; color: #9b59b6;">${props.pressure || 0}</div>
                <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">Pressure (mb)</div>
              </div>
            </div>

            <!-- Category Banner -->
            <div style="background: linear-gradient(90deg, ${categoryColor}20, ${categoryColor}40); border-left: 4px solid ${categoryColor}; border-radius: 8px; padding: 12px, margin-bottom: 12px;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                <span style="color: #cbd5e1; font-size: 12px; font-weight: 600;">INTENSITY</span>
                <span style="color: ${categoryColor}; font-size: 16px; font-weight: bold;">${categoryName}</span>
              </div>
              <p style="margin: 0; color: #e2e8f0; font-size: 11px; line-height: 1.5;">
                ${props.status || 'Active'}
              </p>
            </div>

            <!-- Position Info -->
            <div style="background: rgba(255,255,255,0.05); border-radius: 8px; padding: 12px, margin-bottom: 12px;">
              <div style="color: #cbd5e1; font-size: 12px; font-weight: 600; margin-bottom: 8px;">POSITION</div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                <div>
                  <div style="color: #94a3b8; font-size: 10px;">LATITUDE</div>
                  <div style="color: white; font-size: 14px; font-weight: 600; font-family: monospace;">${coordinates[1].toFixed(4)}°</div>
                </div>
                <div>
                  <div style="color: #94a3b8; font-size: 10px;">LONGITUDE</div>
                  <div style="color: white; font-size: 14px; font-weight: 600; font-family: monospace;">${coordinates[0].toFixed(4)}°</div>
                </div>
              </div>
            </div>

            <!-- Footer -->
            <div style="display: flex; align-items: center; justify-content: space-between; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.1);">
              <span style="color: #64748b; font-size: 10px;">🕐 ${props.last_updated ? new Date(props.last_updated).toLocaleTimeString() : 'Live'}</span>
              <span style="background: ${categoryColor}40; color: ${categoryColor}; padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: 600;">● ACTIVE</span>
            </div>
          </div>
        `
          )
          .addTo(map.current!);
      }
    );

    // Cyclone hover effect
    map.current!.on('mouseenter', 'cyclones-layer', () => {
      map.current!.getCanvas().style.cursor = 'pointer';
    });

    map.current!.on('mouseleave', 'cyclones-layer', () => {
      map.current!.getCanvas().style.cursor = '';
    });

    // Wave point analysis - Click anywhere on ocean to get wave conditions
    map.current!.on('click', (e: maptilersdk.MapMouseEvent) => {
      // Check if clicked on any existing feature
      const features = map.current!.queryRenderedFeatures(e.point);
      const clickedOnFeature = features.some((f) =>
        [
          'vessels-unclustered',
          'vessels-clusters',
          'aqi-circles',
          'waves-points',
          'cyclones-layer',
        ].includes(f.layer.id)
      );

      // If clicked on a feature, don't analyze the ocean
      if (clickedOnFeature) {
        return;
      }

      const { lng, lat } = e.lngLat;

      console.log(
        `[WAVE-POINT] Analyzing ocean at: ${lat.toFixed(4)}, ${lng.toFixed(4)}`
      );

      // Show loading popup
      if (popup.current) {
        popup.current.remove();
      }

      popup.current = new maptilersdk.Popup({ offset: 25, closeButton: true })
        .setLngLat([lng, lat])
        .setHTML(
          `
          <div style="padding: 16px; min-width: 260px; background: linear-gradient(135deg, #1e3a5f 0%, #0a1929 100%); border-radius: 14px; border: 2px solid #0077be;">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
              <div style="font-size: 32px;">🌊</div>
              <div>
                <h3 style="margin: 0; font-size: 16px; color: white; font-weight: bold;">Analyzing Ocean Conditions</h3>
                <p style="margin: 2px 0 0 0; font-size: 11px; color: #64748b;">Please wait...</p>
              </div>
            </div>
            <div style="text-align: center; padding: 20px;">
              <div style="display: inline-block; width: 40px; height: 40px; border: 4px solid #0077be; border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
            </div>
            <style>
              @keyframes spin {
                to { transform: rotate(360deg); }
              }
            </style>
          </div>
        `
        )
        .addTo(map.current!);

      // Fetch wave data from backend
      fetch(`${BACKEND_API_URL}/api/wave-point?lat=${lat}&lon=${lng}`)
        .then((res) => {
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
          }
          return res.json();
        })
        .then((data) => {
          console.log(`[WAVE-POINT] Received data:`, data);

          // Determine wave condition status and color
          const getWaveStatus = (height: number) => {
            if (height < 0.5) {
              return {
                text: 'Calm',
                color: '#2ecc71',
                emoji: '😌',
                description: 'Perfect for all water activities',
              };
            }
            if (height < 1.25) {
              return {
                text: 'Smooth',
                color: '#3498db',
                emoji: '😊',
                description: 'Ideal conditions for sailing',
              };
            }
            if (height < 2.5) {
              return {
                text: 'Slight',
                color: '#1abc9c',
                emoji: '🌊',
                description: 'Good for experienced sailors',
              };
            }
            if (height < 4.0) {
              return {
                text: 'Moderate',
                color: '#f39c12',
                emoji: '⚠️',
                description: 'Caution advised',
              };
            }
            if (height < 6.0) {
              return {
                text: 'Rough',
                color: '#e67e22',
                emoji: '😰',
                description: 'Challenging conditions',
              };
            }
            if (height < 9.0) {
              return {
                text: 'Very Rough',
                color: '#e74c3c',
                emoji: '🚨',
                description: 'Dangerous for small vessels',
              };
            }
            return {
              text: 'High',
              color: '#c0392b',
              emoji: '☠️',
              description: 'Extreme danger - avoid navigation',
            };
          };

          const waveHeight = data.wave_height || 0;
          const status = getWaveStatus(waveHeight);

          // Update popup with results
          if (popup.current) {
            popup.current.remove();
          }

          popup.current = new maptilersdk.Popup({
            offset: 25,
            closeButton: true,
          })
            .setLngLat([lng, lat])
            .setHTML(
              `
              <div style="padding: 16px; min-width: 300px; background: linear-gradient(135deg, #1e3a5f 0%, #0a1929 100%); border-radius: 14px; border: 2px solid ${status.color};">
                <!-- Header -->
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 14px; padding-bottom: 12px; border-bottom: 2px solid rgba(255,255,255,0.1);">
                  <div style="font-size: 36px;">${status.emoji}</div>
                  <div>
                    <h3 style="margin: 0; font-size: 17px; color: white; font-weight: bold;">Ocean Wave Analysis</h3>
                    <p style="margin: 2px 0 0 0; font-size: 12px; color: #64748b;">Real-time marine conditions</p>
                  </div>
                </div>

                <!-- Wave Height - Primary Metric -->
                <div style="background: linear-gradient(135deg, ${status.color}30, ${status.color}10); border-radius: 10px; padding: 16px; margin-bottom: 14px; border: 2px solid ${status.color}50;">
                  <div style="text-align: center;">
                    <div style="font-size: 48px; font-weight: bold; color: ${status.color}; line-height: 1;">${waveHeight.toFixed(2)}m</div>
                    <div style="font-size: 13px; color: #94a3b8; margin-top: 4px;">WAVE HEIGHT</div>
                    <div style="margin-top: 8px; padding: 6px 12px; background: ${status.color}; color: white; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 14px;">
                      ${status.text}
                    </div>
                  </div>
                </div>

                <!-- Additional Wave Metrics -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px;">
                  <div style="background: rgba(255,255,255,0.05); border-radius: 8px; padding: 12px; text-align: center;">
                    <div style="font-size: 20px; font-weight: bold; color: #3498db;">${data.wave_direction || 0}°</div>
                    <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">Direction</div>
                  </div>
                  <div style="background: rgba(255,255,255,0.05); border-radius: 8px; padding: 12px; text-align: center;">
                    <div style="font-size: 20px; font-weight: bold; color: #9b59b6;">${data.wave_period || 0}s</div>
                    <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">Period</div>
                  </div>
                </div>

                <!-- Swell Information -->
                <div style="background: rgba(255,255,255,0.05); border-radius: 8px; padding: 12px; margin-bottom: 12px;">
                  <div style="display: flex; align-items: center; justify-content: space-between;">
                    <span style="color: #94a3b8; font-size: 12px; font-weight: 600;">SWELL HEIGHT</span>
                    <span style="font-size: 18px; font-weight: bold; color: #1abc9c;">${(data.swell_wave_height || 0).toFixed(2)}m</span>
                  </div>
                </div>

                <!-- Condition Description -->
                <div style="background: linear-gradient(90deg, ${status.color}20, ${status.color}40); border-left: 4px solid ${status.color}; border-radius: 8px; padding: 12px; margin-bottom: 12px;">
                  <div style="color: #cbd5e1; font-size: 12px; font-weight: 600; margin-bottom: 4px;">CONDITIONS</div>
                  <p style="margin: 0; color: #e2e8f0; font-size: 13px; line-height: 1.5;">${status.description}</p>
                </div>

                <!-- Location Info -->
                <div style="background: rgba(255,255,255,0.05); border-radius: 8px; padding: 10px; margin-bottom: 10px;">
                  <div style="color: #cbd5e1; font-size: 11px; font-weight: 600; margin-bottom: 6px;">📍 LOCATION</div>
                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-family: monospace;">
                    <div>
                      <div style="color: #64748b; font-size: 9px;">LAT</div>
                      <div style="color: white; font-size: 12px;">${lat.toFixed(4)}°</div>
                    </div>
                    <div>
                      <div style="color: #64748b; font-size: 9px;">LON</div>
                      <div style="color: white; font-size: 12px;">${lng.toFixed(4)}°</div>
                    </div>
                  </div>
                </div>

                <!-- Footer -->
                <div style="display: flex; align-items: center; justify-content: space-between; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.1);">
                  <span style="color: #64748b; font-size: 10px;">🕐 ${new Date().toLocaleTimeString()}</span>
                  <span style="background: rgba(16,185,129,0.2); color: #10b981; padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: 600;">● LIVE DATA</span>
                </div>
              </div>
            `
            )
            .addTo(map.current!);

          console.log(
            `[WAVE-POINT] ${status.text} conditions (${waveHeight}m waves)`
          );
        })
        .catch((error) => {
          console.error('[WAVE-POINT] Fetch error:', error);

          // Show error popup
          if (popup.current) {
            popup.current.remove();
          }

          popup.current = new maptilersdk.Popup({
            offset: 25,
            closeButton: true,
          })
            .setLngLat([lng, lat])
            .setHTML(
              `
              <div style="padding: 16px; min-width: 260px; background: linear-gradient(135deg, #1e3a5f 0%, #0a1929 100%); border-radius: 14px; border: 2px solid #e74c3c;">
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                  <div style="font-size: 32px;">❌</div>
                  <div>
                    <h3 style="margin: 0; font-size: 16px; color: white; font-weight: bold;">Analysis Failed</h3>
                    <p style="margin: 2px 0 0 0; font-size: 11px; color: #64748b;">Could not fetch wave data</p>
                  </div>
                </div>
                <div style="background: rgba(231,76,60,0.1); border-left: 4px solid #e74c3c; border-radius: 8px; padding: 12px;">
                  <p style="margin: 0; color: #e2e8f0; font-size: 12px; line-height: 1.5;">
                    Unable to retrieve wave conditions for this location. Please try again or check your connection.
                  </p>
                </div>
                <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.1);">
                  <div style="color: #64748b; font-size: 10px; font-family: monospace;">
                    📍 ${lat.toFixed(4)}°, ${lng.toFixed(4)}°
                  </div>
                </div>
              </div>
            `
            )
            .addTo(map.current!);
        });
    });
  }, [setHoveredFeature]);

  useEffect(() => {
    if (initialized.current || map.current) {
      return;
    }

    initialized.current = true;
    maptilersdk.config.apiKey = MAPTILER_KEY;

    console.log('[MAP] Initializing...');

    map.current = new maptilersdk.Map({
      container: mapContainer.current!,
      style: `https://api.maptiler.com/maps/hybrid/style.json?key=${MAPTILER_KEY}`,
      center: [30.0, 30.0],
      zoom: 3,
      attributionControl: false,
    });

    map.current.addControl(
      new maptilersdk.ScaleControl({ unit: 'metric' }),
      'bottom-right'
    );
    map.current.addControl(new maptilersdk.FullscreenControl(), 'top-right');

    map.current.on('load', () => {
      console.log('[MAP] Loaded, initializing layers...');
      initializeLayers();
      setupInteractions();
      setMapLoaded(true);

      // Set initial center
      setMapCenter(map.current!.getCenter());

      // Initial data fetch after map loads
      setTimeout(() => {
        console.log('[MAP] Fetching initial data...');
        void updateDataFromBackend();
      }, 500);

      // Debounced updates on map movement
      const handleMapMove = () => {
        if (fetchTimeoutRef.current) {
          clearTimeout(fetchTimeoutRef.current);
        }
        fetchTimeoutRef.current = setTimeout(() => {
          const currentActiveLayers = activeLayersRef.current;
          if (
            currentActiveLayers.includes('vessels') ||
            currentActiveLayers.includes('aqi') ||
            currentActiveLayers.includes('waves')
          ) {
            console.log('[MAP] Map moved, refreshing data...');
            updateDataFromBackend();
          }
        }, 800);
      };

      map.current!.on('moveend', handleMapMove);
      map.current!.on('zoomend', handleMapMove);

      setMapLoaded(true);
    });

    // Update center on map move
    map.current.on('move', () => {
      if (map.current) {
        setMapCenter(map.current.getCenter());
      }
    });

    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
      if (map.current) {
        map.current.remove();
      }
    };
  }, [updateDataFromBackend, initializeLayers, setupInteractions]);

  const handleLayerToggle = (layerId: string): void => {
    if (!map.current) {
      return;
    }

    console.log(`[LAYER] Toggle: ${layerId}`);

    if (layerId === 'satellite') {
      setActiveLayers((prev) => {
        const newActiveLayers = prev.includes(layerId)
          ? prev
          : [...prev, layerId];
        activeLayersRef.current = newActiveLayers;
        return newActiveLayers;
      });
      return;
    }

    const layerMap: Record<string, string[]> = {
      vessels: [
        'vessels-clusters',
        'vessels-cluster-count',
        'vessels-unclustered',
        'vessels-direction',
      ],
      aqi: ['aqi-circles', 'aqi-labels'],
      waves: ['waves-heatmap', 'waves-points', 'waves-labels'],
      cyclones: ['cyclones-layer', 'cyclones-labels', 'cyclone-tracks-layer'], // ADD THIS LINE
      wind: ['wind-layer'],
      precipitation: ['precipitation-layer'],
      temperature: ['temperature-layer'],
      pressure: ['pressure-layer'],
      humidity: ['humidity-layer'],
      radar: ['radar-layer'],
    };

    const layers = layerMap[layerId];
    if (!layers) {
      return;
    }

    const currentlyActive = activeLayers.includes(layerId);

    setActiveLayers((prev) => {
      const isActive = prev.includes(layerId);
      const newVisibility = isActive ? 'none' : 'visible';

      layers.forEach((layer) => {
        try {
          if (map.current && map.current.getLayer(layer)) {
            map.current.setLayoutProperty(
              layer,
              'visibility',
              newVisibility as 'visible' | 'none'
            );
            console.log(`[LAYER] ${layer}: ${newVisibility}`);
          }
        } catch (error) {
          console.error(`[LAYER] Toggle error (${layer}):`, error);
        }
      });

      const newActiveLayers = isActive
        ? prev.filter((id) => id !== layerId)
        : [...prev, layerId];
      activeLayersRef.current = newActiveLayers;
      return newActiveLayers;
    });

    // Fetch data immediately when layer is enabled
    if (
      !currentlyActive &&
      (layerId === 'vessels' || layerId === 'aqi' || layerId === 'waves')
    ) {
      console.log(`[LAYER] ${layerId} enabled - fetching data...`);
      setTimeout(() => {
        void updateDataFromBackend();
      }, 150);
    }

    // NEW: Load cyclones on-demand when the user turns the cyclones layer ON
    if (!currentlyActive && layerId === 'cyclones') {
      const bounds = map.current.getBounds();
      if (!bounds) {
        return;
      }
      const minLat = bounds.getSouth();
      const minLon = bounds.getWest();
      const maxLat = bounds.getNorth();
      const maxLon = bounds.getEast();

      void (async () => {
        const cyclones = await fetchCyclonesFromBackend(
          minLat,
          minLon,
          maxLat,
          maxLon
        );
        if (cyclones && map.current) {
          const src = map.current.getSource('cyclones') as
            | maptilersdk.GeoJSONSource
            | undefined;
          if (src && typeof src.setData === 'function') {
            src.setData(cyclones);
            console.log(
              `🌀 Cyclones source updated with ${cyclones.features.length} features`
            );
          }
        }
      })();
    }
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100vh',
        position: 'relative',
        background: '#0a1929',
      }}
    >
      <div
        ref={mapContainer}
        style={{ width: '100%', height: '100%' }}
      />

      {mapLoaded && (
        <>
          <Sidebar
            onLayerToggle={handleLayerToggle}
            activeLayers={activeLayers}
          />
          <Timeline
            onTimeChange={(time: Date | number) =>
              console.log('[TIMELINE] Time changed:', time)
            }
          />
          <InfoPanel
            data={hoveredFeature}
            position={mapCenter}
          />
        </>
      )}
    </div>
  );
};

export default Map;
