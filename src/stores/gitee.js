import { configure, fs } from '@zenfs/core'
import { Gitee } from 'zen-fs-gitee'
import { defineStore } from 'pinia'

const MOUNT_POINT = '/repo'

export const useGiteeStore = defineStore('gitee', {
  state: () => {
    const savedConfig = JSON.parse(localStorage.getItem('gitee_config') || '{}')
    return {
      isConnected: false,
      token: savedConfig.token || '',
      owner: savedConfig.owner || '',
      repo: savedConfig.repo || '',
      branch: savedConfig.branch || 'master',
      basePath: MOUNT_POINT,
      currentPath: MOUNT_POINT,
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

        await configure({
          mounts: {
            [MOUNT_POINT]: {
              backend: Gitee,
              token,
              owner,
              repo,
              branch,
            },
          },
        })

        this.isConnected = true

        localStorage.setItem(
          'gitee_config',
          JSON.stringify({ token, owner, repo, branch })
        )

        await this.getDirectoryContents(MOUNT_POINT)
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
        const entries = fs.readdirSync(normalizedPath)
        this.files = entries
          .map((name) => {
            const fullPath = normalizedPath === '/' ? `/${name}` : `${normalizedPath}/${name}`
            const stat = fs.statSync(fullPath)
            return {
              basename: name,
              filename: fullPath,
              type: stat.isDirectory() ? 'directory' : 'file',
              lastmod: new Date(stat.mtimeMs).toISOString(),
              size: stat.size,
            }
          })
          .filter((item) => item.basename !== '.DS_Store')

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
        const data = fs.readFileSync(normalizedPath)
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
        const encoder = new TextEncoder()
        fs.writeFileSync(normalizedPath, encoder.encode(content))
        return true
      } catch (error) {
        console.error(`写入文件失败(${normalizedPath}):`, error)
        throw error
      }
    },

    reset() {
      this.isConnected = false
      this.token = ''
      this.owner = ''
      this.repo = ''
      this.branch = 'master'
      this.currentPath = MOUNT_POINT
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