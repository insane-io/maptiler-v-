/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MAPTILER_KEY: string;
  readonly VITE_OPENWEATHER_KEY: string;
  readonly VITE_WAQI_TOKEN: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
