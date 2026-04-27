#!/bin/sh
set -e

# Generate runtime config from environment variables
cat > /usr/share/nginx/html/config.js << EOF
window.__CQRCFG_ENV__ = '${UI_ENV:-}';
window.__CQRCFG_API_URL__ = '${UI_API_URL:-/api}';
window.__CQRCFG_AUTH_HEADER__ = '${UI_AUTH_HEADER:-}';
window.__CQRCFG_AUTH_PATTERN__ = '${UI_AUTH_PATTERN:-}';
EOF

exec "$@"
