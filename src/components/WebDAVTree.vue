<template>
  <div class="webdav-tree">
    <div v-if="loading" class="loading">Loading...</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <ul v-else>
      <li v-for="item in treeData" :key="item.filename">
        <div @click="toggleExpand(item)">
          <span v-if="item.type === 'directory'">
            {{ item.expanded ? '📂' : '📁' }} {{ item.filename }}
          </span>
          <span v-else @click="loadFile(item)">
            📄 {{ item.filename }}
          </span>
        </div>
        <WebDAVTree v-if="item.type === 'directory' && item.expanded" :rootPath="item.filename" :key="item.filename" />
      </li>
    </ul>
  </div>
</template>

<script>
import { getDirectoryContents } from '../utils/webdavService'

export default {
  name: 'WebDAVTree',
  props: {
    rootPath: {
      type: String,
      default: '/'
    }
  },
  data() {
    return {
      treeData: [],
      loading: false,
      error: null
    }
  },
  async mounted() {
    await this.loadContents()
  },
  methods: {
    async loadContents() {
      this.loading = true
      try {
        this.treeData = await getDirectoryContents(this.rootPath)
        this.treeData.forEach(item => {
          if (item.type === 'directory') {
            this.$set(item, 'expanded', false)
          }
        })
      } catch (err) {
        this.error = err.message
      } finally {
        this.loading = false
      }
    },
    toggleExpand(item) {
      if (item.type === 'directory') {
        item.expanded = !item.expanded
      }
    },
    async loadFile(item) {
      this.$emit('file-selected', item)
    }
  }
}
</script>

<style scoped>
.webdav-tree {
  padding-left: 1rem;
}

.loading,
.error {
  padding: 0.5rem;
  color: #666;
}

li {
  list-style: none;
  cursor: pointer;
  padding: 0.2rem 0;
}

li:hover {
  background-color: #f0f0f0;
}
</style>