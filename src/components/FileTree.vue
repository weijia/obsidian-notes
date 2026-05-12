<script setup>
import { ref, onMounted, computed, inject, nextTick, watch } from 'vue'
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

// 排序相关
const sortBy = ref('name') // name, time, type, size
const sortOrder = ref('asc') // asc, desc

// 从 localStorage 加载排序设置
const loadSortSettings = () => {
  const saved = localStorage.getItem('fileSortSettings')
  if (saved) {
    try {
      const settings = JSON.parse(saved)
      if (settings.sortBy) sortBy.value = settings.sortBy
      if (settings.sortOrder) sortOrder.value = settings.sortOrder
    } catch (e) {
      console.error('Failed to load sort settings:', e)
    }
  }
}

// 保存排序设置到 localStorage
const saveSortSettings = () => {
  localStorage.setItem('fileSortSettings', JSON.stringify({
    sortBy: sortBy.value,
    sortOrder: sortOrder.value
  }))
}

// 常用页面
const quickLinks = ref([
  { name: 'Welcome.md', path: '/obsidian/Welcome.md', icon: '🏠' },
  { name: 'Daily Notes', path: '/obsidian/daily', icon: '📅' },
  { name: 'Tasks', path: '/obsidian/tasks.md', icon: '✅' },
])

// 从 localStorage 加载常用页面
const loadQuickLinks = () => {
  const saved = localStorage.getItem('quickLinks')
  if (saved) {
    try {
      quickLinks.value = JSON.parse(saved)
    } catch (e) {
      console.error('Failed to load quick links:', e)
    }
  }
}

// 保存常用页面到 localStorage
const saveQuickLinks = () => {
  localStorage.setItem('quickLinks', JSON.stringify(quickLinks.value))
}

// 添加当前文件到常用页面
const addToQuickLinks = (file) => {
  const exists = quickLinks.value.some(link => link.path === file.path)
  if (!exists) {
    quickLinks.value.push({
      name: file.name,
      path: file.path,
      icon: file.type === 'directory' ? '📁' : '📄'
    })
    saveQuickLinks()
  }
}

// 从常用页面移除
const removeFromQuickLinks = (index, event) => {
  event.stopPropagation()
  quickLinks.value.splice(index, 1)
  saveQuickLinks()
}

// 切换排序
const toggleSort = (field) => {
  if (sortBy.value === field) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortBy.value = field
    sortOrder.value = 'asc'
  }
  saveSortSettings()
}

// 排序后的文件列表
const sortedFiles = computed(() => {
  if (!webdav.isConnected) {
    return []
  }

  const filteredFiles = webdav.files
    .filter(item => {
      return item.basename !== '.DS_Store'
    })
    .map(item => ({
      name: item.basename,
      path: item.filename,
      type: item.type,
      lastmod: item.lastmod,
      size: item.size || 0
    }))

  // 排序
  const sorted = [...filteredFiles].sort((a, b) => {
    let comparison = 0
    
    switch (sortBy.value) {
      case 'name':
        comparison = a.name.localeCompare(b.name)
        break
      case 'time':
        comparison = new Date(a.lastmod || 0) - new Date(b.lastmod || 0)
        break
      case 'type':
        // 目录排在前面
        if (a.type === 'directory' && b.type !== 'directory') comparison = -1
        else if (a.type !== 'directory' && b.type === 'directory') comparison = 1
        else comparison = a.name.localeCompare(b.name)
        break
      case 'size':
        comparison = (a.size || 0) - (b.size || 0)
        break
      default:
        comparison = a.name.localeCompare(b.name)
    }
    
    return sortOrder.value === 'asc' ? comparison : -comparison
  })

  return sorted
})

const loadFiles = async () => {
  try {
    isLoading.value = true
    error.value = null

    // 首先尝试使用 webdav store 中已保存的配置
    if (!webdav.isConnected && webdav.serverUrl) {
      console.log('尝试使用 store 中的配置自动连接到WebDAV...')
      try {
        await webdav.connect(webdav.serverUrl, webdav.username, webdav.password)
        console.log('自动连接成功')
      } catch (err) {
        console.error('WebDAV自动连接失败:', err)
        // 继续尝试从 localStorage 读取配置
      }
    }

    // 如果仍未连接，尝试从 localStorage 读取配置
    if (!webdav.isConnected) {
      // 尝试两种可能的 key 名称
      let configStr = localStorage.getItem('webdav_config') || localStorage.getItem('webdavConfig')
      let config = null
      
      if (configStr) {
        try {
          config = JSON.parse(configStr)
        } catch (e) {
          console.error('Failed to parse config:', e)
        }
      }
      
      if (!config || !config.serverUrl) {
        error.value = 'WebDAV configuration not found. Please configure first.'
        return
      }

      console.log('尝试从 localStorage 连接到WebDAV...')
      try {
        await webdav.connect(config.serverUrl, config.username, config.password)
        console.log('自动连接成功')
      } catch (err) {
        error.value = `自动连接失败: ${err.message}`
        console.error('WebDAV自动连接失败:', err)
        return
      }
    }

    // 获取目录内容
    const targetPath = webdav.currentPath || webdav.basePath
    await webdav.getDirectoryContents(targetPath)

    if (sortedFiles.value.length > 0 && !props.modelValue) {
      emit('update:modelValue', sortedFiles.value[0].path)
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

// 格式化文件大小
const formatSize = (bytes) => {
  if (bytes === 0 || bytes === undefined) return '-'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

// 格式化时间
const formatTime = (timeStr) => {
  if (!timeStr) return '-'
  const date = new Date(timeStr)
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

onMounted(() => {
  loadSortSettings()
  loadFiles()
  loadQuickLinks()
})
</script>

<template>
  <div class="file-tree">
    <!-- 常用页面快捷入口 -->
    <div class="quick-links-section">
      <div class="section-title">
        <span>⭐ 常用页面</span>
      </div>
      <ul class="quick-links">
        <li 
          v-for="(link, index) in quickLinks" 
          :key="link.path"
          :class="{ active: modelValue === link.path }"
          @click="handleItemClick(link)"
          class="quick-link-item"
        >
          <span class="icon">{{ link.icon }}</span>
          <span class="name">{{ link.name }}</span>
          <button 
            class="remove-btn" 
            @click="removeFromQuickLinks(index, $event)"
            title="从常用页面移除"
          >
            ×
          </button>
        </li>
        <li v-if="quickLinks.length === 0" class="empty-tip">
          暂无常用页面
        </li>
      </ul>
    </div>

    <div class="divider"></div>

    <!-- 文件列表头部 -->
    <div class="header">
      <span>📁 文件列表</span>
      <div class="current-path" v-if="webdav.client && webdav.currentPath">
        {{ webdav.currentPath }}
      </div>
    </div>

    <!-- 排序工具栏 -->
    <div class="sort-toolbar">
      <button 
        :class="{ active: sortBy === 'name' }" 
        @click="toggleSort('name')"
        title="按名称排序"
      >
        名称 {{ sortBy === 'name' ? (sortOrder === 'asc' ? '↑' : '↓') : '' }}
      </button>
      <button 
        :class="{ active: sortBy === 'time' }" 
        @click="toggleSort('time')"
        title="按时间排序"
      >
        时间 {{ sortBy === 'time' ? (sortOrder === 'asc' ? '↑' : '↓') : '' }}
      </button>
      <button 
        :class="{ active: sortBy === 'type' }" 
        @click="toggleSort('type')"
        title="按类型排序"
      >
        类型 {{ sortBy === 'type' ? (sortOrder === 'asc' ? '↑' : '↓') : '' }}
      </button>
      <button 
        :class="{ active: sortBy === 'size' }" 
        @click="toggleSort('size')"
        title="按大小排序"
      >
        大小 {{ sortBy === 'size' ? (sortOrder === 'asc' ? '↑' : '↓') : '' }}
      </button>
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
      
      <!-- 文件列表表头 -->
      <div class="file-list-header">
        <span class="col-name">名称</span>
        <span class="col-size">大小</span>
        <span class="col-time">修改时间</span>
      </div>
      
      <ul class="file-list">
        <li 
          v-for="file in sortedFiles" 
          :key="file.path"
          :class="{ active: modelValue === file.path, directory: file.type === 'directory' }"
          @click="handleItemClick(file)"
          @contextmenu.prevent="addToQuickLinks(file)"
          :title="'右键点击添加到常用页面'"
        >
          <span class="col-name">
            <span class="icon">
              {{ file.type === 'directory' ? '📁' : '📄' }}
            </span>
            {{ file.name }}
          </span>
          <span class="col-size">{{ formatSize(file.size) }}</span>
          <span class="col-time">{{ formatTime(file.lastmod) }}</span>
        </li>
        <li v-if="sortedFiles.length === 0" class="empty-tip">
          当前目录为空
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

/* 常用页面区域 */
.quick-links-section {
  margin-bottom: 10px;
}

.section-title {
  font-weight: bold;
  font-size: 0.85em;
  color: #666;
  margin-bottom: 8px;
  padding: 0 5px;
}

.quick-links {
  list-style: none;
  padding: 0;
  margin: 0;
}

.quick-link-item {
  padding: 6px 10px;
  cursor: pointer;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 2px;
  font-size: 0.9em;
  position: relative;
}

.quick-link-item:hover {
  background-color: #f0f0f0;
}

.quick-link-item:hover .remove-btn {
  opacity: 1;
}

.quick-link-item.active {
  background-color: #e0e0ff;
  font-weight: bold;
}

.quick-link-item .name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.remove-btn {
  opacity: 0;
  background: none;
  border: none;
  color: #999;
  cursor: pointer;
  font-size: 1.2em;
  padding: 0 4px;
  line-height: 1;
  transition: opacity 0.2s;
}

.remove-btn:hover {
  color: #d32f2f;
}

.divider {
  height: 1px;
  background-color: #ddd;
  margin: 12px 0;
}

/* 头部 */
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

/* 排序工具栏 */
.sort-toolbar {
  display: flex;
  gap: 4px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}

.sort-toolbar button {
  padding: 4px 8px;
  font-size: 0.8em;
  border: 1px solid #ddd;
  background-color: #f5f5f5;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.sort-toolbar button:hover {
  background-color: #e0e0e0;
}

.sort-toolbar button.active {
  background-color: #646cff;
  color: white;
  border-color: #646cff;
}

/* 路径导航 */
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

/* 文件列表表头 */
.file-list-header {
  display: flex;
  padding: 6px 10px;
  font-size: 0.75em;
  color: #666;
  border-bottom: 1px solid #eee;
  font-weight: 500;
}

/* 文件列表 */
.file-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.file-list li {
  padding: 8px 10px;
  cursor: pointer;
  border-radius: 4px;
  display: flex;
  align-items: center;
  margin-bottom: 2px;
  font-size: 0.9em;
}

.file-list li:hover {
  background-color: #f0f0f0;
}

.file-list li.active {
  background-color: #e0e0ff;
  font-weight: bold;
}

.file-list li.directory {
  font-weight: 500;
}

.col-name {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.col-size {
  width: 60px;
  text-align: right;
  font-size: 0.85em;
  color: #888;
}

.col-time {
  width: 70px;
  text-align: right;
  font-size: 0.85em;
  color: #888;
}

.icon {
  font-size: 1.1em;
  width: 20px;
  text-align: center;
  flex-shrink: 0;
}

.empty-tip {
  text-align: center;
  color: #999;
  padding: 20px;
  font-size: 0.9em;
  cursor: default !important;
}

.empty-tip:hover {
  background-color: transparent !important;
}

/* 状态提示 */
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
