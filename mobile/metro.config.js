const path = require('path')
const { getDefaultConfig } = require('expo/metro-config')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '..')
const config = getDefaultConfig(projectRoot)

config.watchFolders = [workspaceRoot]
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
]

// Security pin for GHSA-qr28-fpjm-wq7f: package.json overrides query-string's decode-uri-component to 0.5.1.
// Router's query-string 7 expects a callable CommonJS export, and the fixed decoder is ESM, so alias it here.
// Keep the override and this alias together. Jest or Node consumers of query-string would need the same alias.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'decode-uri-component' && context.originModulePath.includes(`${path.sep}query-string${path.sep}`)) {
    return { type: 'sourceFile', filePath: path.join(projectRoot, 'shims', 'queryStringDecoder.js') }
  }
  return context.resolveRequest(context, moduleName, platform)
}

module.exports = config
