// metro.config.js
const { getDefaultConfig } = require("expo/metro-config");
const path = require('path');
const { FileStore } = require('metro-cache');

const config = getDefaultConfig(__dirname);

// Enable require.context for Expo Router file-based routing
config.transformer = {
  ...config.transformer,
  unstable_allowRequireContext: true,
};

// Use a stable on-disk store (shared across web/android)
const root = process.env.METRO_CACHE_ROOT || path.join(__dirname, '.metro-cache');
config.cacheStores = [
  new FileStore({ root: path.join(root, 'cache') }),
];

// Reduce the number of workers to decrease resource usage
config.maxWorkers = 2;

// Exclude unnecessary directories from file watching to avoid ENOSPC
config.watcher = {
  ...config.watcher,
  additionalExts: [],
};

// Only block truly unnecessary directories that cause ENOSPC in dev
// NOTE: Keep this minimal - aggressive patterns break EAS production builds
config.resolver.blockList = [
  /\.git\/.*/,
  /node_modules\/hermes-engine\/.*/,
  /node_modules\/metro-symbolicate\/.*/,
];

module.exports = config;
