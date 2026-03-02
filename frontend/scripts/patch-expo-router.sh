#!/bin/bash
# Patch expo-router's web context to use hardcoded app path
# This fixes web rendering when EXPO_ROUTER_APP_ROOT env var isn't available at transform time
CTX_FILE="node_modules/expo-router/_ctx.web.js"
if [ -f "$CTX_FILE" ]; then
  cat > "$CTX_FILE" << 'EOF'
export const ctx = require.context(
  "../../app",
  true,
  /^(?:\.\/)(?!(?:(?:(?:.*\+api)|(?:\+middleware)|(?:\+(html|native-intent))))\.[tj]sx?$).*(?:\.android|\.ios|\.native)?\.[tj]sx?$/,
  "sync"
);
EOF
  echo "Patched expo-router _ctx.web.js for web rendering"
fi
