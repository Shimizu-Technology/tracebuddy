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

// Router's query-string 7 expects a callable CommonJS export. The fixed decoder is ESM.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'decode-uri-component' && context.originModulePath.includes(`${path.sep}query-string${path.sep}`)) {
    return { type: 'sourceFile', filePath: path.join(projectRoot, 'shims', 'queryStringDecoder.js') }
  }
  return context.resolveRequest(context, moduleName, platform)
}

module.exports = config
