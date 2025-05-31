<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useWebDAVStore } from '@/stores/webdav'

const router = useRouter()
const webdav = useWebDAVStore()
const config = ref({
  serverUrl: '',
  username: '',
  password: '',
  directory: '/notes'
})

onMounted(() => {
  try {
    const savedConfig = localStorage.getItem('webdavConfig')
    if (savedConfig) {
      const parsedConfig = JSON.parse(savedConfig)
      config.value = {
        serverUrl: parsedConfig.serverUrl || '',
        username: parsedConfig.username || '',
        password: parsedConfig.password || '',
        directory: parsedConfig.directory || '/notes'
      }
    }
  } catch (e) {
    console.error('Failed to parse saved config', e)
  }
})
const isLoading = ref(false)
const message = ref('')

const testConnection = async () => {
  isLoading.value = true
  message.value = 'Connecting...'

  try {
    const success = await webdav.connect(
      config.value.serverUrl,
      config.value.username,
      config.value.password
    )

    message.value = success
      ? 'Connection successful!'
      : 'Connection failed, please check configuration'
  } catch (error) {
    message.value = 'Connection error: ' + error.message
  } finally {
    isLoading.value = false
  }
}

const saveConfig = () => {
  localStorage.setItem('webdavConfig', JSON.stringify(config.value))
  router.push('/')
}
</script>

<template>
  <div class="config-container">
    <h1>WebDAV Configuration</h1>
    <form @submit.prevent="saveConfig">
      <div class="form-group">
        <label>Server URL</label>
        <input v-model="config.serverUrl" type="url" required placeholder="https://example.com/webdav">
      </div>
      <div class="form-group">
        <label>Username</label>
        <input v-model="config.username" type="text" required>
      </div>
      <div class="form-group">
        <label>Password</label>
        <input v-model="config.password" type="password" required>
      </div>
      <div class="form-group">
        <label>Directory</label>
        <input v-model="config.directory" type="text" required>
      </div>
      <div class="form-actions">
        <button type="button" class="test-btn" @click="testConnection" :disabled="isLoading">
          {{ isLoading ? 'Connecting...' : 'Test Connection' }}
        </button>
        <button type="submit" class="save-btn">Save Configuration</button>
      </div>

      <div v-if="message" class="message">
        {{ message }}
      </div>

      <div v-if="webdav.isConnected" class="connection-status">
        Connected to: {{ webdav.serverUrl }}
      </div>
    </form>
  </div>
</template>

<style scoped>
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

.form-actions {
  margin-top: 20px;
}

.message {
  margin: 15px 0;
  padding: 10px;
  border-radius: 4px;
  background-color: #f8f9fa;
  border-left: 4px solid #2196F3;
}

.connection-status {
  margin-top: 15px;
  padding: 10px;
  background-color: #e8f5e9;
  border-left: 4px solid #4CAF50;
  color: #2e7d32;
}
</style>

<style scoped>
.config-container {
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
}

h1 {
  text-align: center;
  margin-bottom: 30px;
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
</style>