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

// 表格相关扩展 - 使用命名导入
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'

// Turndown 用于将HTML转换为Markdown
import TurndownService from 'turndown'
const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced'
})

// 添加表格支持到Turndown
turndownService.addRule('tableCell', {
  filter: ['th', 'td'],
  replacement: function (content, node) {
    return ' ' + content + ' |'
  }
})

turndownService.addRule('tableRow', {
  filter: 'tr',
  replacement: function (content, node) {
    let output = '|' + content
    if (node.parentNode.nodeName.toLowerCase() === 'thead') {
      output += '\n|' + Array(node.childNodes.length + 1).join(' --- |')
    }
    return output + '\n'
  }
})

turndownService.addRule('table', {
  filter: 'table',
  replacement: function (content) {
    return '\n\n' + content + '\n\n'
  }
})

const activeNote = ref('Welcome.md')
const markdownContent = ref('# Welcome to Obsidian-like Notes\n\nStart writing your notes here...')
// Sample notes data
const notes = ref({
  'Welcome.md': '# Welcome to Obsidian-like Notes\n\nStart writing your notes here...',
  'Getting Started.md': '# Getting Started\n\n1. Create a new note\n2. Write in Markdown\n3. See the preview',
  'Features.md': '# Features\n\n- Markdown editing\n- Live preview\n- File navigation'
})

// 添加菜单按钮
const addTableButton = ref(null)
const showTableMenu = ref(false)
const tableRows = ref(3)
const tableCols = ref(3)

// 创建表格
const createTable = () => {
  if (editor.value) {
    editor.value.chain().focus().insertTable({ rows: tableRows.value, cols: tableCols.value }).run()
    showTableMenu.value = false
  }
}

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
    // 添加表格扩展
    Table.configure({
      resizable: true,
    }),
    TableRow,
    TableHeader,
    TableCell,
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

// 表格操作函数
const addColumnBefore = () => {
  editor.value?.chain().focus().addColumnBefore().run()
}

const addColumnAfter = () => {
  editor.value?.chain().focus().addColumnAfter().run()
}

const deleteColumn = () => {
  editor.value?.chain().focus().deleteColumn().run()
}

const addRowBefore = () => {
  editor.value?.chain().focus().addRowBefore().run()
}

const addRowAfter = () => {
  editor.value?.chain().focus().addRowAfter().run()
}

const deleteRow = () => {
  editor.value?.chain().focus().deleteRow().run()
}

const deleteTable = () => {
  editor.value?.chain().focus().deleteTable().run()
}

const toggleTableMenu = () => {
  showTableMenu.value = !showTableMenu.value
}

// 点击外部关闭表格菜单
const closeTableMenu = (event) => {
  if (addTableButton.value && !addTableButton.value.contains(event.target) && showTableMenu.value) {
    showTableMenu.value = false
  }
}

// 编辑器工具栏功能
const setHeading = (level) => {
  editor.value?.chain().focus().toggleHeading({ level }).run()
}

const toggleBold = () => {
  editor.value?.chain().focus().toggleBold().run()
}

const toggleItalic = () => {
  editor.value?.chain().focus().toggleItalic().run()
}

const toggleStrike = () => {
  editor.value?.chain().focus().toggleStrike().run()
}

const toggleCode = () => {
  editor.value?.chain().focus().toggleCode().run()
}

const toggleCodeBlock = () => {
  editor.value?.chain().focus().toggleCodeBlock().run()
}

const toggleBulletList = () => {
  editor.value?.chain().focus().toggleBulletList().run()
}

const toggleOrderedList = () => {
  editor.value?.chain().focus().toggleOrderedList().run()
}

const toggleBlockquote = () => {
  editor.value?.chain().focus().toggleBlockquote().run()
}

const setHorizontalRule = () => {
  editor.value?.chain().focus().setHorizontalRule().run()
}

const undo = () => {
  editor.value?.chain().focus().undo().run()
}

const redo = () => {
  editor.value?.chain().focus().redo().run()
}

const setLink = () => {
  const url = window.prompt('URL')
  if (url) {
    editor.value?.chain().focus().setLink({ href: url }).run()
  } else {
    editor.value?.chain().focus().unsetLink().run()
  }
}

onMounted(() => {
  document.addEventListener('click', closeTableMenu)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', closeTableMenu)
})
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
          <div class="editor-actions">
            <!-- 表格按钮 -->
            <div class="table-menu-container" ref="addTableButton">
              <button @click="toggleTableMenu" class="action-btn">
                插入表格
              </button>
              <div v-if="showTableMenu" class="table-menu">
                <div class="table-menu-header">
                  <span>表格大小: {{ tableRows }}x{{ tableCols }}</span>
                </div>
                <div class="table-size-controls">
                  <div class="table-size-control">
                    <label>行数:</label>
                    <input type="number" v-model="tableRows" min="1" max="10" />
                  </div>
                  <div class="table-size-control">
                    <label>列数:</label>
                    <input type="number" v-model="tableCols" min="1" max="10" />
                  </div>
                </div>
                <button @click="createTable" class="create-table-btn">创建表格</button>

                <div class="table-operations" v-if="editor?.isActive('table')">
                  <div class="table-operation-group">
                    <button @click="addColumnBefore" class="table-op-btn">前插入列</button>
                    <button @click="addColumnAfter" class="table-op-btn">后插入列</button>
                    <button @click="deleteColumn" class="table-op-btn">删除列</button>
                  </div>
                  <div class="table-operation-group">
                    <button @click="addRowBefore" class="table-op-btn">前插入行</button>
                    <button @click="addRowAfter" class="table-op-btn">后插入行</button>
                    <button @click="deleteRow" class="table-op-btn">删除行</button>
                  </div>
                  <button @click="deleteTable" class="table-op-btn delete-table">删除表格</button>
                </div>
              </div>
            </div>

            <button @click="() => { saveLocalNote(); saveToWebDAV(); }" class="save-btn">保存</button>
          </div>
        </div>

        <!-- 编辑器工具栏 -->
        <div class="editor-toolbar">
          <button
            @click="setHeading(1)"
            :class="{ 'is-active': editor?.isActive('heading', { level: 1 }) }"
            class="toolbar-btn"
            title="标题1">
            H1
          </button>
          <button
            @click="setHeading(2)"
            :class="{ 'is-active': editor?.isActive('heading', { level: 2 }) }"
            class="toolbar-btn"
            title="标题2">
            H2
          </button>
          <button
            @click="setHeading(3)"
            :class="{ 'is-active': editor?.isActive('heading', { level: 3 }) }"
            class="toolbar-btn"
            title="标题3">
            H3
          </button>
          <span class="toolbar-divider"></span>
          <button
            @click="toggleBold"
            :class="{ 'is-active': editor?.isActive('bold') }"
            class="toolbar-btn"
            title="粗体">
            <strong>B</strong>
          </button>
          <button
            @click="toggleItalic"
            :class="{ 'is-active': editor?.isActive('italic') }"
            class="toolbar-btn"
            title="斜体">
            <em>I</em>
          </button>
          <button
            @click="toggleStrike"
            :class="{ 'is-active': editor?.isActive('strike') }"
            class="toolbar-btn"
            title="删除线">
            <s>S</s>
          </button>
          <button
            @click="toggleCode"
            :class="{ 'is-active': editor?.isActive('code') }"
            class="toolbar-btn"
            title="行内代码">
            <code>&lt;/&gt;</code>
          </button>
          <span class="toolbar-divider"></span>
          <button
            @click="toggleBulletList"
            :class="{ 'is-active': editor?.isActive('bulletList') }"
            class="toolbar-btn"
            title="无序列表">
            • 列表
          </button>
          <button
            @click="toggleOrderedList"
            :class="{ 'is-active': editor?.isActive('orderedList') }"
            class="toolbar-btn"
            title="有序列表">
            1. 列表
          </button>
          <button
            @click="toggleBlockquote"
            :class="{ 'is-active': editor?.isActive('blockquote') }"
            class="toolbar-btn"
            title="引用">
            "引用"
          </button>
          <button
            @click="toggleCodeBlock"
            :class="{ 'is-active': editor?.isActive('codeBlock') }"
            class="toolbar-btn"
            title="代码块">
            代码块
          </button>
          <span class="toolbar-divider"></span>
          <button
            @click="setLink"
            :class="{ 'is-active': editor?.isActive('link') }"
            class="toolbar-btn"
            title="链接">
            🔗
          </button>
          <button
            @click="setHorizontalRule"
            class="toolbar-btn"
            title="水平线">
            ―
          </button>
          <span class="toolbar-divider"></span>

          <!-- 表格操作按钮 -->
          <div class="table-toolbar-group" v-if="editor?.isActive('table')">
            <button
              @click="addRowBefore"
              class="toolbar-btn"
              title="在上方插入行">
              ↑行
            </button>
            <button
              @click="addRowAfter"
              class="toolbar-btn"
              title="在下方插入行">
              ↓行
            </button>
            <button
              @click="deleteRow"
              class="toolbar-btn"
              title="删除行">
              ✕行
            </button>
            <button
              @click="addColumnBefore"
              class="toolbar-btn"
              title="在左侧插入列">
              ←列
            </button>
            <button
              @click="addColumnAfter"
              class="toolbar-btn"
              title="在右侧插入列">
              →列
            </button>
            <button
              @click="deleteColumn"
              class="toolbar-btn"
              title="删除列">
              ✕列
            </button>
            <button
              @click="deleteTable"
              class="toolbar-btn delete-table-btn"
              title="删除表格">
              删除表格
            </button>
          </div>

          <span class="toolbar-divider" v-if="editor?.isActive('table')"></span>
          <button
            @click="undo"
            class="toolbar-btn"
            title="撤销">
            ↩
          </button>
          <button
            @click="redo"
            class="toolbar-btn"
            title="重做">
            ↪
          </button>
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

/* 编辑器工具栏 */
.editor-toolbar {
  padding: 5px 10px;
  background-color: #f9f9f9;
  border-bottom: 1px solid #ddd;
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  align-items: center;
}

.toolbar-btn {
  background-color: transparent;
  border: 1px solid #ddd;
  border-radius: 3px;
  padding: 5px 8px;
  font-size: 14px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 30px;
}

.toolbar-btn:hover {
  background-color: #f0f0f0;
}

.toolbar-btn.is-active {
  background-color: #e6f7ff;
  border-color: #91d5ff;
  color: #1890ff;
}

.toolbar-divider {
  width: 1px;
  height: 20px;
  background-color: #ddd;
  margin: 0 5px;
}

/* 表格工具栏 */
.table-toolbar-group {
  display: flex;
  gap: 5px;
}

.delete-table-btn {
  background-color: #fff1f0;
  border-color: #ffa39e;
  color: #ff4d4f;
}

.delete-table-btn:hover {
  background-color: #ff4d4f;
  border-color: #ff4d4f;
  color: white;
}

.editor-actions {
  display: flex;
  gap: 0.5rem;
}

.save-btn, .action-btn {
  background-color: #4CAF50;
  color: white;
  border: none;
  padding: 5px 10px;
  border-radius: 3px;
  cursor: pointer;
}

.action-btn {
  background-color: #2196F3;
}

.save-btn:hover {
  background-color: #45a049;
}

.action-btn:hover {
  background-color: #0b7dda;
}

.markdown-editor-container {
  flex: 1;
  width: 100%;
  height: 100%;
  overflow: auto;
}

/* 表格菜单样式 */
.table-menu-container {
  position: relative;
}

.table-menu {
  position: absolute;
  top: 100%;
  right: 0;
  background-color: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 10px;
  z-index: 1000;
  width: 200px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.table-menu-header {
  margin-bottom: 10px;
  font-weight: bold;
  text-align: center;
}

.table-size-controls {
  display: flex;
  justify-content: space-between;
  margin-bottom: 10px;
}

.table-size-control {
  display: flex;
  flex-direction: column;
  width: 45%;
}

.table-size-control input {
  width: 100%;
  padding: 5px;
  border: 1px solid #ddd;
  border-radius: 3px;
}

.create-table-btn {
  width: 100%;
  background-color: #4CAF50;
  color: white;
  border: none;
  padding: 5px;
  border-radius: 3px;
  cursor: pointer;
  margin-bottom: 10px;
}

.create-table-btn:hover {
  background-color: #45a049;
}

.table-operations {
  border-top: 1px solid #eee;
  padding-top: 10px;
}

.table-operation-group {
  display: flex;
  justify-content: space-between;
  margin-bottom: 5px;
}

.table-op-btn {
  background-color: #f1f1f1;
  border: 1px solid #ddd;
  padding: 3px 5px;
  border-radius: 3px;
  cursor: pointer;
  font-size: 12px;
  flex: 1;
  margin: 0 2px;
}

.table-op-btn:hover {
  background-color: #e1e1e1;
}

.delete-table {
  width: 100%;
  background-color: #ff5252;
  color: white;
  margin-top: 5px;
}

.delete-table:hover {
  background-color: #ff0000;
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

/* 表格样式 */
.wysiwyg-editor table {
  border-collapse: collapse;
  margin: 1em 0;
  overflow: hidden;
  width: 100%;
}

.wysiwyg-editor table td,
.wysiwyg-editor table th {
  border: 1px solid #ddd;
  padding: 8px;
  position: relative;
}

.wysiwyg-editor table th {
  background-color: #f2f2f2;
  font-weight: bold;
  text-align: left;
}

.wysiwyg-editor table tr:nth-child(even) {
  background-color: #f9f9f9;
}

.wysiwyg-editor table tr:hover {
  background-color: #f5f5f5;
}

.wysiwyg-editor .selectedCell {
  background-color: rgba(200, 200, 255, 0.4);
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
.editor-content {
  height: calc(100% - 6rem);
  position: relative;
}
</style>
