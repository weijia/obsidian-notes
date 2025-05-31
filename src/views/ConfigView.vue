<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const config = ref({
  serverUrl: '',
  username: '',
  password: '',
  directory: '/notes'
})

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
      <button type="submit" class="save-btn">Save Configuration</button>
    </form>
  </div>
</template>

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