import { fileURLToPath, URL } from 'node:url'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import { VitePWA } from 'vite-plugin-pwa'

// 读取 package.json 版本
const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'))

// https://vite.dev/config/
export default defineConfig({
  base: './', // 使用相对路径
  plugins: [
    vue(),
    vueDevTools(),
    VitePWA({
      registerType: 'prompt',          // prompt 模式，不自动更新
      injectRegister: 'auto',          // 自动注入 SW 注册代码
      strategies: 'injectManifest',    // 使用自定义 SW
      srcDir: 'src',
      filename: 'sw.js',
      injectManifest: {
        injectionPoint: undefined,     // 禁用默认注入点，手动控制
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
      },
      manifest: {
        name: 'Obsidian Notes',
        short_name: 'Obsidian Notes',
        description: 'Obsidian-like Notes Editor',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        scope: './',
        start_url: './',
        icons: [],
      },
    }),
    // 替换 index.html 中的版本占位符 + 生成 version.json
    {
      name: 'version-plugin',
      closeBundle() {
        const outDir = path.resolve(import.meta.dirname, 'dist')
        // 替换 index.html 占位符
        const htmlPath = path.join(outDir, 'index.html')
        let html = readFileSync(htmlPath, 'utf-8')
        html = html.replace(/%__APP_VERSION__%/g, pkg.version)
        writeFileSync(htmlPath, html)
        // 生成 version.json
        const versionContent = JSON.stringify({
          version: pkg.version,
          buildTime: new Date().toISOString(),
        })
        writeFileSync(path.join(outDir, 'version.json'), versionContent)
        console.log(`[version] v${pkg.version} -> ${outDir}`)
      },
    },
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    assetsDir: 'assets',
    emptyOutDir: true,
  },
  define: {
    __APP_BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
})
