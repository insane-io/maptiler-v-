/**
 * Core GeoJSON Types for Map Features
 */
export interface GeoJSONPoint {
  type: 'Point';
  coordinates: [number, number];
}

export interface GeoJSONLineString {
  type: 'LineString';
  coordinates: [number, number][];
}

export interface GeoJSONPolygon {
  type: 'Polygon';
  coordinates: [number, number][][];
}

export type GeoJSONGeometry = GeoJSONPoint | GeoJSONLineString | GeoJSONPolygon;

export interface GeoJSONProperties {
  [key: string]: string | number | boolean | null;
}

export interface GeoJSONFeature<G extends GeoJSONGeometry = GeoJSONGeometry> {
  type: 'Feature';
  geometry: G;
  properties: GeoJSONProperties;
}

export interface GeoJSONFeatureCollection<
  G extends GeoJSONGeometry = GeoJSONGeometry,
> {
  type: 'FeatureCollection';
  features: GeoJSONFeature<G>[];
}

/**
 * Vessel Types
 */
export interface VesselProperties extends GeoJSONProperties {
  vessel_name: string;
  type: 'Container Ship' | 'Tanker' | 'Cargo Ship' | string;
  speed: number;
  course: number;
  destination: string;
  eta: string;
  flag: string;
}

export interface VesselFeature extends GeoJSONFeature<GeoJSONPoint> {
  properties: VesselProperties;
}

export interface VesselData extends GeoJSONFeatureCollection<GeoJSONPoint> {
  features: VesselFeature[];
}

/**
 * Cyclone Types
 */
export interface CycloneProperties extends GeoJSONProperties {
  name: string;
  category: number;
  wind_speed: number;
  pressure: number;
  movement: string;
  intensity: string;
}

export interface CycloneFeature extends GeoJSONFeature<GeoJSONPoint> {
  properties: CycloneProperties;
}

export interface CycloneData extends GeoJSONFeatureCollection<GeoJSONPoint> {
  features: CycloneFeature[];
}

/**
 * Cyclone Track Types
 */
export interface CycloneTrackProperties extends GeoJSONProperties {
  track_type: 'historical' | 'forecast';
}

export interface CycloneTrackFeature extends GeoJSONFeature<GeoJSONLineString> {
  properties: CycloneTrackProperties;
}

export interface CycloneTrackData extends GeoJSONFeatureCollection<GeoJSONLineString> {
  features: CycloneTrackFeature[];
}

/**
 * Wave Types
 */
export interface WaveProperties extends GeoJSONProperties {
  wave_height: number;
}

export interface WaveFeature extends GeoJSONFeature<GeoJSONPoint> {
  properties: WaveProperties;
}

export interface WaveData extends GeoJSONFeatureCollection<GeoJSONPoint> {
  features: WaveFeature[];
}

/**
 * AQI Types
 */
export interface AQIProperties extends GeoJSONProperties {
  city: string;
  aqi: number;
  pm25: number;
  category: string;
}

export interface AQIFeature extends GeoJSONFeature<GeoJSONPoint> {
  properties: AQIProperties;
}

export interface AQIData extends GeoJSONFeatureCollection<GeoJSONPoint> {
  features: AQIFeature[];
}

/**
 * Layer Configuration
 */
export interface LayerSection {
  id: string;
  title: string;
  layers: LayerItem[];
}

export interface LayerItem {
  id: string;
  name: string;
}

/**
 * Map State
 */
export interface HoveredFeature {
  [key: string]: string | number | boolean | null;
}

export interface MapPosition {
  lng?: number;
  lat?: number;
  zoom?: number;
}

/**
 * API Response Types
 */
export interface WeatherApiResponse {
  status: string;
  data: Record<string, unknown>;
}

export interface AQIApiResponse {
  status: string;
  data: {
    aqi: number;
    city: string;
    [key: string]: unknown;
  };
}

/**
 * Constants Types
 */
export interface AQIColorScheme {
  GOOD: string;
  MODERATE: string;
  USG: string;
  UNHEALTHY: string;
  VERY_UNHEALTHY: string;
  HAZARDOUS: string;
}

export interface WaveColorScheme {
  LOW: string;
  MEDIUM: string;
  HIGH: string;
  EXTREME: string;
}

export interface CycloneCategory {
  name: string;
  color: string;
}

export interface CycloneCategoryMap {
  TD: CycloneCategory;
  TS: CycloneCategory;
  C1: CycloneCategory;
  C2: CycloneCategory;
  C3: CycloneCategory;
  C4: CycloneCategory;
  C5: CycloneCategory;
}

export interface RefreshIntervals {
  VESSELS: number;
  CYCLONES: number;
  WAVES: number;
  AQI: number;
}

export interface MapConfig {
  defaultCenter: [number, number];
  defaultZoom: number;
  maxZoom: number;
  minZoom: number;
}
