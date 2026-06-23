import { defineStore } from 'pinia'

export const useCollectionStore = defineStore('collection', {
  state: () => ({
    collections: JSON.parse(localStorage.getItem('pilot_collections') || '[]'),
    expandedFolders: JSON.parse(localStorage.getItem('pilot_expanded_folders') || '[]'),
    pythonExePath: localStorage.getItem('pilot_python_exe') || '',
    pythonScriptPath: localStorage.getItem('pilot_python_script') || '',
    pythonVars: {},
    openTabs: [],
    activeTabId: null
  }),
  getters: {
    activeTab: (state) => state.openTabs.find(t => t._id === state.activeTabId),
    activeRequest: (state) => {
      const tab = state.openTabs.find(t => t._id === state.activeTabId)
      return tab ? tab.draftReq : null
    },
    isTabDirty: (state) => (tabId) => {
      const tab = state.openTabs.find(t => t._id === tabId)
      if (!tab) return false
      return JSON.stringify(tab.draftReq) !== tab.originalReq
    },
    // [找回丢失的功能]：精准定位当前激活请求所属的 Collection
    activeCollection(state) {
      if (state.collections.length === 0) return null
      let target = state.collections[0]
      if (state.activeTabId) {
        const findCol = (items, targetId) => {
          if (!items) return false
          for (let i of items) {
            if (i._id === targetId) return true
            if (i.item && findCol(i.item, targetId)) return true
          }
          return false
        }
        for (let col of state.collections) {
          if (col._id === state.activeTabId || findCol(col.item, state.activeTabId)) {
            target = col; break
          }
        }
      }
      // 兜底防御：如果集合里没有 variables 数组，自动初始化一个
      if (target && !target.variables) target.variables = [] 
      return target
    },
    // [找回丢失的功能]：变量冲突检测
    hasConflict(state) {
      const col = this.activeCollection
      if (!col || !col.variables) return false
      const staticKeys = col.variables.map(v => v.key).filter(k => k)
      const dynamicKeys = Object.keys(state.pythonVars || {})
      return staticKeys.some(k => dynamicKeys.includes(k))
    }
  },
  actions: {
    normalizePinnedTabOrder() {
      const pinnedTabs = this.openTabs.filter(t => t.pinned)
      const unpinnedTabs = this.openTabs.filter(t => !t.pinned)
      this.openTabs = [...pinnedTabs, ...unpinnedTabs]
    },
    setTabPinned(tabId, pinned) {
      const tabIndex = this.openTabs.findIndex(t => t._id === tabId)
      if (tabIndex === -1) return
      const tab = this.openTabs[tabIndex]
      if (tab.pinned === pinned) return

      tab.pinned = pinned
      this.openTabs.splice(tabIndex, 1)

      const firstUnpinnedIndex = this.openTabs.findIndex(t => !t.pinned)
      const insertIndex = firstUnpinnedIndex === -1 ? this.openTabs.length : firstUnpinnedIndex
      this.openTabs.splice(insertIndex, 0, tab)
      this.normalizePinnedTabOrder()
    },
    moveTab(sourceTabId, targetTabId, position = 'left') {
      if (!sourceTabId || !targetTabId || sourceTabId === targetTabId) return
      const sourceIndex = this.openTabs.findIndex(t => t._id === sourceTabId)
      const targetIndex = this.openTabs.findIndex(t => t._id === targetTabId)
      if (sourceIndex < 0 || targetIndex < 0) return

      const tabs = [...this.openTabs]
      const [moved] = tabs.splice(sourceIndex, 1)
      const normalizedTargetIndex = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex
      const insertIndex = position === 'right' ? normalizedTargetIndex + 1 : normalizedTargetIndex
      tabs.splice(insertIndex, 0, moved)
      this.openTabs = tabs
      this.normalizePinnedTabOrder()
    },
    // 输入 URL 时失去焦点，自动把 {{xxx}} 提取到当前请求变量表
    extractUrlVariables() {
      const req = this.activeRequest
      if (!req || !req.request.url) return
      const matches = req.request.url.match(/\{\{(.*?)\}\}/g)
      if (matches) {
        if (!req.variables) req.variables = []
        matches.forEach(match => {
          const key = match.replace(/[{}]/g, '').trim()
          if (key && !req.variables.find(v => v.key === key)) {
            req.variables.push({ key, value: '' })
          }
        })
      }
    },
    openTab(req) {
      let tab = this.openTabs.find(t => t._id === req._id)
      if (!tab) {
        tab = {
          _id: req._id, name: req.name, method: req.request.method, pinned: false,
          originalReq: JSON.stringify(req), draftReq: JSON.parse(JSON.stringify(req))
        }
        this.openTabs.push(tab)
      }
      this.activeTabId = req._id
    },
    saveTab(tabId) {
      const tab = this.openTabs.find(t => t._id === tabId)
      if (!tab) return
      const updateNode = (nodes) => {
        for (let i = 0; i < nodes.length; i++) {
          if (nodes[i]._id === tabId) {
            nodes[i] = JSON.parse(JSON.stringify(tab.draftReq))
            tab.originalReq = JSON.stringify(nodes[i]); tab.name = nodes[i].name; tab.method = nodes[i].request.method;
            return true
          }
          if (nodes[i].item && updateNode(nodes[i].item)) return true
        }
        return false
      }
      for (let c of this.collections) {
        if (c._id === tabId) { Object.assign(c, JSON.parse(JSON.stringify(tab.draftReq))); tab.originalReq = JSON.stringify(c); break; }
        if (c.item && updateNode(c.item)) break;
      }
      this.persist()
    },
    closeTab(tabId) {
      this.openTabs = this.openTabs.filter(t => t._id !== tabId)
      if (this.activeTabId === tabId) this.activeTabId = this.openTabs.length > 0 ? this.openTabs[this.openTabs.length - 1]._id : null
    },
    persistExpandedFolders() {
      localStorage.setItem('pilot_expanded_folders', JSON.stringify(this.expandedFolders))
    },
    persist() { localStorage.setItem('pilot_collections', JSON.stringify(this.collections)) },
    addCollection(data) { this.collections.push(data); this.persist() },
    addFolder(arr) { arr.push({ _id: 'fld_' + Date.now(), info: { name: 'New Folder' }, item: [] }); this.persist() },
    addNewReq(arr) {
      const newReq = { _id: 'req_' + Date.now(), name: 'New Request', notes: '', variables: [], request: { method: 'GET', url: '', header: [], body: { mode: 'raw', raw: '' }, description: '' } }
      arr.push(newReq); this.persist(); this.openTab(newReq);
    },
    duplicateReq(arr, index) {
      const cloned = JSON.parse(JSON.stringify(arr[index]))
      cloned._id = 'req_' + Date.now(); cloned.name += ' (Copy)'
      arr.splice(index + 1, 0, cloned); this.persist()
    },
    deleteItem(arr, index) {
      const id = arr[index]._id; arr.splice(index, 1); this.persist()
      if (this.openTabs.find(t => t._id === id)) this.closeTab(id)
    },
    deleteCol(index) {
      const id = this.collections[index]._id; this.collections.splice(index, 1); this.persist()
      if (this.openTabs.find(t => t._id === id)) this.closeTab(id)
    }
  }
})
