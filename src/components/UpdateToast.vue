<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

const show = ref(false)
const newVersion = ref('')
let intervalId = null
let updateAvailable = false

const handleUpdate = (reg) => {
  reg.addEventListener('updatefound', () => {
    const newWorker = reg.installing
    if (!newWorker) return
    newWorker.addEventListener('statechange', () => {
      // 新 Worker 已安装且等待中，只通知一次
      if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
        if (!updateAvailable) {
          updateAvailable = true
          console.log('[PWA] 新版本可用')
          newVersion.value = '' // 不需要显示具体版本号，SW 变更即代表有新代码
          show.value = true
        }
      }
    })
  })
}

const handleRefresh = async () => {
  const reg = await navigator.serviceWorker.ready
  const newWorker = reg.waiting
  if (newWorker) {
    // 发送消息让新 SW 跳过等待 —— 需要自定义 SW 监听此消息
    newWorker.postMessage({ type: 'SKIP_WAITING' })
    // 新 SW 激活后刷新页面
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload()
    })
  }
  show.value = false
}

onMounted(() => {
  if (!('serviceWorker' in navigator)) {
    console.log('[PWA] 浏览器不支持 Service Worker')
    return
  }
  // 注册后监听更新
  navigator.serviceWorker.ready.then((reg) => {
    handleUpdate(reg)
    // 3 秒后检查更新
    setTimeout(() => reg.update().catch(console.error), 3000)
  })
  // 每 5 分钟轮询
  intervalId = setInterval(() => {
    navigator.serviceWorker.ready.then((reg) => reg.update().catch(console.error))
  }, 5 * 60 * 1000)
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
      <span class="toast-text">新版本可用</span>
      <button class="toast-btn" @click="handleRefresh">
        <span class="refresh-icon">↻</span> 点击刷新
      </button>
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
  display: flex;
  align-items: center;
  gap: 4px;
}

.toast-btn:hover {
  background: rgba(255, 255, 255, 0.25);
}

.refresh-icon {
  font-size: 14px;
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
