import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IpcChannel, type ActionsApi, type ActionsLayout } from '../shared/ipc'

/** The quick buttons window (requirement-v9.md): its layout in, pointer and clicks out. */
const actionsApi: ActionsApi = {
  setIgnoreMouseEvents: (ignore) => ipcRenderer.send(IpcChannel.ActionsSetIgnoreMouse, ignore),
  setHover: (over) => ipcRenderer.send(IpcChannel.ActionsHover, over),
  run: (id) => ipcRenderer.send(IpcChannel.ActionsRun, id),
  onLayout: (listener) => {
    const handler = (_event: IpcRendererEvent, layout: ActionsLayout): void => listener(layout)
    ipcRenderer.on(IpcChannel.ActionsLayout, handler)
    return () => ipcRenderer.removeListener(IpcChannel.ActionsLayout, handler)
  },
  onHide: (listener) => {
    const handler = (): void => listener()
    ipcRenderer.on(IpcChannel.ActionsHide, handler)
    return () => ipcRenderer.removeListener(IpcChannel.ActionsHide, handler)
  }
}

contextBridge.exposeInMainWorld('actionsApi', actionsApi)
