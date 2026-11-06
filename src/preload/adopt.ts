import { contextBridge, ipcRenderer } from 'electron'
import { IpcChannel, type AdoptApi } from '../shared/ipc'

/** The adoption window can only adopt (FR-22); nothing else is exposed. */
const adoptApi: AdoptApi = {
  adopt: (name) => ipcRenderer.invoke(IpcChannel.CareAdopt, name)
}

contextBridge.exposeInMainWorld('adoptApi', adoptApi)
