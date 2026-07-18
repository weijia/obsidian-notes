import { defineStore } from 'pinia'
import { useWebDAVStore } from './webdav'
import { useGiteeStore } from './gitee'

/**
 * 统一存储门面 - 代理到 WebDAV 或 Gitee store
 * 对外暴露与原 webdav store 完全一致的接口，上层组件无需关心后端类型
 */
export const useStorageStore = defineStore('storage', {
  state: () => {
    const saved = JSON.parse(localStorage.getItem('storageType') || '"webdav"')
    return {
      storageType: saved, // 'webdav' | 'gitee'
    }
  },

  actions: {
    setStorageType(type) {
      this.storageType = type
      localStorage.setItem('storageType', JSON.stringify(type))
    },

    async connect(...args) {
      if (this.storageType === 'gitee') {
        const giteeStore = useGiteeStore()
        return giteeStore.connect(...args)
      }
      const webdavStore = useWebDAVStore()
      return webdavStore.connect(...args)
    },

    async ensureConnected() {
      if (this.storageType === 'gitee') {
        const giteeStore = useGiteeStore()
        return giteeStore.ensureConnected()
      }
      const webdavStore = useWebDAVStore()
      return webdavStore.ensureConnected()
    },

    async getDirectoryContents(path) {
      if (this.storageType === 'gitee') {
        const giteeStore = useGiteeStore()
        return giteeStore.getDirectoryContents(path)
      }
      const webdavStore = useWebDAVStore()
      return webdavStore.getDirectoryContents(path)
    },

    async readFile(filePath) {
      if (this.storageType === 'gitee') {
        const giteeStore = useGiteeStore()
        return giteeStore.readFile(filePath)
      }
      const webdavStore = useWebDAVStore()
      return webdavStore.readFile(filePath)
    },

    async writeFile(filePath, content) {
      if (this.storageType === 'gitee') {
        const giteeStore = useGiteeStore()
        return giteeStore.writeFile(filePath, content)
      }
      const webdavStore = useWebDAVStore()
      return webdavStore.writeFile(filePath, content)
    },

    async testConnection() {
      if (this.storageType === 'gitee') {
        const giteeStore = useGiteeStore()
        return giteeStore.isConnected
      }
      const webdavStore = useWebDAVStore()
      return webdavStore.isConnected
    },
  },

  getters: {
    /**
     * 返回当前激活的后端 store (webdav 或 gitee)
     * 供需要直接读取 state 的组件使用 (如 files, currentPath 等)
     */
    backend() {
      if (this.storageType === 'gitee') {
        return useGiteeStore()
      }
      return useWebDAVStore()
    },
    isConnected: (state) => {
      if (state.storageType === 'gitee') {
        return useGiteeStore().isConnected
      }
      return useWebDAVStore().isConnected
    },
  },
})