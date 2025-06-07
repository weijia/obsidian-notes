<script setup>
import { ref, onMounted, computed, inject, nextTick } from 'vue'
import { useWebDAVStore } from '@/stores/webdav'

// 显式声明可能的注入依赖
const appContext = inject('appContext', null)

const props = defineProps({
  modelValue: String
})

const emit = defineEmits(['update:modelValue', 'update'])

const webdav = useWebDAVStore()
const isLoading = ref(false)
const error = ref(null)

const files = computed(() => {
  if (!webdav.isConnected) {
    console.log('Not connected to WebDAV')
    return []
  }

  const filteredFiles = webdav.files
    .filter(item => {
      const isMdFile = item.type === 'file' && item.basename.endsWith('.md')
      if (!isMdFile) {
        console.log('Skipping non-md file:', item.basename)
      }
      return true
      // return isMdFile
    })
    .map(item => ({
      name: item.basename,
      path: item.filename,
      type: item.type // 保留原始类型信息
    }))

  console.log('Filtered files:', filteredFiles)
  return filteredFiles
})

const loadFiles = async () => {
  try {
    isLoading.value = true
    error.value = null

    const config = JSON.parse(localStorage.getItem('webdavConfig'))
    if (!config) {
      error.value = 'WebDAV configuration not found. Please configure first.'
      return
    }

    if (!webdav.isConnected) {
      console.log('尝试自动连接到WebDAV...')
      try {
        const config = JSON.parse(localStorage.getItem('webdavConfig'))
        if (!config) {
          error.value = 'WebDAV configuration not found. Please configure first.'
          return
        }

        await webdav.connect(config.serverUrl, config.username, config.password)
        console.log('自动连接成功')
      } catch (err) {
        error.value = `自动连接失败: ${err.message}`
        console.error('WebDAV自动连接失败:', err)
        return
      }
    }

    await webdav.getDirectoryContents(config.directory)

    if (files.value.length > 0 && !props.modelValue) {
      emit('update:modelValue', files.value[0].path)
    }
  } catch (err) {
    error.value = `Failed to load files: ${err.message}`
    console.error(err)
  } finally {
    isLoading.value = false
  }
}

const handleItemClick = async (file) => {
  try {
    console.log('Handling item click:', file)
    isLoading.value = true
    error.value = null

    // 检查是否是目录
    const isDirectory = file.type === 'directory' ||
      (file.filename && file.filename.endsWith('/'))

    if (isDirectory) {
      console.log('Navigating to directory:', file.path || file.filename)
      await webdav.getDirectoryContents(file.path || file.filename)
      // 确保UI更新
      await nextTick()
      console.log('Directory navigation complete. New path:', webdav.currentPath)
    } else {
      console.log('Selecting file:', file.path)
      if (appContext) {
        console.log('App context available:', appContext)
      }
      emit('update:modelValue', file.path)
      emit('update', file.path)
    }
  } catch (err) {
    console.error('Failed to handle item click:', err)
    error.value = `操作失败: ${err.message}`
    // 恢复当前目录状态
    await webdav.getDirectoryContents(webdav.currentPath)
  } finally {
    isLoading.value = false
  }
}

const navigateUp = async () => {
  try {
    isLoading.value = true
    error.value = ''
    const currentPath = webdav.currentPath
    console.log('[FileTree] Current path:', currentPath)

    // Handle root path case
    if (currentPath === '/') {
      error.value = 'Already at root directory'
      return
    }

    // Normalize path and get parent
    const normalizedPath = currentPath.replace(/\/+$/, '') // Remove trailing slashes
    const pathParts = normalizedPath.split('/').filter(Boolean)
    pathParts.pop() // Remove last part
    const parentPath = pathParts.length ? `/${pathParts.join('/')}` : '/'

    console.log('[FileTree] Navigating to parent:', parentPath)
    await webdav.getDirectoryContents(parentPath)
    console.log('[FileTree] Navigation complete. New path:', webdav.currentPath)

    // 确保UI更新
    await nextTick()
  } catch (err) {
    error.value = `Failed to navigate up: ${err.message}`
    console.error('[FileTree] Navigation error:', err)

    // 恢复之前的状态
    await webdav.getDirectoryContents(webdav.currentPath)
  } finally {
    isLoading.value = false
  }
}

const testConnection = async () => {
  try {
    isLoading.value = true
    error.value = ''
    await webdav.testConnection()
    if (webdav.client) {
      await webdav.getDirectoryContents('/')
    }
  } catch (err) {
    error.value = `Connection failed: ${err.message}`
    console.error(err)
  } finally {
    isLoading.value = false
  }
}

onMounted(loadFiles)
</script>

<template>
  <div class="file-tree">
    <div class="header">
      <span>Notes</span>
      <div class="current-path" v-if="webdav.client && webdav.currentPath">
        {{ webdav.currentPath }}
      </div>
    </div>

    <div v-if="!webdav.client" class="connection-status">
      <div class="error">WebDAV connection not established</div>
      <button @click="testConnection" class="connect-btn">
        Connect to WebDAV
      </button>
    </div>

    <div v-if="isLoading" class="loading">Loading...</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <template v-else-if="webdav.client">
      <div v-if="webdav.currentPath !== '/'" class="path-nav">
        <button @click="navigateUp">⬆ Up</button>
        <span>{{ webdav.currentPath }}</span>
      </div>
      <ul>
        <li v-for="file in files" :key="file.path"
          :class="{ active: modelValue === file.path, directory: file.type === 'directory' }"
          @click="handleItemClick(file)">
          <span class="icon">
            {{ file.type === 'directory' ? '📁' : '📄' }}
          </span>
          {{ file.name }}
        </li>
      </ul>
    </template>
  </div>
</template>

<style scoped>
.file-tree {
  height: 100%;
  padding: 10px;
  overflow-y: auto;
}

.header {
  font-weight: bold;
  margin-bottom: 10px;
  padding: 5px;
  border-bottom: 1px solid #ddd;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.current-path {
  font-size: 0.8em;
  color: #666;
  font-weight: normal;
  background-color: #f5f5f5;
  padding: 2px 8px;
  border-radius: 10px;
  margin-left: 10px;
}

.path-nav {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  padding: 6px;
  background-color: #f5f5f5;
  border-radius: 4px;
}

.path-nav button {
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 0.9em;
}

.path-nav button:hover {
  background-color: #e0e0e0;
}

ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

li {
  padding: 8px 10px;
  cursor: pointer;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 2px;
}

li:hover {
  background-color: #f0f0f0;
}

li.active {
  background-color: #e0e0ff;
  font-weight: bold;
}

li.directory {
  font-weight: 500;
}

.icon {
  font-size: 1.1em;
  width: 20px;
  text-align: center;
}

.loading,
.error {
  padding: 10px;
  margin: 10px 0;
  border-radius: 4px;
  font-size: 0.9em;
}

.loading {
  background-color: #f5f5f5;
  color: #666;
}

.error {
  background-color: #ffebee;
  color: #d32f2f;
  padding: 10px;
  margin: 10px 0;
  border-radius: 4px;
}

.connection-status {
  padding: 15px;
  margin-bottom: 15px;
  background-color: #fff8e1;
  border-radius: 4px;
  border-left: 4px solid #ffc107;
}

.connect-btn {
  margin-top: 10px;
  padding: 8px 15px;
  background-color: #2196f3;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9em;
}

.connect-btn:hover {
  background-color: #1976d2;
}

.connect-btn:disabled {
  background-color: #bdbdbd;
  cursor: not-allowed;
}
</style>