/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_WS_URL: string
  readonly VITE_APP_TITLE: string
  readonly VITE_PMTILES_URL?: string
  readonly VITE_MAP_STYLE_URL?: string
  readonly VITE_MAP_GLYPHS_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface Window {
  __NODEX_RUNTIME_CONFIG__?: {
    mapMode?: 'local' | 'online'
    pmtilesUrl?: string
    mapStyleUrl?: string
    mapGlyphsUrl?: string
  }
}
