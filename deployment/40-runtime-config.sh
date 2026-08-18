#!/bin/sh
set -eu

json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

config_file=/usr/share/nginx/html/runtime-config.js
nginx_config=/etc/nginx/conf.d/default.conf
pmtiles_upstream="${MAP_PMTILES_URL:-}"
pmtiles_runtime_url="$pmtiles_upstream"

# Fetch the archive through the Nodex frontend.  This avoids depending on
# CORS response-header exposure on the separate internal map server.
if [ -n "$pmtiles_upstream" ]; then
  pmtiles_runtime_url='/_nodex/pmtiles'
else
  pmtiles_upstream='http://127.0.0.1:9/pmtiles-unconfigured'
fi
escaped_pmtiles_upstream=$(printf '%s' "$pmtiles_upstream" | sed 's/[\\&|]/\\&/g')
sed -i "s|__NODEX_PMTILES_UPSTREAM__|$escaped_pmtiles_upstream|g" "$nginx_config"

{
  printf 'window.__NODEX_RUNTIME_CONFIG__ = Object.freeze({\n'
  printf "  mapMode: '%s',\n" "$(json_escape "${MAP_MODE:-online}")"
  printf "  pmtilesUrl: '%s',\n" "$(json_escape "$pmtiles_runtime_url")"
  printf "  mapStyleUrl: '%s',\n" "$(json_escape "${MAP_STYLE_URL:-}")"
  printf "  mapGlyphsUrl: '%s',\n" "$(json_escape "${MAP_GLYPHS_URL:-}")"
  printf '});\n'
} > "$config_file"
