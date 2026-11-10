// Adds the web base path when building for GitHub Pages (served at /workout-log/).
// Everything else lives in app.json; local development and the Android app are unchanged.
module.exports = ({ config }) => ({
  ...config,
  experiments: { ...config.experiments, baseUrl: process.env.EXPO_BASE_URL ?? '' },
});
