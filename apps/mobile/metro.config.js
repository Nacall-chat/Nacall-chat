// Metro do app. O app compartilha com o site só módulos de TypeScript puro de ../../src/lib
// (hoje: validation e auth-schema), por isso o Metro também observa essa pasta.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

config.watchFolders = [...(config.watchFolders ?? []), path.resolve(__dirname, '../../src/lib')];
config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')];

// Os módulos compartilhados importam `zod`: sempre resolve a partir do app, para ter uma só cópia
// e funcionar também na CI, onde só o apps/mobile instala dependências.
const resolveFromApp = (context, moduleName, platform) =>
  context.resolveRequest({ ...context, originModulePath: path.join(__dirname, 'package.json') }, moduleName, platform);
const upstream = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'zod' || moduleName.startsWith('zod/')) return resolveFromApp({ ...context, resolveRequest: upstream ?? context.resolveRequest }, moduleName, platform);
  return (upstream ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
