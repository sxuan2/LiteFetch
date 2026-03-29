<template>
  <div v-for="(item, index) in items" :key="item._id" class="tree-node">
    
    <details v-if="item.item" :open="store.expandedFolders.includes(item._id)" @toggle="onToggle(item._id, $event)">
      <summary class="folder-summary" @contextmenu.prevent="showContextMenu($event, 'folder', item, items, index)">
        <span class="folder-arrow" :class="{ 'is-open': store.expandedFolders.includes(item._id) }">▸</span>
        <span class="folder-name">{{ item.info?.name || item.name }}</span>
      </summary>
      <div class="folder-content">
        <SidebarTree :items="item.item" />
      </div>
    </details>

    <div v-else class="nav-item" :class="{ active: store.activeRequest && store.activeRequest._id === item._id }" 
         @click="store.openTab(item)" 
         @contextmenu.prevent="showContextMenu($event, 'request', item, items, index)">
      <span class="sidebar-method" :style="{ color: getMethodColor(item.request?.method) }">{{ item.request?.method || 'GET' }}</span>
      <span class="sidebar-req-name">{{ item.name }}</span>
    </div>

  </div>
</template>

<script setup>
import { inject } from 'vue'
import { useCollectionStore } from '../store'

defineProps({ items: Array })
const store = useCollectionStore()
const showContextMenu = inject('showContextMenu')

const onToggle = (id, e) => {
  if (e.target.open) { if (!store.expandedFolders.includes(id)) store.expandedFolders.push(id) }
  else { store.expandedFolders = store.expandedFolders.filter(x => x !== id) }
  store.persistExpandedFolders()
}

const getMethodColor = (method) => {
  const colors = { GET: '#0cbb52', POST: '#ff6c37', PUT: '#097bed', DELETE: '#ea2027', PATCH: '#f1c40f' }
  return colors[method] || '#909399'
}
</script>

<style scoped>
/* 隐藏原生极丑的箭头 */
summary { list-style: none; outline: none; }
summary::-webkit-details-marker { display: none; }

.folder-summary {
  cursor: pointer; padding: 6px 8px; border-radius: 4px;
  display: flex; align-items: center; font-size: 13px; color: #cfd3dc; transition: background 0.2s;
}
.folder-summary:hover { background: #2b2b2c; }

/* 优雅的箭头样式及动画 */
.folder-arrow {
  font-size: 15px; margin-right: 6px; color: #888;
  transition: transform 0.2s ease; display: inline-block;
}
.folder-arrow.is-open {
  transform: rotate(90deg); color: #cfd3dc;
}

.folder-name { font-weight: bold; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.folder-content { margin-left: 12px; border-left: 1px solid #414243; padding-left: 4px; margin-top: 2px; }

/* 请求项样式 */
.nav-item { padding: 6px 8px; margin: 2px 0; border-radius: 0 4px 4px 0; display: flex; align-items: center; cursor: pointer; font-size: 13px; color: #a3a6ad; border-left: 3px solid transparent; transition: background 0.1s; }
.nav-item:hover { background: #2b2b2c; }
.nav-item.active { background-color: #2b2b2c; color: #fff; border-left: 3px solid #ff6c37; }
.sidebar-method { width: 50px; font-size: 11px; font-weight: bold; flex-shrink: 0; }
.sidebar-req-name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
</style>