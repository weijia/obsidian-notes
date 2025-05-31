import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { useWebDAVStore } from './stores/webdav'

import App from './App.vue'
import router from './router'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

// 初始化并提供WebDAV存储
const webdavStore = useWebDAVStore()
app.provide('webdav', webdavStore)

app.mount('#app')
