<template>
  <div id="app-container" @click="hideAllMenus">
    
    <div id="sidebar" :style="{ width: sidebarWidth + 'px' }">
      <div class="sidebar-header" style="display: flex; flex-direction: column; gap: 10px; padding: 12px 15px;">
        <div style="display: flex; gap: 6px; width: 100%;">
          <el-button type="primary" style="flex: 1; font-weight: bold; margin: 0; padding: 0;" @click="addNewCollection">
            + Collection
          </el-button>
          <el-button color="#ff6c37" style="color: white; font-weight: bold; flex: 1; margin: 0; padding: 0;" @click="importCollection">
            + Postman
          </el-button>
        </div>
        
        <div style="display: flex; gap: 6px; width: 100%;">
          <el-button size="small" type="primary" plain style="flex: 1; margin: 0; padding: 0;" @click="showHistory = true">History</el-button>
          <el-button size="small" type="success" plain style="flex: 1; margin: 0; padding: 0;" @click="exportLiteFetch">Export</el-button>
          <el-button size="small" type="warning" plain style="flex: 1; margin: 0; padding: 0;" @click="importLiteFetch">Restore</el-button>
        </div>
      </div>

      <div id="collection-repo">
        <details v-for="(col, index) in store.collections" :key="col._id" :open="store.expandedFolders.includes(col._id)" @toggle="onToggle(col._id, $event)">
          <summary class="folder-summary top-level-summary" style="color:var(--el-color-primary); font-weight:bold; padding: 8px 6px;" @contextmenu.prevent="showContextMenu($event, 'collection', col, store.collections, index)">
            <span class="folder-arrow" :class="{ 'is-open': store.expandedFolders.includes(col._id) }">▸</span>
            <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{{ col.info?.name || 'Collection' }}</span>
          </summary>
          <div class="folder-content">
            <SidebarTree :items="col.item || []" />
          </div>
        </details>
      </div>
    </div> <div class="resizer-h" @mousedown="startResizeSidebar"></div>

    <div id="main-editor">
      <div v-if="!store.activeRequest" id="empty-state">
        <div style="font-size: 28px; color: var(--el-color-primary); font-weight: bold; margin-bottom: 10px;">LiteFetch</div>
        <el-text type="info">Select or create a request from the sidebar to start</el-text>
      </div>

      <div v-else id="editor-top">
        <el-tabs v-model="store.activeTabId" type="card" class="custom-editor-tabs" @tab-remove="closeSingleTab">
          <el-tab-pane v-for="tab in store.openTabs" :key="tab._id" :name="tab._id" closable>
            <template #label>
              <div @contextmenu.prevent="showTabMenu($event, tab._id)" style="display:inline-flex; align-items:center;">
                <span v-if="store.isTabDirty(tab._id)" class="dirty-dot"></span>
                <span v-if="tab.pinned" style="margin-right:6px; font-size: 12px;">📌</span>
                <span :style="{ color: getMethodColor(tab.method), fontSize: '12px', fontWeight: 'bold', marginRight: '8px' }">{{ tab.method || 'REQ' }}</span>
                <span style="font-size: 13px;">{{ tab.name }}</span>
              </div>
            </template>
          </el-tab-pane>
        </el-tabs>

        <div class="url-bar">
          <el-select v-model="store.activeRequest.request.method" :class="['method-select', (store.activeRequest.request.method || 'GET').toLowerCase()]" style="width: 110px;" popper-class="dark-method-popper">
            <el-option label="GET" value="GET"><span style="color: #0cbb52; font-weight: bold;">GET</span></el-option>
            <el-option label="POST" value="POST"><span style="color: #ff6c37; font-weight: bold;">POST</span></el-option>
            <el-option label="PUT" value="PUT"><span style="color: #097bed; font-weight: bold;">PUT</span></el-option>
            <el-option label="DELETE" value="DELETE"><span style="color: #ea2027; font-weight: bold;">DELETE</span></el-option>
            <el-option label="PATCH" value="PATCH"><span style="color: #f1c40f; font-weight: bold;">PATCH</span></el-option>
          </el-select>
          <el-input 
            v-model="store.activeRequest.request.url" 
            class="url-input"
            placeholder="Enter request URL..." 
            clearable
            @blur="store.extractUrlVariables" 
            @keyup.enter="sendRequest"
          />
          <el-button color="#ff6c37" size="large" style="color: white; font-weight: bold; width: 90px; margin: 0;" @click="sendRequest">
            Send
          </el-button>
          <el-button type="success" size="large" plain :disabled="!store.isTabDirty(store.activeTabId)" @click="saveDraft(store.activeTabId)" style="font-weight: bold; width: 90px; margin: 0; margin-left: 5px;">
            Save
          </el-button>
        </div>

        <div class="tab-content-wrapper">
          <el-tabs v-model="currentTab" class="config-tabs">
            <el-tab-pane label="Headers" name="headers">
              <div class="pane-container">
                <el-table :data="store.activeRequest.request.header" border style="width: 100%" size="small">
                  <el-table-column width="60" align="center"><template #default="scope"><el-checkbox v-model="scope.row.enabled"></el-checkbox></template></el-table-column>
                  <el-table-column label="Key" min-width="150" resizable><template #default="scope"><el-input v-model="scope.row.key" placeholder="Key" size="small" clearable></el-input></template></el-table-column>
                  <el-table-column label="Value" min-width="250" resizable><template #default="scope"><el-input v-model="scope.row.value" placeholder="Value" size="small" clearable></el-input></template></el-table-column>
                  <el-table-column width="80" align="center"><template #default="scope"><el-button type="danger" link @click="store.activeRequest.request.header.splice(scope.$index, 1)">Delete</el-button></template></el-table-column>
                </el-table>
                <el-button style="margin-top: 15px;" @click="store.activeRequest.request.header.push({key:'', value:'', enabled:true})">+ Add Header</el-button>
              </div>
            </el-tab-pane>

            <el-tab-pane label="Body" name="body">
              <div class="pane-container">
                <el-input v-model="store.activeRequest.request.body.raw" type="textarea" :rows="12" placeholder="Enter request body here..." style="font-family: monospace;" />
              </div>
            </el-tab-pane>

            <el-tab-pane label="Variables" name="vars">
              <div class="pane-container">
                <el-alert v-if="store.hasConflict" title="Conflict Warning!" type="error" show-icon style="margin-bottom: 15px;" />
                <el-text tag="b" style="margin-bottom: 8px; display: block;">Static Variables</el-text>
                <el-table :data="store.activeCollection?.variables" border style="width: 100%; margin-bottom: 15px;" size="small">
                  <el-table-column label="Key" min-width="150" resizable><template #default="scope"><el-input v-model="scope.row.key" placeholder="Key" size="small"></el-input></template></el-table-column>
                  <el-table-column label="Value" min-width="250" resizable><template #default="scope"><el-input v-model="scope.row.value" placeholder="Value" size="small"></el-input></template></el-table-column>
                  <el-table-column width="80" align="center"><template #default="scope"><el-button type="danger" link @click="store.activeCollection.variables.splice(scope.$index, 1)">Delete</el-button></template></el-table-column>
                </el-table>
                <el-button style="margin-bottom: 25px;" @click="store.activeCollection?.variables.push({key:'', value:''})">+ Add Variable</el-button>
                
                <el-text tag="b" type="primary" style="margin-bottom: 8px; display: block;">Dynamic Variables (Python Injected)</el-text>
                <el-table :data="dynamicVarsList" border style="width: 100%" size="small" empty-text="No dynamic variables currently injected.">
                  <el-table-column prop="key" label="Key" min-width="150" resizable>
                    <template #default="scope"><span style="color:#409EFF; font-weight:bold;">{{ scope.row.key }}</span></template>
                  </el-table-column>
                  <el-table-column prop="value" label="Value" min-width="250" resizable>
                    <template #default="scope"><div style="background:#2b2b2c; padding:2px 6px; border-radius:4px; font-family:monospace; font-size:12px; color: #cfd3dc;">{{ scope.row.value }}</div></template>
                  </el-table-column>
                </el-table>
              </div>
            </el-tab-pane>

            <el-tab-pane label="Python Script" name="python">
              <div class="pane-container" style="max-width: 800px;">
                <div style="display:flex; gap:10px; margin-bottom:15px;">
                  <el-input v-model="store.pythonExePath" readonly placeholder="Python Exe Path" style="flex: 1;" />
                  <el-button @click="selectPython('exe')">Browse...</el-button>
                </div>
                <div style="display:flex; gap:10px; margin-bottom:15px;">
                  <el-input v-model="store.pythonScriptPath" readonly placeholder="Python Script Path" style="flex: 1;" />
                  <el-button @click="selectPython('py')">Browse...</el-button>
                </div>
                <el-button type="primary" @click="runPython">Run Script</el-button>
                
                <el-input v-model="pyStatus" type="textarea" :rows="6" readonly style="margin-top: 20px; font-family: monospace;" />
              </div>
            </el-tab-pane>

            <el-tab-pane label="Description" name="desc">
              <div class="pane-container" style="height: 100%; display: flex; flex-direction: column;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px; align-items: center;">
                  <el-text tag="b">API Documentation</el-text>
                  <el-radio-group v-model="descMode" size="small">
                    <el-radio-button value="preview">Preview</el-radio-button>
                    <el-radio-button value="edit">Edit HTML</el-radio-button>
                  </el-radio-group>
                </div>
                <div v-if="descMode === 'preview'" class="html-preview-box" @click="handleLinkClick" v-html="store.activeRequest.request.description || '<p style=\'color:#888; font-style:italic;\'>No description provided.</p>'"></div>
                <el-input v-else v-model="store.activeRequest.request.description" type="textarea" :rows="12" style="font-family: monospace;" placeholder="Write HTML tags here..." />
              </div>
            </el-tab-pane>

            <el-tab-pane label="Notes" name="notes">
              <div class="pane-container" style="height: 100%; display: flex; flex-direction: column;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px; align-items: center;">
                  <el-text tag="b">My Personal Notes (Markdown)</el-text>
                  <el-radio-group v-model="notesMode" size="small">
                    <el-radio-button value="preview">Preview</el-radio-button>
                    <el-radio-button value="edit">Edit Markdown</el-radio-button>
                  </el-radio-group>
                </div>
                <div v-if="notesMode === 'preview'" class="html-preview-box" @click="handleLinkClick" v-html="marked.parse(store.activeRequest.notes || '*No notes yet.*')"></div>
                <el-input v-else v-model="store.activeRequest.notes" type="textarea" :rows="12" style="font-family: monospace;" placeholder="Write your notes here using Markdown..." />
              </div>
            </el-tab-pane>

          </el-tabs>
        </div>
      </div>

      <div v-show="store.activeRequest" class="resizer-v" @mousedown="startResizeResponse"></div>
      <div v-show="store.activeRequest" id="response-panel" :style="{ height: responseHeight + 'px' }">
        <div class="res-toolbar">
          <el-text tag="b" style="margin-right: 15px;">RESPONSE</el-text>
          <el-tag v-if="statusCode" :type="statusCode.startsWith('2') ? 'success' : 'danger'" effect="dark" size="small">{{ statusCode }}</el-tag>
          <el-text v-if="statusTime" type="info" size="small" style="margin-left:10px; font-family:monospace;">{{ statusTime }}</el-text>
          <el-text v-if="statusSize" type="info" size="small" style="margin-left:10px; font-family:monospace;">{{ statusSize }}</el-text>
          
          <div style="margin-left:auto; display:flex; align-items:center; gap:8px;">
            <el-input v-model="searchQuery" placeholder="Search in response..." size="small" style="width: 200px;" @keyup.enter="nextSearch" clearable>
              <template #append><el-button @click="nextSearch">🔍</el-button></template>
            </el-input>
            <el-text type="info" size="small" style="min-width: 45px; text-align:center;">{{ searchCount }}</el-text>
            <el-button-group size="small" style="margin-right: 10px;">
              <el-button @click="prevSearch">↑</el-button>
              <el-button @click="nextSearch">↓</el-button>
            </el-button-group>
            <el-button size="small" type="primary" plain @click="copyResponse">Copy JSON</el-button>
          </div>
        </div>
        <pre id="responseBody" v-html="responseHtml"></pre>
      </div>
    </div>

    <el-dialog v-model="renameDialog.visible" title="Rename" width="400px" center>
      <el-input v-model="renameDialog.name" placeholder="Enter new name" @keyup.enter="confirmRename" />
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="renameDialog.visible = false">Cancel</el-button>
          <el-button type="primary" @click="confirmRename">Confirm</el-button>
        </span>
      </template>
    </el-dialog>

    <el-dialog v-model="showHistory" title="Request History (Last 20)" width="700px">
      <div v-if="historyList.length === 0" style="color: #888; text-align: center; padding: 20px 0;">No history yet.</div>
      <div v-else style="max-height: 50vh; overflow-y: auto; border: 1px solid var(--border); border-radius: 4px; background: var(--bg);">
        <div v-for="(h, i) in historyList" :key="i" class="history-item" @click="restoreHistory(h)" title="Click to load this request">
          <el-tag :color="getMethodColor(h.method)" effect="dark" style="border:none; width: 65px; text-align:center; font-weight:bold; flex-shrink: 0;">{{ h.method }}</el-tag>
          <span class="history-url">{{ h.url }}</span>
          <span class="history-status" :style="{ color: h.statusCode.startsWith('2') ? '#0cbb52' : '#ea2027' }">{{ h.statusCode }}</span>
          <span class="history-time">{{ h.time }}</span>
        </div>
      </div>
      <template #footer>
        <span class="dialog-footer">
          <el-button type="danger" plain @click="clearHistory">Clear All History</el-button>
          <el-button @click="showHistory = false">Close</el-button>
        </span>
      </template>
    </el-dialog>

    <div v-if="ctxMenu.visible" class="custom-context-menu" :style="{ top: ctxMenu.y + 'px', left: ctxMenu.x + 'px' }">
      <ul>
        <li v-if="ctxMenu.type !== 'request'" @click.stop="ctxAction('addReq')">Add Request</li>
        <li v-if="ctxMenu.type !== 'request'" @click.stop="ctxAction('addFolder')">Add Folder</li>
        <li v-if="ctxMenu.type === 'request'" @click.stop="ctxAction('duplicate')">Duplicate</li>
        <div class="menu-divider"></div>
        <li @click.stop="ctxAction('moveUp')">Move Up</li>
        <li @click.stop="ctxAction('moveDown')">Move Down</li>
        <div class="menu-divider"></div>
        <li @click.stop="ctxAction('rename')">Rename</li>
        <li style="color: #f56c6c;" @click.stop="ctxAction('delete')">Delete</li>
      </ul>
    </div>

    <div v-if="tabCtxMenu.visible" class="custom-context-menu" :style="{ top: tabCtxMenu.y + 'px', left: tabCtxMenu.x + 'px' }">
      <ul>
        <li @click.stop="togglePinTab">Pin / Unpin Tab</li>
        <div class="menu-divider"></div>
        <li @click.stop="closeSingleTab(tabCtxMenu.tabId)">Close</li>
        <li @click.stop="closeOtherTabs(tabCtxMenu.tabId)">Close Others</li>
        <li @click.stop="closeUnpinnedTabs">Close Unpinned</li>
        <li @click.stop="closeAllTabs">Close All</li>
      </ul>
    </div>

  </div>
</template>

<script setup>
import { ref, watch, provide, nextTick, computed, onMounted, onUnmounted } from 'vue'
import { useCollectionStore } from './store'
import SidebarTree from './components/SidebarTree.vue'
import { marked } from 'marked'
import { ElMessage, ElMessageBox } from 'element-plus'

const store = useCollectionStore()
const currentTab = ref('headers')
const responseHtml = ref('Ready.')
const pyStatus = ref('')
const sidebarWidth = ref(320)
const responseHeight = ref(300)

const statusCode = ref('')
const statusTime = ref('')
const statusSize = ref('')
const searchQuery = ref('')
const searchCount = ref('')
const currentSearchIndex = ref(0)

const ctxMenu = ref({ visible: false, x: 0, y: 0, type: '', item: null, parentArray: null, index: -1 })
const tabCtxMenu = ref({ visible: false, x: 0, y: 0, tabId: null })
const renameDialog = ref({ visible: false, name: '', type: '', item: null })
const descMode = ref('preview')
const notesMode = ref('edit')
const showHistory = ref(false)
const historyList = ref(JSON.parse(localStorage.getItem('litefetch_history') || '[]'))

const dynamicVarsList = computed(() => {
  return Object.entries(store.pythonVars).map(([key, value]) => ({ key, value }))
})

const saveDraft = (tabId) => {
  store.saveTab(tabId)
  ElMessage.success('Saved successfully!')
}

const handleKeydown = (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault()
    if (store.activeTabId && store.isTabDirty(store.activeTabId)) saveDraft(store.activeTabId)
  }
}
onMounted(() => document.addEventListener('keydown', handleKeydown))
onUnmounted(() => document.removeEventListener('keydown', handleKeydown))

const showTabMenu = (e, tabId) => {
  hideAllMenus()
  tabCtxMenu.value = { visible: true, x: e.clientX, y: e.clientY, tabId }
}

const confirmCloseDirty = async (tabs) => {
  const dirtyCount = tabs.filter(t => store.isTabDirty(t._id)).length
  if (dirtyCount > 0) {
    try {
      await ElMessageBox.confirm(
        `You have ${dirtyCount} unsaved tab(s). Closing will discard your changes. Continue?`,
        'Unsaved Changes',
        { confirmButtonText: 'Discard Changes', cancelButtonText: 'Cancel', type: 'warning' }
      )
      return true
    } catch { return false }
  }
  return true
}

const togglePinTab = () => {
  const tab = store.openTabs.find(t => t._id === tabCtxMenu.value.tabId)
  if (tab) tab.pinned = !tab.pinned
  hideAllMenus()
}
const closeSingleTab = async (tabId) => {
  const tab = store.openTabs.find(t => t._id === tabId)
  if (tab && await confirmCloseDirty([tab])) store.closeTab(tabId)
  hideAllMenus()
}
const closeOtherTabs = async (keepId) => {
  const tabsToClose = store.openTabs.filter(t => t._id !== keepId)
  if (await confirmCloseDirty(tabsToClose)) tabsToClose.forEach(t => store.closeTab(t._id))
  hideAllMenus()
}
const closeUnpinnedTabs = async () => {
  const tabsToClose = store.openTabs.filter(t => !t.pinned)
  if (await confirmCloseDirty(tabsToClose)) tabsToClose.forEach(t => store.closeTab(t._id))
  hideAllMenus()
}
const closeAllTabs = async () => {
  const tabsToClose = [...store.openTabs]
  if (await confirmCloseDirty(tabsToClose)) tabsToClose.forEach(t => store.closeTab(t._id))
  hideAllMenus()
}

const hideAllMenus = () => { ctxMenu.value.visible = false; tabCtxMenu.value.visible = false }

const getMethodColor = (method) => {
  const colors = { GET: '#0cbb52', POST: '#ff6c37', PUT: '#097bed', DELETE: '#ea2027', PATCH: '#f1c40f' }
  return colors[method] || '#909399'
}

const formatSize = (bytes) => {
  if (bytes === 0) return '0 B'; const k = 1024; const sizes = ['B', 'KB', 'MB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const colorizeJSON = (json) => {
  const str = typeof json === 'string' ? json : JSON.stringify(json, null, 2)
  return str.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g, (m) => {
    let cls = 'json-num'; if (/^"/.test(m)) cls = /:$/.test(m) ? 'json-key' : 'json-string'
    return `<span class="${cls}">${m}</span>`
  })
}

// ---------------- 新增：手动创建 Collection ----------------
const addNewCollection = () => {
  store.addCollection({
    _id: 'col_' + Date.now(),
    info: { name: 'New Collection' },
    item: [],
    variables: []
  })
  ElMessage.success('New collection created!')
}

// ---------------- 新增：调用系统默认浏览器打开链接 ----------------
const handleLinkClick = (e) => {
  // 向上寻找被点击的 a 标签
  const a = e.target.closest('a')
  if (a && a.href && (a.href.startsWith('http://') || a.href.startsWith('https://'))) {
    e.preventDefault() // 阻止默认的应用内跳转
    try {
      // 调用 Electron 的 shell 模块在外部默认浏览器打开
      const { shell } = window.require('electron')
      shell.openExternal(a.href)
    } catch (err) {
      console.error('Failed to open external link', err)
      window.open(a.href, '_blank') // 兜底方案
    }
  }
}

const exportLiteFetch = () => {
  const dataToExport = {
    collections: JSON.parse(localStorage.getItem('pilot_collections') || '[]'),
    expandedFolders: JSON.parse(localStorage.getItem('pilot_expanded_folders') || '[]'),
    history: JSON.parse(localStorage.getItem('litefetch_history') || '[]'),
    pythonExe: localStorage.getItem('pilot_python_exe') || '',
    pythonScript: localStorage.getItem('pilot_python_script') || ''
  }
  const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `LiteFetch_Backup_${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(url)
  ElMessage.success('Backup exported successfully!')
}

const importLiteFetch = () => {
  const input = document.createElement('input'); input.type = 'file'; input.accept = '.json'
  input.onchange = (e) => {
    const file = e.target.files[0]; if (!file) return
    const reader = new FileReader(); reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result)
        if (!data.collections) return ElMessage.error('Invalid backup file formatting!')
        localStorage.setItem('pilot_collections', JSON.stringify(data.collections)); localStorage.setItem('pilot_expanded_folders', JSON.stringify(data.expandedFolders || [])); localStorage.setItem('litefetch_history', JSON.stringify(data.history || []))
        if (data.pythonExe) localStorage.setItem('pilot_python_exe', data.pythonExe)
        if (data.pythonScript) localStorage.setItem('pilot_python_script', data.pythonScript)
        ElMessage.success('Data restored! Reloading...'); setTimeout(() => window.location.reload(), 1500)
      } catch (err) { ElMessage.error('Failed to parse backup file.') }
    }
    reader.readAsText(file)
  }
  input.click()
}

const importCollection = async () => {
  const data = await window.electron.ipcRenderer.invoke('import-postman-raw')
  if (data) { store.addCollection(data); ElMessage.success('Postman collection imported!') }
}
const selectPython = async (ext) => {
  const path = await window.electron.ipcRenderer.invoke('select-file', [{ name: ext, extensions: [ext] }])
  if (path) { ext === 'exe' ? store.pythonExePath = path : store.pythonScriptPath = path }
}
const runPython = async () => {
  if (!store.pythonScriptPath) return ElMessage.warning('Please select a python script first.')
  pyStatus.value = 'Running script...'
  try {
    store.pythonVars = await window.electron.ipcRenderer.invoke('run-python', store.pythonScriptPath, store.pythonExePath)
    pyStatus.value = 'Success: Dynamic variables updated.'; ElMessage.success('Python script executed successfully!')
  } catch (e) { pyStatus.value = 'Error:\n' + e; ElMessage.error('Script execution failed.') }
}

const resolveVars = (text) => {
  if (!text || typeof text !== 'string') return text || ''
  const staticMap = {}; store.activeCollection?.variables?.forEach(v => { if (v.key) staticMap[v.key] = v.value })
  const combined = { ...staticMap, ...store.pythonVars }
  return text.replace(/\{\{(.+?)\}\}/g, (match, key) => combined[key.trim()] ?? match)
}

const sendRequest = async () => {
  if (store.hasConflict) return ElMessage.error("Please resolve Variable Conflicts first.")
  const req = store.activeRequest; if (!req) return

  const requestClient = window.require('axios') 
  let finalUrl = resolveVars(req.request.url).trim()
  const method = (req.request.method || 'GET').toUpperCase()
  const headersObj = {}; ;(req.request.header || []).forEach(h => { if (h.key && h.enabled !== false) headersObj[h.key.trim()] = resolveVars(h.value).trim() })
  
  let data = null
  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    try { data = JSON.parse(resolveVars(req.request.body.raw)) } catch(e){ data = resolveVars(req.request.body.raw) }
  }

  responseHtml.value = `Sending...`; statusCode.value = 'Loading...'; statusTime.value = ''; statusSize.value = ''; searchQuery.value = '' 
  const startTime = Date.now()

  try {
    const res = await requestClient({ method, url: finalUrl, headers: headersObj, data: ['GET', 'HEAD'].includes(method) ? undefined : data, timeout: 15000 })
    const size = new Blob([typeof res.data === 'string' ? res.data : JSON.stringify(res.data)]).size
    statusSize.value = formatSize(size); responseHtml.value = colorizeJSON(res.data)
    statusCode.value = `${res.status} ${res.statusText}`; statusTime.value = `${Date.now() - startTime} ms`; appendToHistory(req, statusCode.value)
  } catch (err) {
    const errData = err.response?.data || err.message
    statusSize.value = formatSize(new Blob([typeof errData === 'string' ? errData : JSON.stringify(errData)]).size)
    responseHtml.value = colorizeJSON(errData); statusCode.value = err.response ? `${err.response.status} ${err.response.statusText}` : 'ERROR'
    statusTime.value = `${Date.now() - startTime} ms`; appendToHistory(req, statusCode.value)
  }
}

const highlightCurrentMatch = () => {
  const marks = document.querySelectorAll('#responseBody mark.search-mark')
  if (!marks.length) return
  marks.forEach(m => { m.style.background = '#4c4d4f'; m.style.color = '#cfd3dc' })
  const currentMark = marks[currentSearchIndex.value - 1]
  if (currentMark) { currentMark.style.background = '#ff6c37'; currentMark.style.color = '#fff'; currentMark.scrollIntoView({ behavior: 'smooth', block: 'center' }); searchCount.value = `${currentSearchIndex.value} / ${marks.length}` }
}

const executeSearch = () => {
  const pre = document.getElementById('responseBody'); if (!pre) return
  pre.querySelectorAll('mark').forEach(m => { const p = m.parentNode; p.replaceChild(document.createTextNode(m.textContent), m); p.normalize(); });
  if (!searchQuery.value) { searchCount.value = ""; currentSearchIndex.value = 0; return; }

  const regex = new RegExp(`(${searchQuery.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const walker = document.createTreeWalker(pre, NodeFilter.SHOW_TEXT, null, false);
  const nodes = []; let n; while (n = walker.nextNode()) { if (regex.test(n.nodeValue)) nodes.push(n); }
  
  let matchCount = 0;
  nodes.forEach(node => {
    const frag = document.createDocumentFragment(); let lastIdx = 0;
    node.nodeValue.replace(regex, (match, p1, offset) => {
        frag.appendChild(document.createTextNode(node.nodeValue.substring(lastIdx, offset)));
        const mark = document.createElement('mark'); mark.textContent = match; mark.className = 'search-mark'; 
        frag.appendChild(mark); lastIdx = offset + match.length; matchCount++; return match;
    });
    frag.appendChild(document.createTextNode(node.nodeValue.substring(lastIdx))); node.parentNode.replaceChild(frag, node);
  });
  if (matchCount > 0) { currentSearchIndex.value = 1; highlightCurrentMatch(); } else { currentSearchIndex.value = 0; searchCount.value = "0 results"; }
}

const nextSearch = () => { const marks = document.querySelectorAll('#responseBody mark.search-mark'); if (!marks.length) return; currentSearchIndex.value = currentSearchIndex.value >= marks.length ? 1 : currentSearchIndex.value + 1; highlightCurrentMatch() }
const prevSearch = () => { const marks = document.querySelectorAll('#responseBody mark.search-mark'); if (!marks.length) return; currentSearchIndex.value = currentSearchIndex.value <= 1 ? marks.length : currentSearchIndex.value - 1; highlightCurrentMatch() }
watch([searchQuery, responseHtml], () => { nextTick(() => { executeSearch() }) })

const appendToHistory = (req, code) => {
  const item = { 
    method: req.request.method || 'GET', url: req.request.url || '', 
    header: req.request.header ? JSON.parse(JSON.stringify(req.request.header)) : [], body: req.request.body ? JSON.parse(JSON.stringify(req.request.body)) : { mode: 'raw', raw: '' },
    statusCode: code, time: new Date().toLocaleTimeString() 
  }
  historyList.value.unshift(item); if (historyList.value.length > 20) historyList.value.pop(); localStorage.setItem('litefetch_history', JSON.stringify(historyList.value))
}
const clearHistory = () => { historyList.value = []; localStorage.setItem('litefetch_history', '[]'); ElMessage.success('History cleared.') }
const restoreHistory = (h) => {
  if (store.collections.length === 0) store.addCollection({ _id: 'col_' + Date.now(), info: { name: 'Restored History' }, item: [] })
  const targetCol = store.collections[0]; if (!targetCol.item) targetCol.item = []
  const newReq = { _id: 'req_' + Math.random().toString(36).substr(2, 9), name: "History: " + (h.url.split('?')[0].split('/').pop() || 'Request').substring(0, 15), request: { method: h.method || 'GET', url: h.url || '', header: h.header ? JSON.parse(JSON.stringify(h.header)) : [], body: h.body ? JSON.parse(JSON.stringify(h.body)) : { mode: 'raw', raw: '' } } }
  targetCol.item.push(newReq); store.openTab(newReq); showHistory.value = false; ElMessage.success('History restored.')
}

const showContextMenu = (e, type, item, parentArray, index) => { hideAllMenus(); ctxMenu.value = { visible: true, x: e.clientX, y: e.clientY, type, item, parentArray, index } }
provide('showContextMenu', showContextMenu)

const ctxAction = (action) => {
  const { type, item, parentArray, index } = ctxMenu.value
  const targetArr = type === 'collection' ? item.item : item.item
  if (action === 'addReq') store.addNewReq(targetArr)
  if (action === 'addFolder') store.addFolder(targetArr)
  if (action === 'duplicate') store.duplicateReq(parentArray, index)
  if (action === 'delete') { type === 'collection' ? store.deleteCol(index) : store.deleteItem(parentArray, index) }
  if (action === 'moveUp' || action === 'moveDown') {
    const arr = type === 'collection' ? store.collections : parentArray
    if (arr && arr.length > 0) {
      const targetIndex = action === 'moveUp' ? index - 1 : index + 1
      if (targetIndex >= 0 && targetIndex < arr.length) { const temp = arr[index]; arr[index] = arr[targetIndex]; arr[targetIndex] = temp }
    }
  }
  if (action === 'rename') { const currentName = type === 'collection' ? (item.info?.name || 'Collection') : item.name; renameDialog.value = { visible: true, name: currentName, type, item }; }
  hideAllMenus()
}

const confirmRename = () => {
  const { type, item, name } = renameDialog.value;
  if (name && name.trim()) { if (type === 'collection') { if(!item.info) item.info = {}; item.info.name = name.trim(); } else item.name = name.trim(); }
  renameDialog.value.visible = false; ElMessage.success('Renamed successfully.')
}

const onToggle = (id, e) => { if (e.target.open) { if (!store.expandedFolders.includes(id)) store.expandedFolders.push(id) } else store.expandedFolders = store.expandedFolders.filter(x => x !== id) }
const startResizeSidebar = () => { const move = (e) => { sidebarWidth.value = Math.max(200, Math.min(e.clientX, 800)) }; const stop = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', stop) }; document.addEventListener('mousemove', move); document.addEventListener('mouseup', stop) }
const startResizeResponse = () => { const move = (e) => { responseHeight.value = Math.max(100, window.innerHeight - e.clientY) }; const stop = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', stop) }; document.addEventListener('mousemove', move); document.addEventListener('mouseup', stop) }
const copyResponse = () => { const pre = document.getElementById('responseBody'); if(pre) { navigator.clipboard.writeText(pre.innerText); ElMessage.success('Copied to clipboard!') } }
</script>

<style>
/* 强制映射我们之前的变量到纯净的暗黑模式 */
html.dark {
  --bg: #141414;
  --sidebar: #1d1e1f;
  --border: #303030;
  color-scheme: dark; 
}

body { margin: 0; font-family: "Segoe UI", "Microsoft YaHei", sans-serif; overflow: hidden; height: 100vh; background: var(--bg); color: #e5eaf3; }
#app-container { display: flex; width: 100%; height: 100vh; position: relative; }

/* 侧边栏 */
#sidebar { background: var(--sidebar); border-right: 1px solid var(--border); display: flex; flex-direction: column; user-select: none; }
.sidebar-header { padding: 15px; border-bottom: 1px solid var(--border); background: var(--bg); }
#collection-repo { flex: 1; overflow-y: auto; padding: 10px; font-size: 13px; color: #a3a6ad; }

/* 拖拽条 */
.resizer-h { width: 4px; background: transparent; cursor: col-resize; z-index: 10; transition: background 0.2s; }
.resizer-h:hover { background: #4c4d4f; }
.resizer-v { height: 4px; background: var(--border); cursor: row-resize; z-index: 10; transition: background 0.2s; }
.resizer-v:hover { background: #4c4d4f; }

/* 主编辑区 */
#main-editor { flex: 1; display: flex; flex-direction: column; background: var(--bg); min-width: 400px; overflow: hidden; }
#empty-state { flex: 1; display: flex; align-items: center; justify-content: center; flex-direction: column; background: var(--bg); }
#editor-top { flex: 1; display: flex; flex-direction: column; overflow: hidden; }

/* URL 地址栏 */
.url-bar { display: flex; padding: 12px 15px; border-bottom: 1px solid var(--border); gap: 10px; flex-shrink: 0; background: var(--bg); align-items: center; }

/* 强制下拉框 Popper 暗化 */
.dark-method-popper { background-color: #2b2b2c !important; border: 1px solid #414243 !important; }
.dark-method-popper .el-select-dropdown__item { color: #e5eaf3; }
.dark-method-popper .el-select-dropdown__item.hover, .dark-method-popper .el-select-dropdown__item:hover { background-color: #414243 !important; }
.dark-method-popper .el-popper__arrow::before { background-color: #2b2b2c !important; border: 1px solid #414243 !important; }

/* 修复 Tabs 高度与滚动机制 */
.custom-editor-tabs .el-tabs__header { margin: 0; background: var(--sidebar); border-bottom-color: var(--border); }
.custom-editor-tabs .el-tabs__item { border-top: none !important; border-color: var(--border) !important; font-size: 13px; color: #a3a6ad; }
.custom-editor-tabs .el-tabs__item.is-active { background: var(--bg); color: #fff; }

.tab-content-wrapper { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.config-tabs { flex: 1; display: flex; flex-direction: column; height: 100%; overflow: hidden; }
.config-tabs > .el-tabs__header { margin: 0; padding: 0 15px; }
.config-tabs > .el-tabs__content { flex: 1; overflow-y: auto; }
.pane-container { padding: 15px; min-height: 100%; box-sizing: border-box; }

.dirty-dot { width: 6px; height: 6px; border-radius: 50%; background-color: #e6a23c; margin-right: 6px; display: inline-block; }

/* 响应面板 */
#response-panel { display: flex; flex-direction: column; flex-shrink: 0; background: var(--bg); border-top: 1px solid var(--border); }
.res-toolbar { padding: 8px 15px; background: var(--sidebar); display: flex; border-bottom: 1px solid var(--border); align-items: center; }
#responseBody { flex: 1; margin: 0; padding: 15px; background: #1e1e1e; color: #d4d4d4; font-family: monospace; overflow: auto; font-size: 13px; line-height: 1.5; }

/* JSON 高亮 */
.json-key { color: #9cdcfe; } .json-string { color: #ce9178; } .json-num { color: #b5cea8; }

/* Markdown & HTML 预览框 */
.html-preview-box { flex: 1; overflow-y: auto; padding: 15px; border: 1px solid var(--border); border-radius: 4px; background: var(--sidebar); font-size: 14px; line-height: 1.6; color: #cfd3dc; }

/* 强制所有原生下拉菜单变为纯黑 */
.el-popper { background-color: #2b2b2c !important; border: 1px solid #414243 !important; }
.el-popper__arrow::before { background-color: #2b2b2c !important; border: 1px solid #414243 !important; }
.el-select-dropdown__item { color: #cfd3dc !important; }
.el-select-dropdown__item.hover, .el-select-dropdown__item:hover { background-color: #414243 !important; }

/* 自定义右键菜单样式 */
.custom-context-menu { position: fixed; z-index: 3000; padding: 6px 0; background-color: #2b2b2c; border: 1px solid #414243; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.4); min-width: 150px; }
.custom-context-menu ul { list-style: none; margin: 0; padding: 0; }
.custom-context-menu li { padding: 8px 16px; font-size: 13px; color: #e5eaf3; cursor: pointer; transition: background 0.1s; }
.custom-context-menu li:hover { background-color: #414243; color: #fff; }
.custom-context-menu .menu-divider { height: 1px; background-color: #414243; margin: 4px 0; }

/* ================= URL 栏字体与颜色质感优化 ================= */
.method-select :is(.el-select__selected-item, .el-input__inner, .el-select__placeholder) {
  font-weight: bold !important;
  font-size: 13px !important;
  font-family: inherit !important;
}
.method-select.get :is(.el-select__selected-item, .el-input__inner, .el-select__placeholder) { color: #0cbb52 !important; }
.method-select.post :is(.el-select__selected-item, .el-input__inner, .el-select__placeholder) { color: #ff6c37 !important; }
.method-select.put :is(.el-select__selected-item, .el-input__inner, .el-select__placeholder) { color: #097bed !important; }
.method-select.delete :is(.el-select__selected-item, .el-input__inner, .el-select__placeholder) { color: #ea2027 !important; }
.method-select.patch :is(.el-select__selected-item, .el-input__inner, .el-select__placeholder) { color: #f1c40f !important; }

.method-select .el-select__wrapper, .url-input .el-input__wrapper {
  box-shadow: 0 0 0 1px #414243 inset !important;
  background-color: #1e1e1e !important;
  border-radius: 4px;
}
.method-select .el-select__wrapper.is-focused, .url-input .el-input__wrapper.is-focus {
  box-shadow: 0 0 0 1px #888 inset !important; 
}

.url-input .el-input__inner {
  font-family: "Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", sans-serif !important;
  font-size: 14px !important;
  font-weight: 500 !important;
  letter-spacing: 0.3px;
  color: #cfd3dc !important;
}

/* ================= 历史记录列表排版优化 ================= */
.history-item { 
  display: flex; 
  align-items: center; 
  padding: 12px 15px; 
  border-bottom: 1px solid var(--border); 
  cursor: pointer; 
  transition: background 0.2s; 
  gap: 15px;
}
.history-item:hover { background-color: #2b2b2c; }
.history-item:last-child { border-bottom: none; }

.history-url { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: monospace; font-size: 13px; color: #cfd3dc; }
.history-status { width: 60px; text-align: right; font-weight: bold; font-family: monospace; flex-shrink: 0; }
.history-time { width: 70px; text-align: right; color: #909399; font-family: monospace; font-size: 12px; flex-shrink: 0; }

/* ================= 左侧栏顶级 Collection 样式 ================= */
#collection-repo summary { list-style: none; outline: none; }
#collection-repo summary::-webkit-details-marker { display: none; }
.folder-summary { cursor: pointer; display: flex; align-items: center; border-radius: 4px; transition: background 0.2s; }
.folder-summary:hover { background: #2b2b2c; }

/* 箭头基础样式 */
.folder-arrow { font-size: 15px; margin-right: 6px; color: #888; transition: transform 0.2s ease; display: inline-block; }
.folder-arrow.is-open { transform: rotate(90deg); color: #cfd3dc; }

/* 顶级大集合展开时，箭头跟随主色调变蓝 */
.top-level-summary .folder-arrow.is-open { color: var(--el-color-primary); }

/* ================= 左侧栏文件夹层级缩进控制 ================= */
.folder-content { 
  margin-left: 14px; /* 控制左侧那条“竖线”的位置（数值越大，竖线越往右） */
  border-left: 1px solid #414243; /* 竖线的颜色 */
  padding-left: 2px; /* 控制“Account”等文字距离竖线的距离（数值越大，文字越往右缩进） */
}

/* ================= 修复富文本与 Markdown 里的表格样式 ================= */
.html-preview-box table {
  border-collapse: collapse; /* 合并相邻边框 */
  width: 100%;
  margin: 15px 0;
  font-size: 13px;
}

.html-preview-box th, 
.html-preview-box td {
  border: 1px solid #414243; /* 暗黑主题的边框色 */
  padding: 10px 12px;
  text-align: left;
  line-height: 1.5;
}

.html-preview-box th {
  background-color: #2b2b2c; /* 表头加上深色背景 */
  font-weight: bold;
  color: #e5eaf3;
}

.html-preview-box tr:hover {
  background-color: #272727; /* 鼠标悬浮某一行时微微变亮 */
}
</style>