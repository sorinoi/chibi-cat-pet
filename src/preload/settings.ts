import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IpcChannel, type CareView, type SettingsApi } from '../shared/ipc'
import type { Settings } from '../shared/settings'
import type { FocusView } from '../shared/focusText'

function subscribe<T>(channel: string, listener: (payload: T) => void): () => void {
  const handler = (_event: IpcRendererEvent, payload: T): void => listener(payload)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

const settingsApi: SettingsApi = {
  get: () => ipcRenderer.invoke(IpcChannel.SettingsGet),
  update: (patch) => ipcRenderer.invoke(IpcChannel.SettingsUpdate, patch),
  onChanged: (listener) => subscribe<Settings>(IpcChannel.SettingsChanged, listener),
  getCare: () => ipcRenderer.invoke(IpcChannel.CareGet),
  onCareChanged: (listener) => subscribe<CareView | null>(IpcChannel.CareChanged, listener),
  renamePet: (name) => ipcRenderer.invoke(IpcChannel.CareRename, name),
  adoptNew: () => ipcRenderer.invoke(IpcChannel.CareAdoptNew),
  openAdopt: () => ipcRenderer.send(IpcChannel.CareOpenAdopt),
  getFocus: () => ipcRenderer.invoke(IpcChannel.FocusGet),
  onFocusChanged: (listener) => subscribe<FocusView>(IpcChannel.FocusState, listener)
}

contextBridge.exposeInMainWorld('settingsApi', settingsApi)
