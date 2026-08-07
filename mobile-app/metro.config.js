const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Ensure TypeScript & CommonJS extensions are resolved cleanly by Metro
config.resolver.sourceExts = Array.from(new Set([...(config.resolver.sourceExts || []), 'ts', 'tsx', 'cjs']));

module.exports = config;
