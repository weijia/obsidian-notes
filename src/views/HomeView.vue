<script setup>
import { ref, computed } from 'vue'
import FileTree from '@/components/FileTree.vue'
import { useWebDAVStore } from '@/stores/webdav'

const webdav = useWebDAVStore()
const currentFile = ref('')
const content = ref('')
const isLoading = ref(false)
const error = ref(null)

const onFileSelect = (filePath) => {
  currentFile.value = filePath
  loadFileContent(filePath)
}

const loadFileContent = async (filePath) => {
  try {
    isLoading.value = true
    error.value = null
    content.value = await webdav.getFileContents(filePath)
  } catch (err) {
    error.value = `Failed to load file: ${err.message}`
    console.error(err)
  } finally {
    isLoading.value = false
  }
}

const saveFile = async () => {
  if (!currentFile.value) return

  try {
    isLoading.value = true
    error.value = null
    await webdav.putFileContents(currentFile.value, content.value)
  } catch (err) {
    error.value = `Failed to save file: ${err.message}`
    console.error(err)
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <main class="home-container">
  </main>
</template>

<style scoped>
.home-container {
  display: flex;
  height: calc(100vh - 60px);
}

.file-tree {
  width: 250px;
  border-right: 1px solid #e0e0e0;
  height: 100%;
  overflow-y: auto;
}

.editor-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 20px;
}

.markdown-editor {
  flex: 1;
  width: 100%;
  padding: 15px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  font-family: monospace;
  font-size: 16px;
  resize: none;
  margin-bottom: 10px;
}

.save-button {
  align-self: flex-end;
  padding: 8px 16px;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.save-button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.error-message {
  color: #f44336;
  margin-bottom: 10px;
}
</style>