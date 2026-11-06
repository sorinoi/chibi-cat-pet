import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IpcChannel, type AdoptApi } from '../shared/ipc'
import type { Language } from '../shared/strings'

/** The adoption window can adopt (FR-22) and follow the UI language; nothing else. */
const adoptApi: AdoptApi = {
  adopt: (name) => ipcRenderer.invoke(IpcChannel.CareAdopt, name),
  getLanguage: () => ipcRenderer.invoke(IpcChannel.AppGetLanguage),
  onLanguageChanged: (listener) => {
    const handler = (_event: IpcRendererEvent, language: Language): void => listener(language)
    ipcRenderer.on(IpcChannel.AppLanguageChanged, handler)
    return () => ipcRenderer.removeListener(IpcChannel.AppLanguageChanged, handler)
  }
}

contextBridge.exposeInMainWorld('adoptApi', adoptApi)
