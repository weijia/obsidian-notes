// 版本信息 - 从 package.json 读取，构建时注入
const pkgVersion = '1.4.0'

export const VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : pkgVersion
export const COMMIT_SHA = typeof __APP_COMMIT_SHA__ !== 'undefined' ? __APP_COMMIT_SHA__ : ''

// 构建时间从全局变量读取（vite define 注入），转东八区显示
const rawBuildTime = typeof __APP_BUILD_TIME__ !== 'undefined' ? __APP_BUILD_TIME__ : ''
export const BUILD_TIME = rawBuildTime

function formatCST(isoStr) {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  // 转东八区：UTC+8
  const utc = d.getTime() + d.getTimezoneOffset() * 60000
  const cst = new Date(utc + 8 * 3600000)
  const pad = (n) => String(n).padStart(2, '0')
  return `${cst.getFullYear()}-${pad(cst.getMonth() + 1)}-${pad(cst.getDate())} ${pad(cst.getHours())}:${pad(cst.getMinutes())}:${pad(cst.getSeconds())}`
}

export const versionDisplay = COMMIT_SHA ? `${VERSION}` : VERSION
export const buildTimeDisplay = formatCST(rawBuildTime)