<script setup>
import { ref, onMounted, inject } from 'vue'

const props = defineProps({
  modelValue: String
})

const emit = defineEmits(['update:modelValue', 'update'])

const files = ref([])
const isLoading = ref(false)
const error = ref(null)

const webdavClient = inject('webdav')

const loadFiles = async () => {
  try {
    isLoading.value = true
    error.value = null

    const config = JSON.parse(localStorage.getItem('webdavConfig'))
    if (!config) {
      error.value = 'WebDAV configuration not found. Please configure first.'
      return
    }

    if (!webdavClient) {
      error.value = 'WebDAV client not available'
      return
    }

    const items = await webdavClient.getDirectoryContents(config.directory)
    files.value = items
      .filter(item => item.type === 'file' && item.basename.endsWith('.md'))
      .map(item => ({
        name: item.basename,
        path: `${config.directory}/${item.basename}`
      }))

    if (files.value.length > 0 && !props.modelValue) {
      emit('update:modelValue', files.value[0].path)
    }
  } catch (err) {
    error.value = `Failed to load files: ${err.message}`
    console.error(err)
  } finally {
    isLoading.value = false
  }
}

const selectFile = (file) => {
  emit('update:modelValue', file.path)
  emit('update', file.path)
}

onMounted(loadFiles)
</script>

<template>
  <div class="file-tree">
    <div class="header">Notes</div>
    <ul>
      <li v-for="file in files" :key="file.path" :class="{ active: modelValue === file.path }"
        @click="selectFile(file)">
        {{ file.name }}
      </li>
    </ul>
  </div>
</template>

<style scoped>
.file-tree {
  padding: 10px;
}

.header {
  font-weight: bold;
  margin-bottom: 10px;
  padding: 5px;
  border-bottom: 1px solid #ddd;
}

ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

li {
  padding: 5px 10px;
  cursor: pointer;
  border-radius: 3px;
}

li:hover {
  background-color: #e0e0e0;
}

li.active {
  background-color: #d0d0d0;
  font-weight: bold;
}
</style>