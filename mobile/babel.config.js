/**
 * JID Mobile — Babel config.
 *
 * `babel-preset-expo` already wires react-native-worklets (required by
 * Reanimated 4) for SDK 57, so the Reanimated/worklets plugin must NOT be
 * added manually here — doing so double-transforms animated values.
 */
module.exports = function babelConfig(api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'react' }]],
  };
};
