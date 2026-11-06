// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
// The SQL migrations of drizzle/ are part of the bundle (see babel.config.js).
config.resolver.sourceExts.push('sql');

module.exports = config;
