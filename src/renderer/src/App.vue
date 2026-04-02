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
        <div class="editor-tabs-row">
          <el-tabs v-model="store.activeTabId" type="card" :class="['custom-editor-tabs', { 'is-dragging-tabs': dragTab.isDragging }]" @tab-remove="closeSingleTab">
            <el-tab-pane v-for="tab in store.openTabs" :key="tab._id" :name="tab._id" closable>
              <template #label>
                <div
                  class="tab-label"
                  :class="{
                    'is-drag-source': dragTab.sourceId === tab._id,
                    'is-drag-target': dragTab.targetId === tab._id,
                    'is-drop-left': dragTab.targetId === tab._id && dragTab.targetSide === 'left',
                    'is-drop-right': dragTab.targetId === tab._id && dragTab.targetSide === 'right'
                  }"
                  draggable="true"
                  @dragstart="onTabDragStart($event, tab._id)"
                  @dragover.prevent="onTabDragOver($event, tab._id)"
                  @drop.prevent="onTabDrop($event, tab._id)"
                  @dragend="onTabDragEnd"
                  @contextmenu.prevent="showTabMenu($event, tab._id)"
                >
                  <span v-if="store.isTabDirty(tab._id)" class="dirty-dot"></span>
                  <el-icon v-if="tab.pinned" class="pin-icon"><Paperclip /></el-icon>
                  <span :style="{ color: getMethodColor(tab.method), fontSize: '12px', fontWeight: 'bold', marginRight: '8px' }">{{ tab.method || 'REQ' }}</span>
                  <span style="font-size: 13px;">{{ tab.name }}</span>
                </div>
              </template>
            </el-tab-pane>
          </el-tabs>
          <div class="top-actions-panel">
            <el-button class="top-icon-btn save" circle :disabled="!store.isTabDirty(store.activeTabId)" @click="saveDraft(store.activeTabId)">
              <svg class="top-icon-svg" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M4 4h13l3 3v13H4V4z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
                <path d="M8 4h8v5H8V4z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
                <path d="M8 20v-6h8v6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </el-button>
            <el-button class="top-icon-btn" circle @click="openCodeGenDialog">
              <svg class="top-icon-svg code" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M8.5 8L5 12l3.5 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M15.5 8L19 12l-3.5 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M13 6l-2 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </el-button>
          </div>
        </div>

        <div class="url-bar">
          <el-select v-model="activeEnvId" style="width: 100px;" placeholder="Environment" @change="onEnvChange">
            <el-option v-for="env in environments" :key="env.id" :label="env.name" :value="env.id" />
          </el-select>
          <el-button size="default" plain @click="showEnvDialog = true">Envs</el-button>
          <el-select v-model="store.activeRequest.request.method" :class="['method-select', (store.activeRequest.request.method || 'GET').toLowerCase()]" style="width: 90px;" popper-class="dark-method-popper">
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
          <el-button color="#ff6c37" size="default" style="color: white; font-weight: bold; width: 90px; margin: 0;" @click="sendRequest">
            Send
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
                  <el-table-column width="80" align="center"><template #default="scope"><el-button type="danger" link aria-label="Delete header" @click="store.activeRequest.request.header.splice(scope.$index, 1)"><el-icon><Delete /></el-icon></el-button></template></el-table-column>
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
                <el-alert
                  v-if="variableConflicts.hasConflict"
                  title="Variable Conflict Warning"
                  :description="variableConflicts.message"
                  type="error"
                  show-icon
                  :closable="false"
                  style="margin-bottom: 15px;"
                />
                <el-text tag="b" style="margin-bottom: 8px; display: block;">Static Variables</el-text>
                <el-table :data="store.activeCollection?.variables" border style="width: 100%; margin-bottom: 15px;" size="small">
                  <el-table-column label="Key" min-width="150" resizable><template #default="scope"><el-input v-model="scope.row.key" placeholder="Key" size="small"></el-input></template></el-table-column>
                  <el-table-column label="Value" min-width="250" resizable><template #default="scope"><el-input v-model="scope.row.value" placeholder="Value" size="small"></el-input></template></el-table-column>
                  <el-table-column width="80" align="center"><template #default="scope"><el-button type="danger" link aria-label="Delete variable" @click="store.activeCollection.variables.splice(scope.$index, 1)"><el-icon><Delete /></el-icon></el-button></template></el-table-column>
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
      
      <div v-show="store.activeRequest" id="response-panel" :key="store.activeTabId" :style="{ height: responseHeight + 'px' }">
        <div class="res-toolbar">
          <el-text tag="b" style="margin-right: 15px;">RESPONSE</el-text>
          
          <el-radio-group v-model="currentRes.mode" size="small" style="margin-right: 15px;">
            <el-radio-button value="pretty">Pretty</el-radio-button>
            <el-radio-button value="raw">Raw</el-radio-button>
            <el-radio-button value="preview" :disabled="currentRes.previewType === 'none'">Preview</el-radio-button>
          </el-radio-group>

          <el-tag v-if="currentRes.code" :type="(currentRes.code || '').toString().startsWith('2') ? 'success' : 'danger'" effect="dark" size="small">
            {{ currentRes.code }}
          </el-tag>
          <el-text v-if="currentRes.time" type="info" size="small" style="margin-left:10px; font-family:monospace;">
            {{ currentRes.time }}
          </el-text>
          <el-text v-if="currentRes.size" type="info" size="small" style="margin-left:10px; font-family:monospace;">
            {{ currentRes.size }}
          </el-text>
          
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
        
        <pre v-show="currentRes.mode === 'pretty'" id="responseBody" v-html="currentRes.html"></pre>
        <pre v-show="currentRes.mode === 'raw'" style="flex:1; margin:0; padding:15px; overflow:auto; color:#d4d4d4; font-family:monospace; font-size:13px;">{{ currentRes.rawText }}</pre>
        <div v-show="currentRes.mode === 'preview'" class="response-preview-box">
          <iframe v-if="currentRes.previewType === 'html'" class="response-preview-frame" :srcdoc="currentRes.previewHtml"></iframe>
          <img v-else-if="currentRes.previewType === 'image'" :src="currentRes.previewSrc" style="max-width:100%; max-height:100%; object-fit:contain;" />
        </div>
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
          <span class="history-status" :style="{ color: (h.statusCode || '').toString().startsWith('2') ? '#0cbb52' : '#ea2027' }">{{ h.statusCode }}</span>
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

    <el-dialog v-model="showEnvDialog" title="Environments" width="760px">
      <div style="display:flex; align-items:center; gap:10px; margin-bottom: 12px;">
        <el-button type="primary" plain @click="addEnvironment">+ Environment</el-button>
        <el-text type="info">Switch active environment from URL bar</el-text>
      </div>
      <div v-for="(env, idx) in environments" :key="env.id" class="env-card">
        <div style="display:flex; gap:10px; align-items:center; margin-bottom: 10px;">
          <el-input v-model="env.name" placeholder="Environment Name" style="width: 220px;" @change="persistEnvironments" />
          <el-input v-model="env.baseUrl" placeholder="Base URL (e.g. https://api.example.com)" @change="persistEnvironments" />
          <el-button type="danger" link aria-label="Delete environment" :disabled="environments.length <= 1" @click="removeEnvironment(idx)"><el-icon><Delete /></el-icon></el-button>
        </div>
        <el-table :data="env.variables" border size="small">
          <el-table-column label="Key" min-width="180"><template #default="scope"><el-input v-model="scope.row.key" size="small" @change="persistEnvironments" /></template></el-table-column>
          <el-table-column label="Value" min-width="220"><template #default="scope"><el-input v-model="scope.row.value" size="small" @change="persistEnvironments" /></template></el-table-column>
          <el-table-column width="90" align="center"><template #default="scope"><el-button type="danger" link aria-label="Delete env variable" @click="env.variables.splice(scope.$index, 1); persistEnvironments()"><el-icon><Delete /></el-icon></el-button></template></el-table-column>
        </el-table>
        <el-button style="margin-top:8px;" size="small" @click="env.variables.push({ key: '', value: '' }); persistEnvironments()">+ Var</el-button>
      </div>
      <template #footer>
        <el-button @click="showEnvDialog = false">Close</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showCodeDialog" title="Generate Request Code" width="760px">
      <div style="display:flex; gap:10px; margin-bottom: 12px; align-items:center;">
        <el-select v-model="codeLang" style="width:160px;" @change="refreshCodeSnippet">
          <el-option label="cURL" value="curl" />
          <el-option label="Fetch" value="fetch" />
          <el-option label="Axios" value="axios" />
          <el-option label="Python requests" value="python" />
        </el-select>
        <el-button type="primary" plain @click="copyCodeSnippet">Copy</el-button>
      </div>
      <el-input v-model="codeSnippet" type="textarea" :rows="16" readonly style="font-family: Consolas, monospace;" />
      <template #footer>
        <el-button @click="showCodeDialog = false">Close</el-button>
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
import { ref, watch, provide, nextTick, computed, onMounted, onUnmounted, reactive } from 'vue'
import { useCollectionStore } from './store'
import SidebarTree from './components/SidebarTree.vue'
import { marked } from 'marked'
import axios from 'axios'
import localforage from 'localforage'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Bottom, Delete, Paperclip, Search, Top } from '@element-plus/icons-vue'

const store = useCollectionStore()

// ================= DATA HEALER: Fix missing legacy fields dynamically =================
watch(() => store.activeRequest, (req) => {
  if (req) {
    if (!req._id) req._id = 'req_' + Math.random().toString(36).substr(2, 9)
    if (!req.request) req.request = { method: 'GET', url: '', header: [], body: { mode: 'raw', raw: '' } }
    if (!req.request.header) req.request.header = []
    if (!req.request.body) req.request.body = { mode: 'raw', raw: '' }
  }
}, { immediate: true })

const currentTab = ref('headers')
const pyStatus = ref('')
const sidebarWidth = ref(320)
const responseHeight = ref(300)

// ================= Core Fix: Safely isolated response cache pool =================
const responseCache = reactive({})

const initCache = (tabId) => {
  if (!responseCache[tabId]) {
    responseCache[tabId] = {
      mode: 'pretty',
      html: 'Ready.',
      rawText: 'Ready.',
      code: '',
      time: '',
      size: '',
      previewType: 'none',
      previewHtml: '',
      previewSrc: ''
    }
  }
  return responseCache[tabId]
}

const currentRes = computed(() => {
  const reqId = store.activeRequest?._id
  if (!reqId) return initCache('default_tab')
  return initCache(reqId)
})
// ====================================================================

const searchQuery = ref('')
const searchCount = ref('')
const currentSearchIndex = ref(0)

const ctxMenu = ref({ visible: false, x: 0, y: 0, type: '', item: null, parentArray: null, index: -1 })
const tabCtxMenu = ref({ visible: false, x: 0, y: 0, tabId: null })
const renameDialog = ref({ visible: false, name: '', type: '', item: null })
const descMode = ref('preview')
const notesMode = ref('edit')
const showHistory = ref(false)

// New code: Start with an empty array, then asynchronously load huge history from IndexedDB
const historyList = ref([])
localforage.getItem('litefetch_history').then((data) => {
  if (data) historyList.value = data
}).catch(err => console.error('Failed to load history:', err))

const dragTab = ref({ sourceId: null, targetId: null, targetSide: 'left', isDragging: false })

const showEnvDialog = ref(false)
const showCodeDialog = ref(false)
const codeLang = ref('curl')
const codeSnippet = ref('')

const defaultEnv = () => ({ id: 'env_' + Date.now(), name: 'Default', baseUrl: '', variables: [] })
const environments = ref(JSON.parse(localStorage.getItem('litefetch_environments') || 'null') || [defaultEnv()])
const activeEnvId = ref(localStorage.getItem('litefetch_active_env') || environments.value[0].id)

const dynamicVarsList = computed(() => {
  return Object.entries(store.pythonVars).map(([key, value]) => ({ key, value }))
})

const activeEnvironment = computed(() => {
  return environments.value.find(e => e.id === activeEnvId.value) || environments.value[0]
})

const variableConflicts = computed(() => {
  const normalizeKeys = (arr = []) => {
    return new Set(arr.map(v => (v?.key || '').trim()).filter(Boolean))
  }
  const overlap = (a, b) => [...a].filter(k => b.has(k))

  const envKeys = normalizeKeys(activeEnvironment.value?.variables || [])
  const collectionKeys = normalizeKeys(store.activeCollection?.variables || [])
  const pythonKeys = new Set(Object.keys(store.pythonVars || {}).map(k => (k || '').trim()).filter(Boolean))

  const envVsCollection = overlap(envKeys, collectionKeys)
  const envVsPython = overlap(envKeys, pythonKeys)
  const collectionVsPython = overlap(collectionKeys, pythonKeys)

  const sections = []
  if (envVsCollection.length) sections.push(`Environment vs Collection: ${envVsCollection.join(', ')}`)
  if (envVsPython.length) sections.push(`Environment vs Python: ${envVsPython.join(', ')}`)
  if (collectionVsPython.length) sections.push(`Collection vs Python: ${collectionVsPython.join(', ')}`)

  return {
    hasConflict: sections.length > 0,
    message: sections.join(' | ')
  }
})

const saveDraft = (tabId) => {
  store.saveTab(tabId)
  ElMessage.success('Saved successfully!')
}

const persistEnvironments = () => {
  localStorage.setItem('litefetch_environments', JSON.stringify(environments.value))
  localStorage.setItem('litefetch_active_env', activeEnvId.value)
}

const onEnvChange = () => {
  persistEnvironments()
}

const addEnvironment = () => {
  const env = { id: 'env_' + Date.now(), name: `Env ${environments.value.length + 1}`, baseUrl: '', variables: [] }
  environments.value.push(env)
  activeEnvId.value = env.id
  persistEnvironments()
}

const removeEnvironment = (idx) => {
  const removed = environments.value[idx]
  environments.value.splice(idx, 1)
  if (!environments.value.length) environments.value.push(defaultEnv())
  if (removed?.id === activeEnvId.value) activeEnvId.value = environments.value[0].id
  persistEnvironments()
}

const handleKeydown = (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault()
    if (store.activeTabId && store.isTabDirty(store.activeTabId)) saveDraft(store.activeTabId)
  }
}
onMounted(() => document.addEventListener('keydown', handleKeydown))
onUnmounted(() => document.removeEventListener('keydown', handleKeydown))

// Calculate safe coordinates to prevent menu from clipping outside the window
const showTabMenu = (e, tabId) => {
  hideAllMenus()
  let menuX = e.clientX
  let menuY = e.clientY
  if (window.innerHeight - menuY < 200) menuY = window.innerHeight - 200
  if (window.innerWidth - menuX < 160) menuX = window.innerWidth - 160
  tabCtxMenu.value = { visible: true, x: menuX, y: menuY, tabId }
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
  if (tab) store.setTabPinned(tab._id, !tab.pinned)
  hideAllMenus()
}

const onTabDragStart = (e, tabId) => {
  dragTab.value = { sourceId: tabId, targetId: null, targetSide: 'left', isDragging: true }
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', tabId)
  }
}

const onTabDragOver = (e, targetTabId) => {
  if (!dragTab.value.isDragging || dragTab.value.sourceId === targetTabId) return
  const targetEl = e.currentTarget
  const rect = targetEl.getBoundingClientRect()
  const offsetX = e.clientX - rect.left
  const side = offsetX < rect.width / 2 ? 'left' : 'right'
  dragTab.value.targetId = targetTabId
  dragTab.value.targetSide = side
}

const onTabDrop = (e, targetTabId) => {
  const sourceTabId = dragTab.value.sourceId || e.dataTransfer?.getData('text/plain')
  if (sourceTabId && sourceTabId !== targetTabId) {
    store.moveTab(sourceTabId, targetTabId, dragTab.value.targetSide)
  }
  onTabDragEnd()
}

const onTabDragEnd = () => {
  dragTab.value = { sourceId: null, targetId: null, targetSide: 'left', isDragging: false }
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
  let str = typeof json === 'string' ? json : JSON.stringify(json, null, 2)
  str = str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return str.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g, (m) => {
    let cls = 'json-num'; if (/^"/.test(m)) cls = /:$/.test(m) ? 'json-key' : 'json-string'
    return `<span class="${cls}">${m}</span>`
  })
}

const addNewCollection = () => {
  store.addCollection({
    _id: 'col_' + Date.now(),
    info: { name: 'New Collection' },
    item: [],
    variables: []
  })
  ElMessage.success('New collection created!')
}

const handleLinkClick = (e) => {
  const a = e.target.closest('a')
  if (a && a.href && (a.href.startsWith('http://') || a.href.startsWith('https://'))) {
    e.preventDefault() 
    try {
      window.electron.ipcRenderer.invoke('open-external', a.href)
    } catch (err) {
      window.open(a.href, '_blank') 
    }
  }
}

// 👉 Core fix: Package environments into backup
const exportLiteFetch = () => {
  const dataToExport = {
    collections: JSON.parse(localStorage.getItem('pilot_collections') || '[]'),
    expandedFolders: JSON.parse(localStorage.getItem('pilot_expanded_folders') || '[]'),
    history: JSON.parse(localStorage.getItem('litefetch_history') || '[]'),
    pythonExe: localStorage.getItem('pilot_python_exe') || '',
    pythonScript: localStorage.getItem('pilot_python_script') || '',
    environments: JSON.parse(localStorage.getItem('litefetch_environments') || 'null'),
    activeEnvId: localStorage.getItem('litefetch_active_env') || ''
  }
  const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `LiteFetch_Backup_${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(url)
  ElMessage.success('Backup exported successfully!')
}

const importLiteFetch = () => {
  const input = document.createElement('input'); input.type = 'file'; input.accept = '.json'
  input.onchange = (e) => {
    const file = e.target.files[0]; if (!file) return
    const reader = new FileReader(); 
    
    // 👇 Note: Added async here
    reader.onload = async (ev) => {
      try {
        const data = JSON.parse(ev.target.result)
        if (!data.collections) return ElMessage.error('Invalid backup file formatting!')
        
        localStorage.setItem('pilot_collections', JSON.stringify(data.collections)); 
        localStorage.setItem('pilot_expanded_folders', JSON.stringify(data.expandedFolders || [])); 
        
        if (data.pythonExe) localStorage.setItem('pilot_python_exe', data.pythonExe)
        if (data.pythonScript) localStorage.setItem('pilot_python_script', data.pythonScript)
        
        if (data.environments) localStorage.setItem('litefetch_environments', JSON.stringify(data.environments))
        if (data.activeEnvId) localStorage.setItem('litefetch_active_env', data.activeEnvId)
        
        // 👉 Core fix: Use localforage to store history, wait for it to finish
        await localforage.setItem('litefetch_history', data.history || [])
        
        ElMessage.success('Data restored! Reloading...'); setTimeout(() => window.location.reload(), 1500)
      } catch (err) { ElMessage.error('Failed to parse backup file.') }
    }
    reader.readAsText(file)
  }
  input.click()
}

const importCollection = async () => {
  try {
    const data = await window.electron.ipcRenderer.invoke('import-postman-raw')
    if (data) {
      const sanitizeNode = (node) => {
        if (!node._id) node._id = 'pm_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36)
        if (node.item && Array.isArray(node.item)) {
          node.item.forEach(sanitizeNode)
        } else if (node.request) {
          if (typeof node.request.url === 'object') {
            node.request.url = node.request.url.raw || ''
          }
          if (!node.request.header) node.request.header = []
          if (!node.request.body) node.request.body = { mode: 'raw', raw: '' }
        }
      }

      sanitizeNode(data)
      data.variables = []
      if (data.variable && Array.isArray(data.variable)) {
        data.variables = data.variable.map(v => ({ key: v.key || '', value: v.value || '' }))
      }

      store.addCollection(data)
      ElMessage.success('Postman collection imported and sanitized successfully!')
    }
  } catch (err) {
    ElMessage.error(err?.message || 'Failed to parse Postman collection format.')
  }
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
  const envMap = {}
  ;(activeEnvironment.value?.variables || []).forEach(v => { if (v.key) envMap[v.key] = v.value })
  const combined = { ...envMap, ...staticMap, ...store.pythonVars }
  return text.replace(/\{\{(.+?)\}\}/g, (match, key) => combined[key.trim()] ?? match)
}

const buildFinalRequest = () => {
  const req = store.activeRequest
  if (!req) return null
  const method = (req.request.method || 'GET').toUpperCase()
  const resolvedUrl = resolveVars(req.request.url).trim()
  const baseUrl = resolveVars((activeEnvironment.value?.baseUrl || '').trim())
  const joinUrl = (base, path) => {
    if (!base) return path
    if (!path) return base
    const baseHasSlash = base.endsWith('/')
    const pathHasSlash = path.startsWith('/')
    if (baseHasSlash && pathHasSlash) return base + path.slice(1)
    if (!baseHasSlash && !pathHasSlash) return `${base}/${path}`
    return base + path
  }
  const finalUrl = /^https?:\/\//i.test(resolvedUrl) ? resolvedUrl : joinUrl(baseUrl, resolvedUrl)
  const headersObj = {}
  ;(req.request.header || []).forEach(h => {
    if (h.key && h.enabled !== false) headersObj[h.key.trim()] = resolveVars(h.value).trim()
  })
  let bodyData = null
  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    const rawBody = resolveVars(req.request.body?.raw || '')
    try { bodyData = JSON.parse(rawBody) } catch { bodyData = rawBody }
  }
  return { method, finalUrl, headersObj, bodyData }
}

const refreshCodeSnippet = () => {
  const payload = buildFinalRequest()
  if (!payload) {
    codeSnippet.value = 'No active request selected.'
    return
  }
  const { method, finalUrl, headersObj, bodyData } = payload
  const headersEntries = Object.entries(headersObj)
  const bodyString = bodyData == null ? '' : (typeof bodyData === 'string' ? bodyData : JSON.stringify(bodyData, null, 2))

  if (codeLang.value === 'curl') {
    const lines = [
      `curl -X ${method} ${JSON.stringify(finalUrl)}`,
      ...headersEntries.map(([k, v]) => `  -H ${JSON.stringify(`${k}: ${v}`)}`)
    ]
    if (bodyData != null) lines.push(`  --data-raw ${JSON.stringify(bodyString)}`)
    codeSnippet.value = lines.join(' \\\n')
    return
  }

  if (codeLang.value === 'fetch') {
    codeSnippet.value = `fetch(${JSON.stringify(finalUrl)}, {
  method: ${JSON.stringify(method)},
  headers: ${JSON.stringify(headersObj, null, 2)},
${bodyData == null ? '' : `  body: ${JSON.stringify(bodyString)},\n`} }).then(async (res) => {
  const text = await res.text()
  console.log(res.status, text)
})`
    return
  }

  if (codeLang.value === 'python') {
    const pyData = bodyData == null
      ? ''
      : (typeof bodyData === 'string'
        ? `data = ${JSON.stringify(bodyData)}\n\n`
        : `data = ${JSON.stringify(bodyData, null, 2)}\n\n`)
    codeSnippet.value = `import requests

url = ${JSON.stringify(finalUrl)}
headers = ${JSON.stringify(headersObj, null, 2)}
${pyData}response = requests.request(
    method=${JSON.stringify(method)},
    url=url,
    headers=headers,
${bodyData == null ? '' : '    data=data,\n'}    timeout=15
)

print(response.status_code)
print(response.text)`
    return
  }

  codeSnippet.value = `import axios from 'axios'

axios({
  method: ${JSON.stringify(method)},
  url: ${JSON.stringify(finalUrl)},
  headers: ${JSON.stringify(headersObj, null, 2)},
${bodyData == null ? '' : `  data: ${JSON.stringify(bodyData, null, 2)},\n`} }).then((res) => {
  console.log(res.status, res.data)
})`
}

const openCodeGenDialog = () => {
  showCodeDialog.value = true
  refreshCodeSnippet()
}

const sendRequest = async () => {
  if (store.hasConflict) return ElMessage.error("Please resolve Variable Conflicts first.")
  const req = store.activeRequest; if (!req) return

  const reqId = req._id || 'temp_id'
  const cache = initCache(reqId)

  let finalUrl = resolveVars(req.request?.url || '').trim()
  const method = (req.request?.method || 'GET').toUpperCase()
  const headersObj = {}; 
  if (Array.isArray(req.request?.header)) {
    req.request.header.forEach(h => { 
      if (h && h.key && h.enabled !== false) headersObj[h.key.trim()] = resolveVars(h.value || '').trim() 
    })
  }
  
  let data = null
  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    const rawBody = req.request?.body?.raw || '' 
    try { 
      data = JSON.parse(resolveVars(rawBody)) 
    } catch(e) { 
      data = resolveVars(rawBody) 
    }
  }

  cache.html = `Sending...`
  cache.rawText = `Sending...`
  cache.code = 'Loading...'
  cache.time = ''
  cache.size = ''
  cache.previewType = 'none' // Reset preview state
  searchQuery.value = '' 
  const startTime = Date.now()

  try {
    const res = await window.electron.ipcRenderer.invoke('http-request', {
      method, url: finalUrl, headers: headersObj, data: ['GET', 'HEAD'].includes(method) ? undefined : data, timeout: 15000
    })

    cache.time = `${Date.now() - startTime} ms`

    // 👉 CORE FIX: Detect Content-Type to activate Preview feature
    const resHeaders = res.headers || {}
    const contentType = (resHeaders['content-type'] || resHeaders['Content-Type'] || '').toLowerCase()
    const isHtml = contentType.includes('text/html')

    if (res.ok) {
      const size = new Blob([typeof res.data === 'string' ? res.data : JSON.stringify(res.data)]).size
      cache.size = formatSize(size)
      cache.html = colorizeJSON(res.data)
      cache.rawText = typeof res.data === 'string' ? res.data : JSON.stringify(res.data, null, 2)
      cache.code = `${res.status} ${res.statusText}`
      
      // Assign HTML preview data if applicable
      if (isHtml) {
        cache.previewType = 'html'
        cache.previewHtml = typeof res.data === 'string' ? res.data : JSON.stringify(res.data)
      }
    } else {
      const errData = res.data || res.message || 'Unknown Error'
      const size = new Blob([typeof errData === 'string' ? errData : JSON.stringify(errData)]).size
      cache.size = formatSize(size)
      cache.html = colorizeJSON(errData)
      cache.rawText = typeof errData === 'string' ? errData : JSON.stringify(errData, null, 2)
      cache.code = res.status ? `${res.status} ${res.statusText}` : 'ERROR'
      
      // Allow previewing error pages (like Nginx 404 HTML pages)
      if (isHtml) {
        cache.previewType = 'html'
        cache.previewHtml = typeof errData === 'string' ? errData : JSON.stringify(errData)
      }
    }
    
    // Pass the entire cache object to save response snapshot
    appendToHistory(req, cache)

  } catch (err) {
    cache.html = colorizeJSON(err.message || String(err))
    cache.rawText = err.message || String(err)
    cache.code = 'IPC ERROR'
    cache.time = `${Date.now() - startTime} ms`
    appendToHistory(req, cache)
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
  if (currentRes.value.mode !== 'pretty') {
    searchCount.value = ''
    currentSearchIndex.value = 0
    return
  }
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

watch([searchQuery, () => currentRes.value.html], () => { nextTick(() => { executeSearch() }) })
watch(() => currentRes.value.mode, () => { nextTick(() => { executeSearch() }) })

const copyResponse = () => { 
  if (currentRes.value.mode === 'pretty' || currentRes.value.mode === 'raw') {
    navigator.clipboard.writeText(currentRes.value.rawText); 
    ElMessage.success('Copied to clipboard!') 
  }
}

// 👉 Core fix: Plan A - Replace variables with real values, include safely truncated response & preview data
const appendToHistory = (req, cache) => {
  const resolvedUrl = resolveVars(req.request.url || '').trim()

  const resolvedHeaders = (req.request.header || []).map(h => ({
    key: h.key,
    value: resolveVars(h.value || ''),
    enabled: h.enabled
  }))

  const resolvedBody = {
    mode: req.request.body?.mode || 'raw',
    raw: resolveVars(req.request.body?.raw || '') 
  }

  // Safety mechanism: truncate response body if it exceeds ~50KB to prevent indexedDB bloat over time
  let safeRawText = cache.rawText || ''
  if (safeRawText.length > 50000) {
    safeRawText = safeRawText.substring(0, 50000) + '\n\n... [Response too large, truncated for history storage] ...'
  }

  const item = { 
    method: req.request.method || 'GET', 
    url: resolvedUrl, 
    header: resolvedHeaders, 
    body: resolvedBody,
    statusCode: cache.code, 
    time: new Date().toLocaleTimeString(),
    responseCache: {
      rawText: safeRawText,
      code: cache.code,
      time: cache.time,
      size: cache.size,
      // Save preview state into history
      previewType: cache.previewType || 'none',
      previewHtml: cache.previewHtml || '',
      previewSrc: cache.previewSrc || ''
    }
  }
  
  historyList.value.unshift(item); 
  if (historyList.value.length > 20) historyList.value.pop(); 
  
  // Use localforage to safely store large arrays
  localforage.setItem('litefetch_history', JSON.parse(JSON.stringify(historyList.value)))
}

const clearHistory = () => { 
  historyList.value = []; 
  localforage.setItem('litefetch_history', []);
  ElMessage.success('History cleared.') 
}

// 👉 Core fix: Create a clean dedicated collection for restored history and restore the response snapshot + preview
const restoreHistory = (h) => {
  // 1. Find or create the "Restored History" dedicated collection (without variables)
  let historyCol = store.collections.find(c => c.info?.name === 'Restored History')
  if (!historyCol) {
    historyCol = { 
      _id: 'col_hist_' + Date.now(), 
      info: { name: 'Restored History' }, 
      item: [], 
      variables: [] // Variables pool is permanently empty here!
    }
    store.addCollection(historyCol)
  }
  
  if (!historyCol.item) historyCol.item = []
  if (!historyCol.variables) historyCol.variables = [] 
  
  // 2. Build the restored request
  const newReqId = 'req_' + Math.random().toString(36).substr(2, 9)
  const newReq = { 
    _id: newReqId, 
    name: "History: " + (h.url.split('?')[0].split('/').pop() || 'Request').substring(0, 15), 
    request: { 
      method: h.method || 'GET', 
      url: h.url || '', 
      header: h.header ? JSON.parse(JSON.stringify(h.header)) : [], 
      body: h.body ? JSON.parse(JSON.stringify(h.body)) : { mode: 'raw', raw: '' } 
    } 
  }

  // 👉 3. Core mechanism: Restore response snapshot and preview if it exists in history
  if (h.responseCache) {
    responseCache[newReqId] = {
      mode: 'pretty',
      html: colorizeJSON(h.responseCache.rawText || ''),
      rawText: h.responseCache.rawText || '',
      code: h.responseCache.code || h.statusCode,
      time: h.responseCache.time || '',
      size: h.responseCache.size || '',
      // Restore preview data
      previewType: h.responseCache.previewType || 'none', 
      previewHtml: h.responseCache.previewHtml || '', 
      previewSrc: h.responseCache.previewSrc || ''
    }
  }
  
  // 4. Place into dedicated collection and open
  historyCol.item.push(newReq); 
  store.persist(); 
  store.openTab(newReq); 
  showHistory.value = false; 
  ElMessage.success('History and Response restored!')
}

// Calculate safe coordinates to prevent menu from clipping outside the window
const showContextMenu = (e, type, item, parentArray, index) => { 
  hideAllMenus(); 
  let menuX = e.clientX
  let menuY = e.clientY
  if (window.innerHeight - menuY < 250) menuY = window.innerHeight - 250
  if (window.innerWidth - menuX < 160) menuX = window.innerWidth - 160
  ctxMenu.value = { visible: true, x: menuX, y: menuY, type, item, parentArray, index } 
}
provide('showContextMenu', showContextMenu)

const ctxAction = async (action) => {
  const { type, item, parentArray, index } = ctxMenu.value
  const targetArr = type === 'collection' ? item.item : item.item
  if (action === 'addReq') store.addNewReq(targetArr)
  if (action === 'addFolder') store.addFolder(targetArr)
  if (action === 'duplicate') store.duplicateReq(parentArray, index)
  if (action === 'delete') {
    const typeLabel = type === 'collection' ? 'collection' : (item?.item ? 'folder' : 'request')
    const name = type === 'collection' ? (item?.info?.name || 'Collection') : (item?.name || item?.info?.name || 'Unnamed')
    try {
      await ElMessageBox.confirm(
        `Delete ${typeLabel} \"${name}\"? This action cannot be undone.`,
        'Confirm Delete',
        { confirmButtonText: 'Delete', cancelButtonText: 'Cancel', type: 'warning' }
      )
      type === 'collection' ? store.deleteCol(index) : store.deleteItem(parentArray, index)
      ElMessage.success('Deleted successfully.')
    } catch {
      hideAllMenus()
      return
    }
  }
  if (action === 'moveUp' || action === 'moveDown') {
    const arr = type === 'collection' ? store.collections : parentArray
    if (arr && arr.length > 0) {
      const targetIndex = action === 'moveUp' ? index - 1 : index + 1
      if (targetIndex >= 0 && targetIndex < arr.length) { const temp = arr[index]; arr[index] = arr[targetIndex]; arr[targetIndex] = temp; store.persist() }
    }
  }
  if (action === 'rename') {
    const currentName = (type === 'collection' || type === 'folder')
      ? (item.info?.name || item.name || (type === 'collection' ? 'Collection' : 'Folder'))
      : item.name
    renameDialog.value = { visible: true, name: currentName, type, item }
  }
  hideAllMenus()
}

const confirmRename = () => {
  const { type, item, name } = renameDialog.value;
  if (name && name.trim()) {
    if (type === 'collection' || type === 'folder') { if (!item.info) item.info = {}; item.info.name = name.trim() }
    else item.name = name.trim()

    store.persist()
  }
  
  renameDialog.value.visible = false; ElMessage.success('Renamed successfully.')
}

const onToggle = (id, e) => {
  if (e.target.open) {
    if (!store.expandedFolders.includes(id)) store.expandedFolders.push(id)
  } else {
    store.expandedFolders = store.expandedFolders.filter(x => x !== id)
  }
  store.persistExpandedFolders()
}
const startResizeSidebar = () => { const move = (e) => { sidebarWidth.value = Math.max(200, Math.min(e.clientX, 800)) }; const stop = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', stop) }; document.addEventListener('mousemove', move); document.addEventListener('mouseup', stop) }
const startResizeResponse = () => { const move = (e) => { responseHeight.value = Math.max(100, window.innerHeight - e.clientY) }; const stop = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', stop) }; document.addEventListener('mousemove', move); document.addEventListener('mouseup', stop) }

</script>

<style>
/* Force map our previous variables to pure dark mode */
html.dark {
  --bg: #141414;
  --sidebar: #1d1e1f;
  --border: #303030;
  color-scheme: dark; 
}

body { margin: 0; font-family: "Segoe UI", "Microsoft YaHei", sans-serif; overflow: hidden; height: 100vh; background: var(--bg); color: #e5eaf3; }
#app-container { display: flex; width: 100%; height: 100vh; position: relative; }

/* Sidebar */
#sidebar { background: var(--sidebar); border-right: 1px solid var(--border); display: flex; flex-direction: column; user-select: none; }
.sidebar-header { padding: 15px; border-bottom: 1px solid var(--border); background: var(--bg); }
#collection-repo { flex: 1; overflow-y: auto; padding: 10px; font-size: 13px; color: #a3a6ad; }

/* Resizers */
.resizer-h { width: 4px; background: transparent; cursor: col-resize; z-index: 10; transition: background 0.2s; }
.resizer-h:hover { background: #4c4d4f; }
.resizer-v { height: 4px; background: var(--border); cursor: row-resize; z-index: 10; transition: background 0.2s; }
.resizer-v:hover { background: #4c4d4f; }

/* Main Editor */
#main-editor { flex: 1; display: flex; flex-direction: column; background: var(--bg); min-width: 400px; overflow: hidden; }
#empty-state { flex: 1; display: flex; align-items: center; justify-content: center; flex-direction: column; background: var(--bg); }
#editor-top { flex: 1; display: flex; flex-direction: column; overflow: hidden; }

.editor-tabs-row { display: flex; align-items: center; background: var(--sidebar); }
.editor-tabs-row .custom-editor-tabs { flex: 1; min-width: 0; }

.top-actions-panel {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-right: 12px;
}

.top-icon-btn {
  margin: 0 !important;
  border: 1px solid #414243 !important;
  border-radius: 999px !important;
  background: #242528 !important;
  color: #cfd3dc !important;
  width: 30px;
  height: 30px;
  min-width: 30px !important;
  padding: 0 !important;
}

.top-icon-btn:hover {
  background: #313338 !important;
  color: #ffffff !important;
}

.top-icon-btn:disabled {
  color: #7a7f89 !important;
}

.top-icon-btn.save {
  background: #223224 !important;
  color: #9ad39f !important;
}

.top-icon-btn.save:hover {
  background: #2d4630 !important;
  color: #b7e7bc !important;
}

.top-icon-svg {
  width: 16px;
  height: 16px;
  display: block;
}

.top-icon-svg.code {
  width: 17px;
  height: 17px;
}

/* URL Bar */
.url-bar { display: flex; padding: 12px 15px; border-bottom: 1px solid var(--border); gap: 10px; flex-shrink: 0; background: var(--bg); align-items: center; }

/* Force dropdown poppers to be dark */
.dark-method-popper { background-color: #2b2b2c !important; border: 1px solid #414243 !important; }
.dark-method-popper .el-select-dropdown__item { color: #e5eaf3; }
.dark-method-popper .el-select-dropdown__item.hover, .dark-method-popper .el-select-dropdown__item:hover { background-color: #414243 !important; }
.dark-method-popper .el-popper__arrow::before { background-color: #2b2b2c !important; border: 1px solid #414243 !important; }

/* Fix Tabs height and scrolling mechanism */
.custom-editor-tabs .el-tabs__header { margin: 0; background: var(--sidebar); border-bottom: none !important; box-shadow: none !important; }
.custom-editor-tabs.el-tabs--card > .el-tabs__header { border-bottom: none !important; }
.custom-editor-tabs.el-tabs--card > .el-tabs__header .el-tabs__nav { border: none !important; }
.custom-editor-tabs .el-tabs__nav-wrap::after { height: 0 !important; }
.custom-editor-tabs .el-tabs__item { border-top: none !important; border-color: var(--border) !important; font-size: 13px; color: #a3a6ad; }
.custom-editor-tabs .el-tabs__item.is-active { background: var(--bg); color: #fff; border-bottom-color: transparent !important; }
.custom-editor-tabs.el-tabs--card > .el-tabs__header .el-tabs__item.is-active { border-bottom-color: transparent !important; }
.tab-label { position: relative; display:inline-flex; align-items:center; cursor: grab; user-select: none; transition: opacity 0.15s ease, transform 0.15s ease; }
.is-dragging-tabs .tab-label.is-drag-source { opacity: 0.55; cursor: grabbing; }
.is-dragging-tabs .tab-label.is-drag-target { transform: translateY(-1px); background: rgba(255, 108, 55, 0.08); border-radius: 4px; }
.tab-label.is-drop-left::before,
.tab-label.is-drop-right::after {
  content: '';
  position: absolute;
  top: 2px;
  bottom: 2px;
  width: 2px;
  background: #ff6c37;
  border-radius: 2px;
  box-shadow: 0 0 0 2px rgba(255, 108, 55, 0.18);
}
.tab-label.is-drop-left::before { left: -5px; }
.tab-label.is-drop-right::after { right: -5px; }
.pin-icon { margin-right: 6px; font-size: 12px; color: #e6a23c; }

.tab-content-wrapper { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.config-tabs { flex: 1; display: flex; flex-direction: column; height: 100%; overflow: hidden; }
.config-tabs > .el-tabs__header { margin: 0; padding: 0 15px; }
.config-tabs > .el-tabs__content { flex: 1; overflow-y: auto; }
.pane-container { padding: 15px; min-height: 100%; box-sizing: border-box; }

.dirty-dot { width: 6px; height: 6px; border-radius: 50%; background-color: #e6a23c; margin-right: 6px; display: inline-block; }

/* Response Panel */
#response-panel { display: flex; flex-direction: column; flex-shrink: 0; background: var(--bg); border-top: 1px solid var(--border); }
.res-toolbar { padding: 8px 15px; background: var(--sidebar); display: flex; border-bottom: 1px solid var(--border); align-items: center; }
#responseBody { flex: 1; margin: 0; padding: 15px; background: #1e1e1e; color: #d4d4d4; font-family: monospace; overflow: auto; font-size: 13px; line-height: 1.5; }
.response-preview-box { flex: 1; padding: 12px; background: #1e1e1e; overflow: auto; display: flex; align-items: center; justify-content: center; }
.response-preview-frame { width: 100%; height: 100%; border: none; background: #fff; min-height: 300px; }

/* JSON Highlight */
.json-key { color: #9cdcfe; } .json-string { color: #ce9178; } .json-num { color: #b5cea8; }

/* Markdown & HTML Preview Box */
.html-preview-box { flex: 1; overflow-y: auto; padding: 15px; border: 1px solid var(--border); border-radius: 4px; background: var(--sidebar); font-size: 14px; line-height: 1.6; color: #cfd3dc; }

/* Force all native dropdown menus to be pure black */
.el-popper { background-color: #2b2b2c !important; border: 1px solid #414243 !important; }
.el-popper__arrow::before { background-color: #2b2b2c !important; border: 1px solid #414243 !important; }
.el-select-dropdown__item { color: #cfd3dc !important; }
.el-select-dropdown__item.hover, .el-select-dropdown__item:hover { background-color: #414243 !important; }

/* Custom context menu styles */
.custom-context-menu { position: fixed; z-index: 3000; padding: 6px 0; background-color: #2b2b2c; border: 1px solid #414243; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.4); min-width: 150px; }
.custom-context-menu ul { list-style: none; margin: 0; padding: 0; }
.custom-context-menu li { padding: 8px 16px; font-size: 13px; color: #e5eaf3; cursor: pointer; transition: background 0.1s; }
.custom-context-menu li:hover { background-color: #414243; color: #fff; }
.custom-context-menu .menu-divider { height: 1px; background-color: #414243; margin: 4px 0; }

/* ================= URL Bar Font and Color Optimization ================= */
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

.url-input {
  flex: 1;
  min-width: 0;
}

/* ================= History List Layout Optimization ================= */
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
.env-card { border: 1px solid var(--border); border-radius: 6px; padding: 10px; margin-bottom: 12px; background: var(--sidebar); }

/* ================= Sidebar Top-level Collection Styles ================= */
#collection-repo summary { list-style: none; outline: none; }
#collection-repo summary::-webkit-details-marker { display: none; }
.folder-summary { cursor: pointer; display: flex; align-items: center; border-radius: 4px; transition: background 0.2s; }
.folder-summary:hover { background: #2b2b2c; }

/* Arrow base styles */
.folder-arrow { font-size: 15px; margin-right: 6px; color: #888; transition: transform 0.2s ease; display: inline-block; }
.folder-arrow.is-open { transform: rotate(90deg); color: #cfd3dc; }

/* Arrow turns primary color when top-level collection is expanded */
.top-level-summary .folder-arrow.is-open { color: var(--el-color-primary); }

/* ================= Sidebar Folder Indentation Control ================= */
.folder-content { 
  margin-left: 14px; /* Control vertical line position */
  border-left: 1px solid #414243; /* Vertical line color */
  padding-left: 2px; /* Control text distance from vertical line */
}

/* ================= Fix Table Styles in Rich Text and Markdown ================= */
.html-preview-box table {
  border-collapse: collapse; /* Collapse borders */
  width: 100%;
  margin: 15px 0;
  font-size: 13px;
}

.html-preview-box th, 
.html-preview-box td {
  border: 1px solid #414243; /* Dark theme border color */
  padding: 10px 12px;
  text-align: left;
  line-height: 1.5;
}

.html-preview-box th {
  background-color: #2b2b2c; /* Dark background for table header */
  font-weight: bold;
  color: #e5eaf3;
}

.html-preview-box tr:hover {
  background-color: #272727; /* Slight highlight on row hover */
}
</style>