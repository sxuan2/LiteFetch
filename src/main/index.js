import { app, shell, BrowserWindow, ipcMain, Menu, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { spawn } from 'child_process'
import axios from 'axios'
import fs from 'fs'
import path from 'path'

let mainWindow = null
let backupWindow = null

// --- 备份逻辑配置 ---
const configPath = path.join(app.getPath('userData'), 'backup-config.json')
let backupConfig = {
  enabled: false,
  folder: '',
  frequency: 'daily',
  time: '02:00',
  dayOfWeek: 0,
  maxDays: 30,
  lastBackupDate: ''
}

if (fs.existsSync(configPath)) {
  try {
    backupConfig = { ...backupConfig, ...JSON.parse(fs.readFileSync(configPath, 'utf-8')) }
  } catch (err) { console.error('Failed to load backup config:', err) }
}

function saveBackupConfig() {
  fs.writeFileSync(configPath, JSON.stringify(backupConfig, null, 2))
}

async function executeBackup(isManual = false) {
  // 修复 1：增加 mainWindow.isDestroyed() 防止窗口被关闭后报错
  if (!mainWindow || mainWindow.isDestroyed() || !backupConfig.folder || !fs.existsSync(backupConfig.folder)) {
    if (isManual) throw new Error('Invalid backup folder or main window not ready.')
    return false
  }
  try {
    const dataToExport = await mainWindow.webContents.executeJavaScript(`
      ({
        collections: JSON.parse(localStorage.getItem('pilot_collections') || '[]'),
        expandedFolders: JSON.parse(localStorage.getItem('pilot_expanded_folders') || '[]'),
        history: JSON.parse(localStorage.getItem('litefetch_history') || '[]'),
        pythonExe: localStorage.getItem('pilot_python_exe') || '',
        pythonScript: localStorage.getItem('pilot_python_script') || '',
        environments: JSON.parse(localStorage.getItem('litefetch_environments') || 'null'),
        activeEnv: localStorage.getItem('litefetch_active_env') || ''
      })
    `)
    const now = new Date()
    const pad = (n) => String(n).padStart(2, '0')
    const fileName = `LiteFetch_Backup_${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}.json`
    fs.writeFileSync(path.join(backupConfig.folder, fileName), JSON.stringify(dataToExport, null, 2))
    
    cleanOldBackups()
    return true
  } catch (err) {
    if (isManual) throw err
    return false
  }
}

function cleanOldBackups() {
  if (!backupConfig.folder || !fs.existsSync(backupConfig.folder)) return
  const files = fs.readdirSync(backupConfig.folder)
  const now = Date.now()
  const maxAgeMs = backupConfig.maxDays * 24 * 60 * 60 * 1000
  files.forEach(file => {
    if (file.startsWith('LiteFetch_Backup_') && file.endsWith('.json')) {
      const stats = fs.statSync(path.join(backupConfig.folder, file))
      if (now - stats.mtimeMs > maxAgeMs) fs.unlinkSync(path.join(backupConfig.folder, file))
    }
  })
}

// 修复 2：自动备份轮询：改为高精度 10 秒级轮询，并立即上锁
setInterval(() => {
  if (!backupConfig.enabled || !backupConfig.folder) return
  if (!mainWindow || mainWindow.isDestroyed()) return

  const now = new Date()
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  // 如果今天已经自动备份过，跳过
  if (backupConfig.lastBackupDate === todayStr) return

  const timeMatches = currentTime === backupConfig.time

  if ((backupConfig.frequency === 'daily' && timeMatches) || 
      (backupConfig.frequency === 'weekly' && now.getDay() === backupConfig.dayOfWeek && timeMatches)) {
    
    // 先立即上锁，防止这 1 分钟内被执行多次
    backupConfig.lastBackupDate = todayStr
    saveBackupConfig()
    
    // 静默执行备份
    executeBackup(false).catch(err => console.error('Auto backup failed:', err))
  }
}, 10000)

function openBackupWindow() {
  if (backupWindow) { backupWindow.focus(); return }
  backupWindow = new BrowserWindow({
    width: 650, height: 700, title: 'Backup Settings',
    autoHideMenuBar: true, resizable: false,
    webPreferences: { 
      preload: join(__dirname, '../preload/index.js'), 
      contextIsolation: true, 
      nodeIntegration: false,
      sandbox: false
    }
  })
  
  // 解决加载本地文件的安全拦截问题
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    backupWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '/backup.html')
  } else {
    backupWindow.loadFile(join(__dirname, '../renderer/backup.html'))
  }
  
  backupWindow.on('closed', () => { backupWindow = null })
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    show: false,
    title: 'LiteFetch',
    icon: 'resources/icon.png',
    autoHideMenuBar: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true
    }
  })

  mainWindow.on('page-title-updated', (evt) => {
    evt.preventDefault()
  })

  // === 完整保留您自定义的菜单栏排版 ===
  const menuTemplate = [
    {
      label: 'Menu',
      submenu: [
        { label: 'Backup Settings', click: openBackupWindow },
        { 
          label: 'Backup Now', 
          click: async () => {
            try {
              await executeBackup(true)
              dialog.showMessageBox(mainWindow, { type: 'info', message: 'Manual backup completed successfully!' })
            } catch (e) {
              dialog.showErrorBox('Backup Failed', e.message)
            }
          } 
        },
        { type: 'separator' },
        { role: 'quit', label: 'Exit' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload', label: 'Reload' },
        { role: 'toggledevtools', label: 'Toggle Developer Tools' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Actual Size' },
        { role: 'zoomIn', label: 'Zoom In' },
        { role: 'zoomOut', label: 'Zoom Out' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Toggle Full Screen' }
      ]
    },
    {
      label: 'About',
      submenu: [
        {
          label: 'About LiteFetch',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About LiteFetch',
              message: 'LiteFetch v1.0.4',
              detail: 'A blazing fast, modern API client build by Sijian Xuan',
              buttons: ['OK']
            })
          }
        }
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(menuTemplate)
  Menu.setApplicationMenu(menu)

  mainWindow.on('ready-to-show', () => mainWindow.show())
  mainWindow.webContents.setWindowOpenHandler((details) => { shell.openExternal(details.url); return { action: 'deny' } })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.litefetch.app')
  app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))

  // --- 原有的所有 IPC Handlers 完整保留 ---
  ipcMain.handle('import-postman-raw', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'], filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (canceled || filePaths.length === 0) return null
    try {
      return JSON.parse(fs.readFileSync(filePaths[0], 'utf-8'))
    } catch {
      throw new Error('Invalid JSON format in selected Postman file.')
    }
  })

  ipcMain.handle('open-external', async (event, url) => {
    if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) return false
    await shell.openExternal(url)
    return true
  })

  ipcMain.handle('http-request', async (event, config = {}) => {
    const { method = 'GET', url = '', headers = {}, data, timeout = 15000 } = config
    try {
      const res = await axios({ method, url, headers, data, timeout })
      return {
        ok: true,
        status: res.status,
        statusText: res.statusText,
        headers: res.headers || {},
        data: res.data
      }
    } catch (err) {
      if (err.response) {
        return {
          ok: false,
          status: err.response.status,
          statusText: err.response.statusText,
          headers: err.response.headers || {},
          data: err.response.data,
          message: err.message
        }
      }
      return { ok: false, status: 0, statusText: 'ERROR', headers: {}, data: err.message, message: err.message }
    }
  })

  ipcMain.handle('select-file', async (event, filters) => {
    const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openFile'], filters: filters })
    return canceled ? null : filePaths[0]
  })

  ipcMain.handle('run-python', async (event, scriptPath, pythonExePath) => {
    return new Promise((resolve, reject) => {
      const exePath = (pythonExePath || 'python').trim()
      const isNamedPython = ['python', 'python3', 'py'].includes(exePath.toLowerCase())
      if (!isNamedPython && !path.isAbsolute(exePath)) {
        reject('Invalid python executable path.')
        return
      }
      if (!isNamedPython) {
        const ext = path.extname(exePath).toLowerCase()
        if (!fs.existsSync(exePath) || (process.platform === 'win32' && ext !== '.exe')) {
          reject('Python executable not found or invalid.')
          return
        }
      }

      const absPath = path.isAbsolute(scriptPath) ? scriptPath : path.join(app.getAppPath(), scriptPath)
      if (!fs.existsSync(absPath)) {
        reject('Python script file does not exist.')
        return
      }

      const python = spawn(exePath, [absPath])
      const MAX_OUTPUT_BYTES = 1024 * 1024 // 1MB
      const TIMEOUT_MS = 30_000
      let settled = false
      let dataString = '', errorString = ''
      const timeout = setTimeout(() => {
        if (settled) return
        settled = true
        python.kill()
        reject(`Python script timed out after ${TIMEOUT_MS / 1000}s.`)
      }, TIMEOUT_MS)

      python.stdout.on('data', (data) => {
        if (settled) return
        dataString += data.toString()
        if (Buffer.byteLength(dataString, 'utf8') > MAX_OUTPUT_BYTES) {
          settled = true
          clearTimeout(timeout)
          python.kill()
          reject('Python script output exceeded 1MB limit.')
        }
      })
      python.stderr.on('data', (data) => {
        if (settled) return
        errorString += data.toString()
        if (Buffer.byteLength(errorString, 'utf8') > MAX_OUTPUT_BYTES) {
          settled = true
          clearTimeout(timeout)
          python.kill()
          reject('Python script error output exceeded 1MB limit.')
        }
      })
      python.on('error', (err) => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        reject(err.message || 'Failed to launch Python process.')
      })
      python.on('close', (code) => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        if (code === 0) {
          try { resolve(JSON.parse(dataString.trim())) } catch (e) { reject("Parse Error: " + dataString) }
        } else { reject(errorString) }
      })
    })
  })

  // --- 新增：备份系统专用的 IPC Handlers ---
  ipcMain.handle('backup-get-config', () => backupConfig)
  ipcMain.handle('backup-save-config', (e, c) => { 
    // 修复 3：保存设置时清空当天的记录，方便您无限次测试定时器！
    backupConfig.lastBackupDate = ''
    backupConfig = { ...backupConfig, ...c }
    saveBackupConfig()
    return true 
  })
  ipcMain.handle('backup-select-folder', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    return canceled ? null : filePaths[0]
  })
  ipcMain.handle('backup-get-files', () => {
    if (!backupConfig.folder || !fs.existsSync(backupConfig.folder)) return []
    return fs.readdirSync(backupConfig.folder)
      .filter(f => f.startsWith('LiteFetch_Backup_') && f.endsWith('.json'))
      .map(f => {
        const s = fs.statSync(path.join(backupConfig.folder, f))
        return { name: f, size: s.size, time: s.mtimeMs, path: path.join(backupConfig.folder, f) }
      }).sort((a, b) => b.time - a.time)
  })
  ipcMain.handle('backup-execute-now', async () => {
    try { await executeBackup(true); return { success: true } }
    catch (e) { return { success: false, message: e.message } }
  })
  ipcMain.handle('backup-restore-file', async (e, p) => {
    try {
      const data = JSON.parse(fs.readFileSync(p, 'utf-8'))
      await mainWindow.webContents.executeJavaScript(`
        localStorage.setItem('pilot_collections', JSON.stringify(${JSON.stringify(data.collections || [])}));
        localStorage.setItem('pilot_expanded_folders', JSON.stringify(${JSON.stringify(data.expandedFolders || [])}));
        localStorage.setItem('litefetch_history', JSON.stringify(${JSON.stringify(data.history || [])}));
        if (${JSON.stringify(data.pythonExe)}) localStorage.setItem('pilot_python_exe', ${JSON.stringify(data.pythonExe)});
        if (${JSON.stringify(data.pythonScript)}) localStorage.setItem('pilot_python_script', ${JSON.stringify(data.pythonScript)});
        if (${JSON.stringify(data.environments)}) localStorage.setItem('litefetch_environments', JSON.stringify(${JSON.stringify(data.environments)}));
        if (${JSON.stringify(data.activeEnv)}) localStorage.setItem('litefetch_active_env', ${JSON.stringify(data.activeEnv)});
        window.location.reload();
      `)
      return { success: true }
    } catch (err) { return { success: false, message: err.message } }
  })
  ipcMain.handle('backup-delete-file', async (e, p) => {
    try { fs.unlinkSync(p); return { success: true } }
    catch (e) { return { success: false, message: e.message } }
  })

  createWindow()
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })