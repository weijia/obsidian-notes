import { GiteeFS } from 'zen-fs-gitee'
import { CachedFileSystem, IdbCacheStore } from 'zen-fs-cache'
import { GiteeCacheAdapter } from '@/utils/giteeCacheAdapter'
import { defineStore } from 'pinia'

/**
 * 缓存 key 前缀，按 仓库隔离。
 * 格式: gitee:{owner}/{repo}:{branch}:
 */
function cachePrefix(owner, repo, branch) {
  return `gitee:${owner}/${repo}:${branch}:`
}

export const useGiteeStore = defineStore('gitee', {
  state: () => {
    const savedConfig = JSON.parse(localStorage.getItem('gitee_config') || '{}')
    return {
      isConnected: false,
      token: savedConfig.token || '',
      owner: savedConfig.owner || '',
      repo: savedConfig.repo || '',
      branch: savedConfig.branch || 'master',
      basePath: '/',
      currentPath: '/',
      files: [],
    }
  },

  actions: {
    async connect(token, owner, repo, branch = 'master') {
      try {
        this.token = token
        this.owner = owner
        this.repo = repo
        this.branch = branch

        // 1. 创建 GiteeFS 实例（不通过 configure，直接实例化）
        const giteeFs = new GiteeFS({ token, owner, repo, branch })
        await giteeFs.init()

        // 2. 用适配器包装为 CacheableFileSystem
        const adapter = new GiteeCacheAdapter(giteeFs)

        // 3. 用 IdbCacheStore（IndexedDB 持久化缓存）+ CachedFileSystem 包装
        const cacheStore = new IdbCacheStore(cachePrefix(owner, repo, branch))
        this._cachedFs = new CachedFileSystem(adapter, cacheStore, {
          ttlMs: 2 * 60 * 1000, // 2 分钟内直接读缓存，不请求网络
        })

        // 保存底层引用
        this._adapter = adapter
        this._giteeFs = giteeFs

        this.isConnected = true

        localStorage.setItem(
          'gitee_config',
          JSON.stringify({ token, owner, repo, branch })
        )

        await this.getDirectoryContents(this.basePath)
        return true
      } catch (error) {
        console.error('Gitee 连接失败:', error)
        this.reset()
        return false
      }
    },

    async ensureConnected() {
      if (!this.isConnected && this.token && this.owner && this.repo) {
        console.log('尝试自动连接到 Gitee...')
        try {
          await this.connect(this.token, this.owner, this.repo, this.branch)
          return true
        } catch (error) {
          console.error('Gitee 自动连接失败:', error)
          return false
        }
      }
      return this.isConnected
    },

    async getDirectoryContents(path = this.basePath) {
      if (!(await this.ensureConnected())) {
        console.warn('无法获取目录内容: 未连接到 Gitee')
        return
      }

      const normalizedPath = path.startsWith('/') ? path : `/${path}`

      try {
        // 通过 CachedFileSystem 读取目录（自动缓存）
        const entries = await this._cachedFs.readdir(normalizedPath)

        // 对每个条目获取 stat（也会被缓存）
        const fileItems = []
        for (const name of entries) {
          const fullPath = normalizedPath === '/' ? `/${name}` : `${normalizedPath}/${name}`
          try {
            const stat = await this._cachedFs.stat(fullPath)
            // 注意: 从缓存返回的 stat 是普通对象，没有 isDirectory() 方法
            // 需要用 mode 位运算判断
            const isDir = (stat.mode & 0o170000) === 0o040000
            fileItems.push({
              basename: name,
              filename: fullPath,
              path: fullPath,
              type: isDir ? 'directory' : 'file',
              lastmod: new Date(stat.mtimeMs).toISOString(),
              size: stat.size,
            })
          } catch (e) {
            console.warn(`stat 失败: ${fullPath}`, e)
          }
        }

        this.files = fileItems.filter((item) => item.basename !== '.DS_Store')
        this.currentPath = normalizedPath
        return this.files
      } catch (error) {
        console.error('获取目录内容失败:', error)
        throw error
      }
    },

    async readFile(filePath) {
      if (!this.isConnected) {
        throw new Error('Gitee 未连接')
      }

      const normalizedPath = filePath.startsWith('/') ? filePath : `/${filePath}`

      try {
        const data = await this._cachedFs.readFile(normalizedPath)
        return new TextDecoder().decode(data)
      } catch (error) {
        console.error(`读取文件失败(${normalizedPath}):`, error)
        throw error
      }
    },

    async writeFile(filePath, content) {
      if (!this.isConnected) {
        throw new Error('Gitee 未连接')
      }

      const normalizedPath = filePath.startsWith('/') ? filePath : `/${filePath}`

      try {
        await this._cachedFs.writeFile(normalizedPath, content)
        if (this._giteeFs?.sync) {
          await this._giteeFs.sync()
        }
        return true
      } catch (error) {
        console.error(`写入文件失败(${normalizedPath}):`, error)
        throw error
      }
    },

    async invalidatePath(...paths) {
      if (this._cachedFs) {
        await this._cachedFs.invalidate(...paths)
      }
    },

    async clearCache() {
      if (this._cachedFs && this._cachedFs.store) {
        await this._cachedFs.store.clear()
      }
    },

    reset() {
      this.isConnected = false
      this._cachedFs = null
      this._adapter = null
      this._giteeFs = null
      this.token = ''
      this.owner = ''
      this.repo = ''
      this.branch = 'master'
      this.currentPath = this.basePath
      this.files = []
    },
  },

  getters: {
    currentDirectory: (state) => {
      return state.files.filter((file) => file.type === 'directory')
    },
    currentFiles: (state) => {
      return state.files.filter((file) => file.type === 'file')
    },
  },
})