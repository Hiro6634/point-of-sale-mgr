import pkg from '../../package.json' with { type: 'json' }

const APP_VERSION =
  typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : pkg.version
const BUILD_COMMIT =
  typeof __BUILD_COMMIT__ !== 'undefined' ? __BUILD_COMMIT__ : null

export { APP_VERSION, BUILD_COMMIT }