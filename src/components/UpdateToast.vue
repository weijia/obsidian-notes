<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

const show = ref(false)
const newVersion = ref('')
let timer = null
let updateAvailable = false

const checkUpdate = async () => {
  try {
    const base = new URL('.', window.location.href).href
    const res = await fetch(base + 'version.json', { cache: 'no-store' })
    if (!res.ok) return
    const remote = await res.json()
    // 比对版本号（忽略 dev 模式）
    const local = window.__APP_VERSION__ || ''
    if (remote.version && local && remote.version !== local) {
      if (!updateAvailable) {
        updateAvailable = true
        newVersion.value = remote.version
        show.value = true
      }
    }
  } catch {
    // 静默失败
  }
}

const handleRefresh = () => {
  show.value = false
  window.location.reload()
}

onMounted(() => {
  // 首次 5 秒后检测
  timer = setTimeout(() => {
    checkUpdate()
    // 之后每 5 分钟轮询
    timer = setInterval(checkUpdate, 5 * 60 * 1000)
  }, 5000)
})

onBeforeUnmount(() => {
  if (timer) {
    clearTimeout(timer)
    clearInterval(timer)
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