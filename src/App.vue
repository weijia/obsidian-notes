<script setup>
import { ref, computed, provide, inject } from 'vue'
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
  const webdav = inject('webdav')
  if (webdav) {
    try {
      const content = await webdav.getFileContents(newNote)
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

// Initialize and provide WebDAV client
let webdavClient = null
try {
  const savedConfig = localStorage.getItem('webdavConfig')
  if (savedConfig) {
    const config = JSON.parse(savedConfig)
    if (config.serverUrl && config.username && config.password) {
      webdavClient = createClient(config.serverUrl, {
        username: config.username,
        password: config.password
      })
      console.log('WebDAV client initialized with saved configuration')
    }
  }
} catch (e) {
  console.error('Failed to initialize WebDAV client:', e)
}
provide('webdav', webdavClient)

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
          <button @click="saveNote" class="save-btn">Save</button>
        </div>
        <textarea v-model="markdownContent" class="markdown-editor" placeholder="Write your markdown here..."
          @input="saveNote"></textarea>
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