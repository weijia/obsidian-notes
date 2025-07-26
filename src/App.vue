<script setup>
import { ref, computed, provide, onMounted, onBeforeUnmount } from 'vue'
import DOMPurify from 'dompurify'
import { createClient } from 'webdav'
import { RouterView, useRouter } from 'vue-router'
import FileTree from './components/FileTree.vue'
import { marked } from 'marked'

// TipTap 编辑器相关导入
import { Editor, EditorContent, useEditor } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import CodeBlock from '@tiptap/extension-code-block'
import Placeholder from '@tiptap/extension-placeholder'

// Turndown 用于将HTML转换为Markdown
import TurndownService from 'turndown'
const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced'
})

const activeNote = ref('Welcome.md')
const markdownContent = ref('# Welcome to Obsidian-like Notes\n\nStart writing your notes here...')
// Sample notes data
const notes = ref({
  'Welcome.md': '# Welcome to Obsidian-like Notes\n\nStart writing your notes here...',
  'Getting Started.md': '# Getting Started\n\n1. Create a new note\n2. Write in Markdown\n3. See the preview',
  'Features.md': '# Features\n\n- Markdown editing\n- Live preview\n- File navigation'
})

// TipTap 编辑器实例
const editor = useEditor({
  content: markdownContent.value,
  extensions: [
    StarterKit,
    Link.configure({
      openOnClick: false,
    }),
    Image,
    CodeBlock,
    Placeholder.configure({
      placeholder: '开始编写您的笔记...',
    }),
  ],
  onUpdate: ({ editor }) => {
    // 将编辑器内容转换为HTML，然后使用turndown转换为Markdown
    const html = editor.getHTML()
    markdownContent.value = turndownService.turndown(html)
    saveLocalNote()
  },
  editorProps: {
    attributes: {
      class: 'wysiwyg-editor',
    },
  },
})

// 在组件卸载前销毁编辑器
onBeforeUnmount(() => {
  editor.value?.destroy()
})

// Update content when active note changes
const updateContent = async (newNote) => {
  activeNote.value = newNote

  // First check local notes
  if (notes.value[newNote]) {
    markdownContent.value = notes.value[newNote]
    // 将Markdown转换为HTML，然后设置为编辑器内容
    const html = marked(notes.value[newNote])
    editor.value?.commands.setContent(html)
    return
  }

  // Try to fetch from WebDAV if available
  if (webdavStore.client) {
    try {
      const content = await webdavStore.readFile(newNote)
      notes.value[newNote] = content
      markdownContent.value = content
      // 将Markdown转换为HTML，然后设置为编辑器内容
      const html = marked(content)
      editor.value?.commands.setContent(html)
    } catch (e) {
      console.error('从WebDAV加载失败:', e)
      const errorContent = `# 加载 ${newNote} 出错\n\n文件在本地或WebDAV服务器上未找到`
      markdownContent.value = errorContent
      // 将Markdown转换为HTML，然后设置为编辑器内容
      const html = marked(errorContent)
      editor.value?.commands.setContent(html)
    }
  } else {
    const notFoundContent = notes.value[newNote] || `# ${newNote}\n\n文件未找到`
    markdownContent.value = notFoundContent
    // 将Markdown转换为HTML，然后设置为编辑器内容
    const html = marked(notFoundContent)
    editor.value?.commands.setContent(html)
  }
}

// Save content locally
const saveLocalNote = () => {
  if (activeNote.value) {
    notes.value[activeNote.value] = markdownContent.value
  }
}

// Save content to WebDAV
const saveToWebDAV = async () => {
  if (!activeNote.value || !webdavStore.isConnected) return

  try {
    await webdavStore.writeFile(activeNote.value, markdownContent.value)
    console.log('成功保存到WebDAV')
  } catch (e) {
    console.error('保存到WebDAV失败:', e)
  }
}

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
    console.error('初始化WebDAV连接失败:', e)
  }
})

provide('webdav', computed(() => webdavStore.client))

const router = useRouter()
const navigateToConfig = () => {
  console.log('配置按钮点击 - router可用:', !!router)
  if (!router) {
    console.error('Router不可用')
    return
  }
  try {
    console.log('当前路由:', router.currentRoute.value.path)
    router.push('/config').then(() => {
      console.log('导航成功')
    }).catch(err => {
      console.error('导航失败:', err)
    })
  } catch (error) {
    console.error('导航错误:', error)
  }
}
</script>

<template>
  <div class="app-container">
    <!-- 左侧边栏 - 文件导航 -->
    <div class="sidebar">
      <div class="sidebar-header"
        style="padding: 10px; display: flex; justify-content: space-between; align-items: center;">
        <span>笔记</span>
        <button @click="navigateToConfig" class="config-btn"
          style="padding: 5px 10px; background: #646cff; color: white; border: none; border-radius: 4px; cursor: pointer;">
          配置
        </button>
      </div>
      <div class="sidebar-tree">
        <FileTree v-model="activeNote" @update="updateContent" />
      </div>
    </div>

    <!-- 主内容区域 -->
    <div class="main-content">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>

      <!-- 编辑器 (仅在首页路由显示) -->
      <div v-if="$route.path === '/'" class="editor">
        <div class="editor-header">
          <span>{{ activeNote }}</span>
          <div>
            <button @click="() => { saveLocalNote(); saveToWebDAV(); }" class="save-btn">保存</button>
          </div>
        </div>
        <div class="editor-content">
          <div class="markdown-editor-container">
            <EditorContent :editor="editor" class="tiptap-editor" />
          </div>
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
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden; /* 禁止 sidebar 自己滚动 */
}

.sidebar-header {
  flex-shrink: 0;
}

.sidebar-tree {
  flex: 1 1 auto;
  overflow-y: auto; /* 只让 FileTree 区域滚动 */
  min-height: 0;    /* 兼容 flex 布局下的滚动 */
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

.markdown-editor-container {
  flex: 1;
  width: 100%;
  height: 100%;
  overflow: auto;
}

/* TipTap 编辑器样式 */
.tiptap-editor {
  height: 100%;
  padding: 20px;
  box-sizing: border-box;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  line-height: 1.6;
  color: #333;
}

.wysiwyg-editor {
  height: 100%;
  outline: none;
}

.wysiwyg-editor h1 {
  font-size: 2em;
  margin-bottom: 0.5em;
}

.wysiwyg-editor h2 {
  font-size: 1.5em;
  margin-bottom: 0.5em;
}

.wysiwyg-editor h3 {
  font-size: 1.3em;
  margin-bottom: 0.5em;
}

.wysiwyg-editor p {
  margin-bottom: 1em;
}

.wysiwyg-editor ul,
.wysiwyg-editor ol {
  padding-left: 1.5em;
  margin-bottom: 1em;
}

.wysiwyg-editor code {
  background-color: #f0f0f0;
  padding: 0.2em 0.4em;
  border-radius: 3px;
  font-family: 'Consolas', monospace;
}

.wysiwyg-editor pre {
  background-color: #f5f5f5;
  padding: 10px;
  border-radius: 3px;
  overflow-x: auto;
  margin-bottom: 1em;
}

.wysiwyg-editor blockquote {
  border-left: 3px solid #ddd;
  padding-left: 15px;
  color: #666;
  margin-left: 0;
  margin-bottom: 1em;
}

.wysiwyg-editor img {
  max-width: 100%;
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
</style>

<style scoped>
.editor-header>div {
  display: flex;
  gap: 0.5rem;
}

.editor-content {
  height: calc(100% - 3rem);
  position: relative;
}
</style>
