<script setup>
import { ref, computed } from 'vue'
import { RouterView } from 'vue-router'
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
const updateContent = (newNote) => {
  activeNote.value = newNote
  markdownContent.value = notes.value[newNote] || ''
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
</script>

<template>
  <div class="app-container">
    <!-- Left sidebar - File navigation -->
    <div class="sidebar">
      <FileTree v-model:activeNote="activeNote" @update:modelValue="updateContent" />
    </div>

    <!-- Main editor area -->
    <div class="editor">
      <div class="editor-header">
        <span>{{ activeNote }}</span>
        <button @click="saveNote" class="save-btn">Save</button>
      </div>
      <textarea v-model="markdownContent" class="markdown-editor" placeholder="Write your markdown here..."
        @input="saveNote"></textarea>
    </div>

    <!-- Right sidebar - Preview -->
    <div class="preview">
      <div class="markdown-preview" v-html="markdownPreview"></div>
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

.editor {
  flex: 1;
  display: flex;
  flex-direction: column;
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

.preview {
  width: 300px;
  background-color: #f9f9f9;
  border-left: 1px solid #ddd;
  overflow-y: auto;
  padding: 15px;
}

.markdown-preview {
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