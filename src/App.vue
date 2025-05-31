<script setup>
import { ref, computed, provide, inject, onMounted } from 'vue'
import DOMPurify from 'dompurify'

const isPreview = ref(false)
import { createClient } from 'webdav'
import { RouterView, useRouter } from 'vue-router'
import FileTree from './components/FileTree.vue'
import { marked } from 'marked'

const activeNote = ref('Welcome.md')
const markdownContent = ref('# Welcome to Obsidian-like Notes\n\nStart writing your notes here...')
// Sample notes data
const notes = ref({
  'Welcome.md': '# Welcome to Obsidian-like Notes\n\nStart writing your notes here...',
  'Getting Started.md': '# Getting Started\n\n1. Create a new note\n2. Write in Markdown\n3. See the preview',
  'Features.md': '# Features\n\n- Markdown editing\n- Live preview\n- File navigation'
})

// Update content when active note changes
const updateContent = async (newNote) => {
  activeNote.value = newNote

  // First check local notes
  if (notes.value[newNote]) {
    markdownContent.value = notes.value[newNote]
    return
  }

  // Try to fetch from WebDAV if available
  if (webdavStore.client) {
    try {
      const content = await webdavStore.readFile(newNote)
      notes.value[newNote] = content
      markdownContent.value = content
    } catch (e) {
      console.error('Failed to load from WebDAV:', e)
      markdownContent.value = `# Error loading ${newNote}\n\nFile not found locally or on WebDAV server`
    }
  } else {
    markdownContent.value = notes.value[newNote] || `# ${newNote}\n\nFile not found`
  }
}

// Save content when edited
const saveNote = () => {
  if (activeNote.value) {
    notes.value[activeNote.value] = markdownContent.value
  }
}

// Markdown preview
const markdownPreview = computed(() => {
  return marked(markdownContent.value)
})

import { useWebDAVStore } from '@/stores/webdav'
const webdavStore = useWebDAVStore()

// Initialize WebDAV connection from saved config
onMounted(async () => {
  try {
    const savedConfig = localStorage.getItem('webdavConfig')
    if (savedConfig) {
      const config = JSON.parse(savedConfig)
      if (config.serverUrl && config.username && config.password) {
        const connected = await webdavStore.connect(
          config.serverUrl,
          config.username,
          config.password
        )
        if (connected) {
          await webdavStore.getDirectoryContents(webdavStore.currentPath)
        }
      }
    }
  } catch (e) {
    console.error('Failed to initialize WebDAV connection:', e)
  }
})

provide('webdav', computed(() => webdavStore.client))

const router = useRouter()
const navigateToConfig = () => {
  console.log('Configure button clicked - router available:', !!router)
  if (!router) {
    console.error('Router is not available')
    return
  }
  try {
    console.log('Current route:', router.currentRoute.value.path)
    router.push('/config').then(() => {
      console.log('Navigation successful')
    }).catch(err => {
      console.error('Navigation failed:', err)
    })
  } catch (error) {
    console.error('Navigation error:', error)
  }
}
</script>

<template>
  <div class="app-container">
    <!-- Left sidebar - File navigation -->
    <div class="sidebar">
      <div class="sidebar-header"
        style="padding: 10px; display: flex; justify-content: space-between; align-items: center;">
        <span>Notes</span>
        <button @click="navigateToConfig" class="config-btn"
          style="padding: 5px 10px; background: #646cff; color: white; border: none; border-radius: 4px; cursor: pointer;">
          Configure
        </button>
      </div>
      <FileTree v-model="activeNote" @update="updateContent" />
    </div>

    <!-- Main content area -->
    <div class="main-content">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>

      <!-- Editor (shown only when route is home) -->
      <div v-if="$route.path === '/'" class="editor">
        <div class="editor-header">
          <span>{{ activeNote }}</span>
          <div>
            <button @click="isPreview = !isPreview" class="preview-btn">
              {{ isPreview ? 'Edit' : 'Preview' }}
            </button>
            <button @click="saveNote" class="save-btn">Save</button>
          </div>
        </div>
        <div class="editor-content">
          <textarea v-show="!isPreview" v-model="markdownContent" class="markdown-editor"
            placeholder="Write your markdown here..." @input="saveNote"
            style="width: 100%; height: 100%; min-height: calc(100vh - 100px); padding: 1rem; box-sizing: border-box;"></textarea>
          <div v-show="isPreview" class="markdown-preview" v-html="markdownPreview"></div>
        </div>
      </div>
    </div>

  </div>

</template>

<style>
.app-container {
  display: flex;
  height: 100vh;
  width: 100vw;
}

.sidebar {
  width: 250px;
  background-color: #1e1e1e;
  color: #d4d4d4;
  border-right: 1px solid #333;
  overflow-y: auto;
}

.main-content {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.editor {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.editor-header {
  padding: 10px 15px;
  background-color: #f5f5f5;
  border-bottom: 1px solid #ddd;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.save-btn {
  background-color: #4CAF50;
  color: white;
  border: none;
  padding: 5px 10px;
  border-radius: 3px;
  cursor: pointer;
}

.save-btn:hover {
  background-color: #45a049;
}

.markdown-editor {
  flex: 1;
  width: 100%;
  border: none;
  resize: none;
  outline: none;
  font-family: 'Consolas', monospace;
  font-size: 14px;
  line-height: 1.6;
  padding: 15px;
  background-color: #fefefe;
  color: #333;
}

.main-content {
  flex: 1 1 100%;
  position: relative;
  overflow: hidden;
}

.editor {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  line-height: 1.6;
  color: #333;
}

.markdown-preview h1,
.markdown-preview h2,
.markdown-preview h3 {
  margin-top: 1em;
  margin-bottom: 0.5em;
}

.markdown-preview code {
  background-color: #f0f0f0;
  padding: 0.2em 0.4em;
  border-radius: 3px;
  font-family: 'Consolas', monospace;
}

.markdown-preview pre {
  background-color: #f5f5f5;
  padding: 10px;
  border-radius: 3px;
  overflow-x: auto;
}

.markdown-preview blockquote {
  border-left: 3px solid #ddd;
  padding-left: 15px;
  color: #666;
  margin-left: 0;
}
</style>

<style scoped>
.editor-header>div {
  display: flex;
  gap: 0.5rem;
}

.preview-btn {
  padding: 0.25rem 0.5rem;
  background-color: var(--color-background-mute);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  cursor: pointer;
}

.preview-btn:hover {
  background-color: var(--color-background-soft);
}

.markdown-preview {
  padding: 1rem;
  height: calc(100% - 3rem);
  overflow-y: auto;
  background-color: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 0 0 8px 8px;
}

.editor-content {
  height: calc(100% - 3rem);
  position: relative;
}
</style>