const { getSentryExpoConfig } = require('@sentry/react-native/metro');

// Expo 55 detects the monorepo automatically. Sentry extends that default
// configuration so production bundles include the identifiers needed to map
// minified errors back to their original source code.
module.exports = getSentryExpoConfig(__dirname, {
  includeWebReplay: false,
});
