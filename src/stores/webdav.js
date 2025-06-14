import { createClient } from 'webdav'
import { defineStore } from 'pinia'

export const useWebDAVStore = defineStore('webdav', {
  state: () => {
    // 尝试从localStorage加载保存的配置
    const savedConfig = JSON.parse(localStorage.getItem('webdav_config') || '{}')
    return {
      client: null,
      isConnected: false,
      serverUrl: savedConfig.serverUrl || '',
      username: savedConfig.username || '',
      password: savedConfig.password || '',
      basePath: '/obsidian', // 限制基础路径
      currentPath: '/obsidian',
      files: [],
    }
  },

  actions: {
    async connect(serverUrl, username, password) {
      try {
        this.client = createClient(serverUrl, {
          username,
          password,
        })
        this.serverUrl = serverUrl
        this.username = username
        this.password = password
        this.isConnected = true

        // 保存配置到localStorage
        localStorage.setItem(
          'webdav_config',
          JSON.stringify({
            serverUrl,
            username,
            password,
            basePath: this.basePath,
          }),
        )

        await this.getDirectoryContents(this.basePath)
        return true
      } catch (error) {
        console.error('WebDAV连接失败:', error)
        this.reset()
        return false
      }
    },

    async ensureConnected() {
      if (!this.isConnected && this.serverUrl) {
        console.log('尝试自动连接到WebDAV服务器...')
        try {
          await this.connect(this.serverUrl, this.username, this.password)
          return true
        } catch (error) {
          console.error('自动连接失败:', error)
          return false
        }
      }
      return this.isConnected
    },

    async getDirectoryContents(path = this.basePath) {
      if (!(await this.ensureConnected())) {
        console.warn('无法获取目录内容: 未连接到WebDAV服务器')
        return
      }

      // 规范化路径
      let fullPath = path
      if (!path.startsWith('/')) {
        fullPath = `/${path}`
      }

      console.log('Getting directory contents for:', fullPath)

      try {
        const contents = await this.client.getDirectoryContents(fullPath)
        this.files = contents.filter((item) => item.basename !== '.DS_Store')
        this.currentPath = fullPath
        console.log('Updated currentPath to:', this.currentPath)
        console.log('Found files:', this.files.length)
        return this.files
      } catch (error) {
        console.error('获取目录内容失败:', error)
        throw error
      }
    },

    async readFile(filePath) {
      if (!this.isConnected || !this.client) {
        throw new Error('WebDAV客户端未连接')
      }

      // 确保路径以basePath开头
      const normalizedPath = filePath.startsWith(this.basePath)
        ? filePath
        : `${this.basePath}/${filePath.replace(/^\//, '')}`

      try {
        // 兼容不同版本的webdav客户端
        const content = await (this.client.getFileContents || this.client.getFileContentsStream)(
          normalizedPath,
          { format: 'text' },
        )
        return content
      } catch (error) {
        console.error(`读取文件失败(${normalizedPath}):`, error)
        throw error
      }
    },

    async writeFile(filePath, content) {
      if (!this.isConnected || !this.client) {
        throw new Error('WebDAV客户端未连接')
      }

      // 确保路径以basePath开头
      const normalizedPath = filePath.startsWith(this.basePath)
        ? filePath
        : `${this.basePath}/${filePath.replace(/^\//, '')}`

      try {
        // 兼容不同版本的webdav客户端
        await (this.client.putFileContents || this.client.putFileContentsStream)(
          normalizedPath,
          content,
        )
        return true
      } catch (error) {
        console.error(`写入文件失败(${normalizedPath}):`, error)
        throw error
      }
    },

    reset() {
      this.client = null
      this.isConnected = false
      this.serverUrl = ''
      this.username = ''
      this.password = ''
      this.currentPath = '/'
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
