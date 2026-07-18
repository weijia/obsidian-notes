// 版本信息 - 从 package.json 读取，构建时注入构建时间和 commit
const pkgVersion = '1.4.0'

export const VERSION = import.meta.env.VITE_APP_VERSION || pkgVersion
export const BUILD_TIME = import.meta.env.VITE_APP_BUILD_TIME || ''
export const COMMIT_SHA = import.meta.env.VITE_APP_COMMIT_SHA || ''

export const versionDisplay = COMMIT_SHA ? `${VERSION} (${COMMIT_SHA})` : VERSION
export const buildTimeDisplay = BUILD_TIME ? new Date(BUILD_TIME).toLocaleString('zh-CN') : ''