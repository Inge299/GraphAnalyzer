#!/bin/sh
set -eu

json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

config_file=/usr/share/nginx/html/runtime-config.js
{
  printf 'window.__NODEX_RUNTIME_CONFIG__ = Object.freeze({\n'
  printf "  mapMode: '%s',\n" "$(json_escape "${MAP_MODE:-online}")"
  printf "  pmtilesUrl: '%s',\n" "$(json_escape "${MAP_PMTILES_URL:-}")"
  printf "  mapStyleUrl: '%s',\n" "$(json_escape "${MAP_STYLE_URL:-}")"
  printf "  mapGlyphsUrl: '%s',\n" "$(json_escape "${MAP_GLYPHS_URL:-}")"
  printf '});\n'
} > "$config_file"
