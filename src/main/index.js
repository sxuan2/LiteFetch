import { app, shell, BrowserWindow, ipcMain, Menu, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { spawn } from 'child_process'
import axios from 'axios'
import fs from 'fs'
import path from 'path'

function createWindow() {
  const mainWindow = new BrowserWindow({
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

  // 2. 定义你自己的系统菜单模板
  const menuTemplate = [
    {
      label: 'File',
      submenu: [
        { role: 'quit', label: 'Exit' } // 退出应用
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload', label: 'Reload' },
        { role: 'toggledevtools', label: 'Toggle Developer Tools' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Actual Size' },     // 恢复默认大小
        { role: 'zoomIn', label: 'Zoom In' },            // 放大
        { role: 'zoomOut', label: 'Zoom Out' },          // 缩小
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Toggle Full Screen' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About LiteFetch',
          click: () => {
            // 调用系统的原生弹窗展示 About 信息
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

  // 3. 将模板编译为菜单并设置为全局应用菜单
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

  createWindow()
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })