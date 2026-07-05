// Aliases (@shared, @lib, @content) are resolved in metro.config.js, not here — module-resolver
// rewrites to relative paths using the worker cwd, which is unreliable under Metro's transform
// workers. This just applies the Expo preset.
module.exports = function (api) {
  api.cache(true)
  return {
    presets: ['babel-preset-expo'],
  }
}
