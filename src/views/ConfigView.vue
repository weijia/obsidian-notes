<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useWebDAVStore } from '@/stores/webdav'
import { useGiteeStore } from '@/stores/gitee'
import { useStorageStore } from '@/stores/storage'

const router = useRouter()
const storageStore = useStorageStore()
const webdav = useWebDAVStore()
const gitee = useGiteeStore()

const storageType = ref('webdav')

const webdavConfig = ref({
  serverUrl: '',
  username: '',
  password: '',
  directory: '/obsidian'
})

const giteeConfig = ref({
  token: '',
  owner: '',
  repo: '',
  branch: 'master'
})

onMounted(() => {
  try {
    // 加载存储类型
    const savedType = localStorage.getItem('storageType')
    if (savedType) {
      storageType.value = JSON.parse(savedType)
    }

    // 加载 WebDAV 配置
    const savedWebdav = localStorage.getItem('webdavConfig')
    if (savedWebdav) {
      const parsed = JSON.parse(savedWebdav)
      webdavConfig.value = {
        serverUrl: parsed.serverUrl || '',
        username: parsed.username || '',
        password: parsed.password || '',
        directory: parsed.directory || '/obsidian'
      }
    }

    // 加载 Gitee 配置
    const savedGitee = localStorage.getItem('gitee_config')
    if (savedGitee) {
      const parsed = JSON.parse(savedGitee)
      giteeConfig.value = {
        token: parsed.token || '',
        owner: parsed.owner || '',
        repo: parsed.repo || '',
        branch: parsed.branch || 'master'
      }
    }
  } catch (e) {
    console.error('Failed to parse saved config', e)
  }
})

const isLoading = ref(false)
const message = ref('')
const messageType = ref('info') // 'info' | 'success' | 'error'

const setMessage = (text, type = 'info') => {
  message.value = text
  messageType.value = type
}

const testConnection = async () => {
  isLoading.value = true
  setMessage('正在测试连接...')

  try {
    let success = false
    if (storageType.value === 'gitee') {
      success = await gitee.connect(
        giteeConfig.value.token,
        giteeConfig.value.owner,
        giteeConfig.value.repo,
        giteeConfig.value.branch
      )
      setMessage(success ? 'Gitee 连接成功！' : 'Gitee 连接失败，请检查配置', success ? 'success' : 'error')
    } else {
      success = await webdav.connect(
        webdavConfig.value.serverUrl,
        webdavConfig.value.username,
        webdavConfig.value.password
      )
      setMessage(success ? 'WebDAV 连接成功！' : 'WebDAV 连接失败，请检查配置', success ? 'success' : 'error')
    }
  } catch (error) {
    setMessage('连接错误: ' + error.message, 'error')
  } finally {
    isLoading.value = false
  }
}

const goBack = () => {
  router.push('/')
}

const saveConfig = async () => {
  storageStore.setStorageType(storageType.value)

  if (storageType.value === 'gitee') {
    localStorage.setItem('gitee_config', JSON.stringify(giteeConfig.value))
    // 尝试连接
    if (giteeConfig.value.token && giteeConfig.value.owner && giteeConfig.value.repo) {
      try {
        await gitee.connect(
          giteeConfig.value.token,
          giteeConfig.value.owner,
          giteeConfig.value.repo,
          giteeConfig.value.branch
        )
      } catch (err) {
        console.error('Gitee 连接失败:', err)
      }
    }
  } else {
    localStorage.setItem('webdavConfig', JSON.stringify(webdavConfig.value))
    localStorage.setItem('webdav_config', JSON.stringify(webdavConfig.value))
    if (webdavConfig.value.serverUrl && webdavConfig.value.username && webdavConfig.value.password) {
      try {
        await webdav.connect(
          webdavConfig.value.serverUrl,
          webdavConfig.value.username,
          webdavConfig.value.password
        )
      } catch (err) {
        console.error('WebDAV 连接失败:', err)
      }
    }
  }

  router.push('/')
}

const activeBackendLabel = computed(() => {
  if (storageType.value === 'gitee') {
    return gitee.isConnected ? `已连接 Gitee: ${gitee.owner}/${gitee.repo}` : ''
  }
  return webdav.isConnected ? `已连接 WebDAV: ${webdav.serverUrl}` : ''
})
</script>

<template>
  <div class="config-container">
    <div class="config-header">
      <button class="back-btn" @click="goBack">← 返回</button>
      <h1>存储配置</h1>
    </div>

    <form @submit.prevent="saveConfig">
      <!-- 存储类型选择 -->
      <div class="form-group">
        <label>存储后端</label>
        <div class="storage-type-selector">
          <button
            type="button"
            :class="{ active: storageType === 'webdav' }"
            @click="storageType = 'webdav'"
            class="type-btn"
          >
            WebDAV
          </button>
          <button
            type="button"
            :class="{ active: storageType === 'gitee' }"
            @click="storageType = 'gitee'"
            class="type-btn"
          >
            Gitee
          </button>
        </div>
      </div>

      <!-- WebDAV 配置 -->
      <template v-if="storageType === 'webdav'">
        <div class="form-group">
          <label>Server URL</label>
          <input v-model="webdavConfig.serverUrl" type="url" required placeholder="https://example.com/webdav">
        </div>
        <div class="form-group">
          <label>Username</label>
          <input v-model="webdavConfig.username" type="text" required>
        </div>
        <div class="form-group">
          <label>Password</label>
          <input v-model="webdavConfig.password" type="password" required>
        </div>
        <div class="form-group">
          <label>Directory</label>
          <input v-model="webdavConfig.directory" type="text" required>
        </div>
      </template>

      <!-- Gitee 配置 -->
      <template v-if="storageType === 'gitee'">
        <div class="form-group">
          <label>Personal Access Token</label>
          <input v-model="giteeConfig.token" type="password" required placeholder="Gitee 个人访问令牌">
          <span class="hint">在 <a href="https://gitee.com/profile/personal_access_tokens" target="_blank" rel="noopener">Gitee 设置</a> 中生成</span>
        </div>
        <div class="form-group">
          <label>用户名 / 组织</label>
          <input v-model="giteeConfig.owner" type="text" required placeholder="gitee-username">
        </div>
        <div class="form-group">
          <label>仓库名</label>
          <input v-model="giteeConfig.repo" type="text" required placeholder="repository-name">
        </div>
        <div class="form-group">
          <label>分支</label>
          <input v-model="giteeConfig.branch" type="text" placeholder="master">
        </div>
      </template>

      <div class="form-actions">
        <button type="button" class="test-btn" @click="testConnection" :disabled="isLoading">
          {{ isLoading ? '连接中...' : '测试连接' }}
        </button>
        <button type="submit" class="save-btn">保存配置</button>
      </div>

      <div v-if="message" class="message" :class="'message-' + messageType">
        {{ message }}
      </div>

      <div v-if="activeBackendLabel" class="connection-status">
        {{ activeBackendLabel }}
      </div>
    </form>
  </div>
</template>

<style scoped>
.config-container {
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
}

.config-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 30px;
}

.back-btn {
  background: none;
  border: 1px solid #ddd;
  padding: 6px 14px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  color: #555;
  white-space: nowrap;
}

.back-btn:hover {
  background-color: #f0f0f0;
  border-color: #bbb;
}

.config-header h1 {
  margin: 0;
}

.form-group {
  margin-bottom: 20px;
}

label {
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
}

input {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 16px;
  box-sizing: border-box;
}

.hint {
  display: block;
  margin-top: 4px;
  font-size: 0.8em;
  color: #888;
  font-weight: normal;
}

.hint a {
  color: #646cff;
  text-decoration: none;
}

.hint a:hover {
  text-decoration: underline;
}

.storage-type-selector {
  display: flex;
  gap: 8px;
}

.type-btn {
  flex: 1;
  padding: 10px;
  border: 2px solid #ddd;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  font-size: 15px;
  font-weight: 500;
  color: #555;
  transition: all 0.2s;
}

.type-btn:hover {
  border-color: #999;
}

.type-btn.active {
  border-color: #646cff;
  background-color: #f0f0ff;
  color: #646cff;
}

.form-actions {
  margin-top: 20px;
}

.test-btn {
  background-color: #2196F3;
  color: white;
  border: none;
  padding: 12px 20px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
  width: 100%;
  margin-bottom: 10px;
}

.test-btn:hover {
  background-color: #0b7dda;
}

.test-btn:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.save-btn {
  background-color: #4CAF50;
  color: white;
  border: none;
  padding: 12px 20px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
  width: 100%;
  margin-top: 10px;
}

.save-btn:hover {
  background-color: #45a049;
}

.message {
  margin: 15px 0;
  padding: 10px;
  border-radius: 4px;
  border-left: 4px solid #2196F3;
  background-color: #f8f9fa;
}

.message-success {
  border-left-color: #4CAF50;
  background-color: #e8f5e9;
  color: #2e7d32;
}

.message-error {
  border-left-color: #f44336;
  background-color: #ffebee;
  color: #c62828;
}

.connection-status {
  margin-top: 15px;
  padding: 10px;
  background-color: #e8f5e9;
  border-left: 4px solid #4CAF50;
  color: #2e7d32;
}
</style>