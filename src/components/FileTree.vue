<script setup>
import { ref } from 'vue'

const props = defineProps({
  modelValue: String
})

const emit = defineEmits(['update:modelValue'])

const files = ref([
  { name: 'Welcome.md', path: 'Welcome.md' },
  { name: 'Getting Started.md', path: 'Getting Started.md' },
  { name: 'Features.md', path: 'Features.md' }
])

const selectFile = (file) => {
  emit('update:modelValue', file.path)
}
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