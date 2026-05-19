// 版本信息 - 构建时由 GitHub Actions 注入
export const VERSION = import.meta.env.VITE_APP_VERSION || 'dev'
export const BUILD_TIME = import.meta.env.VITE_APP_BUILD_TIME || new Date().toISOString()
export const COMMIT_SHA = import.meta.env.VITE_APP_COMMIT_SHA || 'unknown'

// 格式化显示
export const versionDisplay = VERSION !== 'dev' ? `${VERSION} (${COMMIT_SHA})` : 'dev'
export const buildTimeDisplay = BUILD_TIME ? new Date(BUILD_TIME).toLocaleString('zh-CN') : '-'
