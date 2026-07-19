<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

const show = ref(false)
const newVersion = ref('')
let intervalId = null
let updateAvailable = false

const checkUpdate = async () => {
  try {
    // 加时间戳防止缓存
    const ts = Date.now()
    const base = new URL('.', window.location.href).href
    const url = base + 'version.json?t=' + ts
    console.log('[UpdateToast] 检查更新:', url)
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) {
      console.log('[UpdateToast] 请求失败:', res.status)
      return
    }
    const remote = await res.json()
    const local = window.__APP_VERSION__ || ''
    console.log('[UpdateToast] 本地版本:', local, '远程版本:', remote.version)
    if (remote.version && local && remote.version !== local) {
      if (!updateAvailable) {
        updateAvailable = true
        newVersion.value = remote.version
        show.value = true
        console.log('[UpdateToast] 发现新版本!')
      }
    } else {
      console.log('[UpdateToast] 已是最新版本')
    }
  } catch (e) {
    console.log('[UpdateToast] 检查更新出错:', e)
  }
}

const handleRefresh = () => {
  show.value = false
  window.location.reload()
}

onMounted(() => {
  // 首次 5 秒后检测
  setTimeout(() => {
    checkUpdate()
    // 之后每 5 分钟轮询
    intervalId = setInterval(checkUpdate, 5 * 60 * 1000)
  }, 5000)
})

onBeforeUnmount(() => {
  if (intervalId) {
    clearInterval(intervalId)
  }
})
</script>

<template>
  <Transition name="toast-fade">
    <div v-if="show" class="update-toast">
      <span class="toast-text">发现新版本 v{{ newVersion }}</span>
      <button class="toast-btn" @click="handleRefresh">刷新</button>
    </div>
  </Transition>
</template>

<style scoped>
.update-toast {
  position: fixed;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  display: flex;
  align-items: center;
  gap: 12px;
  background: rgba(30, 30, 30, 0.95);
  color: #fff;
  padding: 10px 18px;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
  font-size: 14px;
  white-space: nowrap;
}

.toast-text {
  color: #ccc;
}

.toast-btn {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.2);
  padding: 5px 14px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.2s;
}

.toast-btn:hover {
  background: rgba(255, 255, 255, 0.25);
}

.toast-fade-enter-active,
.toast-fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.toast-fade-enter-from,
.toast-fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(10px);
}
</style>