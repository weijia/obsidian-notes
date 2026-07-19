<script setup>
import { ref, computed, provide, onMounted, onBeforeUnmount } from 'vue'

// 响应式布局：桌面端分栏，移动端单面板
const isMobile = ref(window.innerWidth < 768)
const onResize = () => { isMobile.value = window.innerWidth < 768 }
onMounted(() => { window.addEventListener('resize', onResize) })
onBeforeUnmount(() => { window.removeEventListener('resize', onResize) })

// 浏览器返回按钮：从编辑器回到文件列表
const onPopState = () => {
  if (currentView.value === 'editor' && isMobile.value) {
    goBackToFiles()
  }
}
onMounted(() => { window.addEventListener('popstate', onPopState) })
onBeforeUnmount(() => { window.removeEventListener('popstate', onPopState) })

import DOMPurify from 'dompurify'
import { RouterView, useRouter } from 'vue-router'
import FileTree from './components/FileTree.vue'
import UpdateToast from './components/UpdateToast.vue'
import { marked } from 'marked'
import { versionDisplay, buildTimeDisplay } from './version.js'

// 当前视图状态：'files' 文件列表 | 'editor' 编辑器
const currentView = ref('files')
// 记住进入编辑器前的目录路径，点击"文件"按钮时恢复
const previousDirPath = ref(null)

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

const activeNote = ref(localStorage.getItem('lastOpenedFile') || 'Welcome.md')
const markdownContent = ref('# Welcome to Obsidian-like Notes\n\nStart writing your notes here...')
const originalContent = ref('') // 加载文件时的原始内容，用于比对是否修改

// 保存上次打开的文件和目录
const saveLastOpenedFile = () => {
  if (activeNote.value) {
    localStorage.setItem('lastOpenedFile', activeNote.value)
  }
  const backend = storageStore.backend
  if (backend && backend.currentPath) {
    localStorage.setItem('lastOpenedPath', backend.currentPath)
  }
}

// 是否有未保存的修改
const isDirty = computed(() => markdownContent.value !== originalContent.value)

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

// Update content when active note changes
const updateContent = async (newNote) => {
  activeNote.value = newNote
  saveLastOpenedFile()
  // 记住当前目录路径，以便返回时恢复（仅移动端）
  if (isMobile.value) {
    previousDirPath.value = storageStore.backend.currentPath
    currentView.value = 'editor'
    history.pushState({ view: 'editor' }, '')
  }

  // First check local notes
  if (notes.value[newNote]) {
    markdownContent.value = notes.value[newNote]
    originalContent.value = notes.value[newNote]
    // 将Markdown转换为HTML，然后设置为编辑器内容
    const html = marked(notes.value[newNote])
    editor.value?.commands.setContent(html)
    return
  }

  // Try to fetch from storage if available
  if (storageStore.isConnected) {
    try {
      const content = await storageStore.readFile(newNote)
      notes.value[newNote] = content
      markdownContent.value = content
      originalContent.value = content
      // 将Markdown转换为HTML，然后设置为编辑器内容
      const html = marked(content)
      editor.value?.commands.setContent(html)
    } catch (e) {
      console.error('从存储加载失败:', e)
      const errorContent = `# 加载 ${newNote} 出错\n\n文件在本地或存储服务器上未找到`
      markdownContent.value = errorContent
      originalContent.value = errorContent
      // 将Markdown转换为HTML，然后设置为编辑器内容
      const html = marked(errorContent)
      editor.value?.commands.setContent(html)
    }
  } else {
    const notFoundContent = notes.value[newNote] || `# ${newNote}\n\n文件未找到`
    markdownContent.value = notFoundContent
    originalContent.value = notFoundContent
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

// Save content to storage
const saveToStorage = async () => {
  if (!activeNote.value || !storageStore.isConnected) return

  try {
    await storageStore.writeFile(activeNote.value, markdownContent.value)
    originalContent.value = markdownContent.value
    console.log('成功保存到存储')
  } catch (e) {
    console.error('保存到存储失败:', e)
  }
}

import { useStorageStore } from '@/stores/storage'
const storageStore = useStorageStore()

// Initialize storage connection from saved config
onMounted(async () => {
  document.addEventListener('click', closeTableMenu)
  // 恢复上次打开的目录路径
  const savedPath = localStorage.getItem('lastOpenedPath')
  try {
    const type = storageStore.storageType
    if (type === 'gitee') {
      const savedConfig = localStorage.getItem('gitee_config')
      if (savedConfig) {
        const config = JSON.parse(savedConfig)
        if (config.token && config.owner && config.repo) {
          const connected = await storageStore.connect(config.token, config.owner, config.repo, config.branch)
          if (connected) {
            const b = storageStore.backend
            const targetPath = savedPath || b.currentPath || b.basePath
            await b.getDirectoryContents(targetPath)
          }
        }
      }
    } else {
      const savedConfig = localStorage.getItem('webdavConfig')
      if (savedConfig) {
        const config = JSON.parse(savedConfig)
        if (config.serverUrl && config.username && config.password) {
          const connected = await storageStore.connect(config.serverUrl, config.username, config.password)
          if (connected) {
            const b = storageStore.backend
            const targetPath = savedPath || b.currentPath || b.basePath
            await b.getDirectoryContents(targetPath)
          }
        }
      }
    }
  } catch (e) {
    console.error('初始化存储连接失败:', e)
  }
})

provide('storage', storageStore)

const router = useRouter()
// 从编辑器返回文件列表，恢复到之前的目录
const goBackToFiles = async () => {
  const backend = storageStore.backend
  if (previousDirPath.value && backend.currentPath !== previousDirPath.value) {
    backend.currentPath = previousDirPath.value
    await storageStore.getDirectoryContents(previousDirPath.value)
  }
  previousDirPath.value = null
  currentView.value = 'files'
}

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

// 在组件卸载前销毁编辑器
onBeforeUnmount(() => {
  document.removeEventListener('click', closeTableMenu)
  editor.value?.destroy()
})
</script>

<template>
  <div class="app-container">
    <!-- 主内容区域 -->
    <div class="main-content">
      <!-- 非首页路由 (config, about 等) -->
      <div v-if="$route.path !== '/'" class="route-page">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </div>

      <!-- 首页: 文件列表 / 编辑器 视图切换 -->
      <template v-else>
        <!-- 移动端：单面板切换模式 -->
        <template v-if="isMobile">
          <!-- 文件列表视图 -->
          <div class="files-view" :class="{ 'view-hidden': currentView !== 'files' }">
            <div class="files-header">
              <span class="view-title">笔记</span>
              <span class="version-badge" v-if="versionDisplay">v{{ versionDisplay }}</span>
              <button @click="navigateToConfig" class="config-btn">
                配置
              </button>
            </div>
            <div class="files-tree-wrapper">
              <FileTree :key="storageStore.backend.currentPath" v-model="activeNote" @update="updateContent" />
            </div>
          </div>

          <!-- 编辑器视图 -->
          <div class="editor" :class="{ 'view-hidden': currentView !== 'editor' }">
            <div class="editor-header">
              <span class="editor-title">{{ activeNote }}</span>
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

                <button :disabled="!isDirty" @click="() => { saveLocalNote(); saveToStorage(); }" class="save-btn" :class="{ disabled: !isDirty }">保存</button>
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
        </template>

        <!-- 桌面端：左右分栏布局 -->
        <div v-if="!isMobile" class="desktop-layout">
          <!-- 左侧文件列表 -->
          <div class="desktop-sidebar">
            <div class="files-header">
              <span class="view-title">笔记</span>
              <span class="version-badge" v-if="versionDisplay">v{{ versionDisplay }}</span>
              <button @click="navigateToConfig" class="config-btn">配置</button>
            </div>
            <div class="desktop-sidebar-content">
              <FileTree :key="storageStore.backend.currentPath" v-model="activeNote" @update="updateContent" />
            </div>
          </div>
          <!-- 分隔线 -->
          <div class="desktop-resizer"></div>
          <!-- 右侧编辑器 -->
          <div class="desktop-editor">
            <div class="editor-header">
              <span class="editor-title">{{ activeNote }}</span>
              <div class="editor-actions">
                <div class="table-menu-container" ref="addTableButton">
                  <button @click="toggleTableMenu" class="action-btn">插入表格</button>
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
                <button :disabled="!isDirty" @click="() => { saveLocalNote(); saveToStorage(); }" class="save-btn" :class="{ disabled: !isDirty }">保存</button>
              </div>
            </div>
            <!-- 编辑器工具栏 -->
            <div class="editor-toolbar">
              <button @click="setHeading(1)" :class="{ 'is-active': editor?.isActive('heading', { level: 1 }) }" class="toolbar-btn" title="标题1">H1</button>
              <button @click="setHeading(2)" :class="{ 'is-active': editor?.isActive('heading', { level: 2 }) }" class="toolbar-btn" title="标题2">H2</button>
              <button @click="setHeading(3)" :class="{ 'is-active': editor?.isActive('heading', { level: 3 }) }" class="toolbar-btn" title="标题3">H3</button>
              <span class="toolbar-divider"></span>
              <button @click="toggleBold" :class="{ 'is-active': editor?.isActive('bold') }" class="toolbar-btn" title="粗体"><strong>B</strong></button>
              <button @click="toggleItalic" :class="{ 'is-active': editor?.isActive('italic') }" class="toolbar-btn" title="斜体"><em>I</em></button>
              <button @click="toggleStrike" :class="{ 'is-active': editor?.isActive('strike') }" class="toolbar-btn" title="删除线"><s>S</s></button>
              <button @click="toggleCode" :class="{ 'is-active': editor?.isActive('code') }" class="toolbar-btn" title="行内代码"><code>&lt;/&gt;</code></button>
              <span class="toolbar-divider"></span>
              <button @click="toggleBulletList" :class="{ 'is-active': editor?.isActive('bulletList') }" class="toolbar-btn" title="无序列表">• 列表</button>
              <button @click="toggleOrderedList" :class="{ 'is-active': editor?.isActive('orderedList') }" class="toolbar-btn" title="有序列表">1. 列表</button>
              <button @click="toggleBlockquote" :class="{ 'is-active': editor?.isActive('blockquote') }" class="toolbar-btn" title="引用">"引用"</button>
              <button @click="toggleCodeBlock" :class="{ 'is-active': editor?.isActive('codeBlock') }" class="toolbar-btn" title="代码块">代码块</button>
              <span class="toolbar-divider"></span>
              <button @click="setLink" :class="{ 'is-active': editor?.isActive('link') }" class="toolbar-btn" title="链接">🔗</button>
              <button @click="setHorizontalRule" class="toolbar-btn" title="水平线">―</button>
              <span class="toolbar-divider"></span>
              <div class="table-toolbar-group" v-if="editor?.isActive('table')">
                <button @click="addRowBefore" class="toolbar-btn" title="在上方插入行">↑行</button>
                <button @click="addRowAfter" class="toolbar-btn" title="在下方插入行">↓行</button>
                <button @click="deleteRow" class="toolbar-btn" title="删除行">✕行</button>
                <button @click="addColumnBefore" class="toolbar-btn" title="在左侧插入列">←列</button>
                <button @click="addColumnAfter" class="toolbar-btn" title="在右侧插入列">→列</button>
                <button @click="deleteColumn" class="toolbar-btn" title="删除列">✕列</button>
                <button @click="deleteTable" class="toolbar-btn delete-table-btn" title="删除表格">删除表格</button>
              </div>
              <span class="toolbar-divider" v-if="editor?.isActive('table')"></span>
              <button @click="undo" class="toolbar-btn" title="撤销">↩</button>
              <button @click="redo" class="toolbar-btn" title="重做">↪</button>
            </div>
            <div class="editor-content">
              <div class="markdown-editor-container">
                <EditorContent :editor="editor" class="tiptap-editor" />
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- 底部导航栏 (仅移动端首页显示) -->
    <nav v-if="$route.path === '/' && isMobile" class="bottom-nav">
      <button
        class="nav-btn"
        :class="{ active: currentView === 'files' }"
        @click="goBackToFiles"
      >
        <span class="nav-icon">📁</span>
        <span class="nav-label">文件</span>
      </button>
      <button
        class="nav-btn"
        :class="{ active: currentView === 'editor' }"
        @click="currentView = 'editor'"
      >
        <span class="nav-icon">✏️</span>
        <span class="nav-label">编辑</span>
      </button>
    </nav>
    <UpdateToast />
  </div>
</template>

<style>
.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
}

.main-content {
  flex: 1;
  position: relative;
  overflow: hidden;
}

/* 路由页面 (config, about) */
.route-page {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow: auto;
}

/* 文件列表视图 */
.files-view {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  background-color: #ffffff;
  transition: opacity 0.25s ease, transform 0.25s ease;
  z-index: 2;
}

.files-header {
  padding: 12px 15px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: #f5f5f5;
  border-bottom: 1px solid #ddd;
  flex-shrink: 0;
}

.view-title {
  font-weight: 600;
  font-size: 1.1em;
  color: #333;
}

.config-btn {
  padding: 6px 14px;
  background: #646cff;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9em;
  transition: background-color 0.2s;
}

.config-btn:hover {
  background: #535bf2;
}

.files-tree-wrapper {
  flex: 1 1 auto;
  overflow-y: auto;
  min-height: 0;
}

/* 视图隐藏状态 */
.view-hidden {
  opacity: 0;
  pointer-events: none;
}

.files-view.view-hidden {
  transform: translateX(-15px);
  z-index: 1;
}

.editor.view-hidden {
  transform: translateX(15px);
  z-index: 1;
}

/* 底部导航栏 */
.bottom-nav {
  display: flex;
  height: 56px;
  background-color: #1e1e1e;
  border-top: 1px solid #333;
  flex-shrink: 0;
  z-index: 100;
}

.nav-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: #888;
  cursor: pointer;
  gap: 2px;
  transition: color 0.2s;
  padding: 6px 0;
}

.nav-btn:hover {
  color: #ccc;
}

.nav-btn.active {
  color: #646cff;
}

.nav-icon {
  font-size: 1.3em;
  line-height: 1;
}

.nav-label {
  font-size: 0.7em;
  line-height: 1;
}

/* 编辑器 */
.editor {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  background-color: #ffffff;
  transition: opacity 0.25s ease, transform 0.25s ease;
  z-index: 2;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  line-height: 1.6;
  color: #333;
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

.editor-title {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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

.save-btn.disabled,
.save-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  background-color: #4CAF50;
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

/* 桌面端左右分栏布局 */
.desktop-layout {
  display: flex;
  height: 100%;
  width: 100%;
}

.desktop-sidebar {
  width: 280px;
  min-width: 200px;
  max-width: 500px;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #ddd;
  background-color: #fafafa;
  flex-shrink: 0;
}

.desktop-sidebar-content {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.desktop-resizer {
  width: 3px;
  background-color: #e0e0e0;
  cursor: col-resize;
  flex-shrink: 0;
  transition: background-color 0.2s;
}

.desktop-resizer:hover {
  background-color: #646cff;
}

.desktop-editor {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background-color: #ffffff;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  line-height: 1.6;
  color: #333;
}
</style>

<style scoped>
.editor-content {
  flex: 1;
  position: relative;
  min-height: 0;
  overflow: hidden;
}

.version-badge {
  font-size: 0.7em;
  color: #999;
  background: #f0f0f0;
  padding: 1px 6px;
  border-radius: 8px;
  margin-left: 8px;
}
</style>
