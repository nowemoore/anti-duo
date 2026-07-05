// Extends app.json. Only layers on a web `baseUrl` when EXPO_WEB_BASE_URL is set — the CI job sets it
// so the exported PWA is served from a sub-path (e.g. /anti-duo/app). Local `npm run web` and native
// builds leave it unset, so they keep serving from the root.
module.exports = ({ config }) => {
  const baseUrl = process.env.EXPO_WEB_BASE_URL
  if (!baseUrl) return config
  return {
    ...config,
    experiments: { ...(config.experiments || {}), baseUrl },
  }
}
