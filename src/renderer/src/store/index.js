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
    // [找回丢失的功能]：输入 URL 时失去焦点，自动把 {{xxx}} 提取到变量表
    extractUrlVariables() {
      const req = this.activeRequest
      if (!req || !req.request.url) return
      const matches = req.request.url.match(/\{\{(.*?)\}\}/g)
      if (matches) {
        const col = this.activeCollection
        if (!col) return
        let added = false
        matches.forEach(match => {
          const key = match.replace(/[{}]/g, '').trim()
          // 如果提取到的变量不在表里，就自动加进去
          if (key && !col.variables.find(v => v.key === key)) {
            col.variables.push({ key, value: '' })
            added = true
          }
        })
        if (added) this.persist()
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
    persist() { localStorage.setItem('pilot_collections', JSON.stringify(this.collections)) },
    addCollection(data) { this.collections.push(data); this.persist() },
    addFolder(arr) { arr.push({ _id: 'fld_' + Date.now(), info: { name: 'New Folder' }, item: [] }); this.persist() },
    addNewReq(arr) {
      const newReq = { _id: 'req_' + Date.now(), name: 'New Request', request: { method: 'GET', url: '', header: [], body: { mode: 'raw', raw: '' } } }
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