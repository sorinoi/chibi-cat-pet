import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IpcChannel, type SettingsApi } from '../shared/ipc'
import type { Settings } from '../shared/settings'

const settingsApi: SettingsApi = {
  get: () => ipcRenderer.invoke(IpcChannel.SettingsGet),
  update: (patch) => ipcRenderer.invoke(IpcChannel.SettingsUpdate, patch),
  onChanged: (listener) => {
    const handler = (_event: IpcRendererEvent, settings: Settings): void => listener(settings)
    ipcRenderer.on(IpcChannel.SettingsChanged, handler)
    return () => ipcRenderer.removeListener(IpcChannel.SettingsChanged, handler)
  }
}

contextBridge.exposeInMainWorld('settingsApi', settingsApi)
