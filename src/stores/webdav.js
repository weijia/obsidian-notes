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
      currentPath: '/',
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
          }),
        )

        await this.getDirectoryContents('/')
        return true
      } catch (error) {
        console.error('WebDAV连接失败:', error)
        this.reset()
        return false
      }
    },

    async getDirectoryContents(path = '/') {
      if (!this.isConnected) return

      try {
        const contents = await this.client.getDirectoryContents(path)
        this.files = contents.filter((item) => item.basename !== '.DS_Store')
        this.currentPath = path
        return this.files
      } catch (error) {
        console.error('获取目录内容失败:', error)
        throw error
      }
    },

    async readFile(filePath) {
      if (!this.isConnected) return

      try {
        const content = await this.client.getFileContents(filePath, { format: 'text' })
        return content
      } catch (error) {
        console.error('读取文件失败:', error)
        throw error
      }
    },

    async writeFile(filePath, content) {
      if (!this.isConnected) return

      try {
        await this.client.putFileContents(filePath, content)
        return true
      } catch (error) {
        console.error('写入文件失败:', error)
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
