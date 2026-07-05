// Metro config: resolve the aliases into the vendored shared logic (see scripts/sync-shared.js).
// The vendored code lives inside the project root, so no watchFolders/cross-folder crawling is
// needed — Metro indexes it like any other in-project file.
const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')
const fs = require('fs')

const projectRoot = __dirname
const config = getDefaultConfig(projectRoot)

const aliases = {
  '@shared': path.resolve(projectRoot, 'vendor', 'shared'),
  '@lib': path.resolve(projectRoot, 'vendor', 'src', 'lib'),
  '@content': path.resolve(projectRoot, 'assets', 'content.json'),
}

function resolveOnDisk(base) {
  const candidates = [
    base,
    base + '.ts',
    base + '.tsx',
    base + '.js',
    base + '.jsx',
    base + '.json',
    path.join(base, 'index.ts'),
    path.join(base, 'index.tsx'),
    path.join(base, 'index.js'),
  ]
  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c
  }
  return null
}

config.resolver.resolveRequest = (context, moduleName, platform) => {
  for (const [alias, target] of Object.entries(aliases)) {
    if (moduleName === alias || moduleName.startsWith(alias + '/')) {
      const sub = moduleName.slice(alias.length).replace(/^\//, '')
      const filePath = resolveOnDisk(sub ? path.join(target, sub) : target)
      if (filePath) return { type: 'sourceFile', filePath }
    }
  }
  return context.resolveRequest(context, moduleName, platform)
}

module.exports = config
