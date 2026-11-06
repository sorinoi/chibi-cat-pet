import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IpcChannel, type PetApi, type WalkEnded } from '../shared/ipc'

/** Subscribes without leaking the IpcRendererEvent (and its sender) to the page. */
function subscribe<T>(channel: string, listener: (payload: T) => void): () => void {
  const handler = (_event: IpcRendererEvent, payload: T): void => listener(payload)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

const petApi: PetApi = {
  setIgnoreMouseEvents: (ignore) => ipcRenderer.send(IpcChannel.WindowSetIgnoreMouse, ignore),
  startDrag: () => ipcRenderer.send(IpcChannel.PetDragStart),
  endDrag: () => ipcRenderer.send(IpcChannel.PetDragEnd),
  startWalk: (request) => ipcRenderer.invoke(IpcChannel.PetWalkStart, request),
  stopWalk: () => ipcRenderer.send(IpcChannel.PetWalkStop),
  onWalkEnded: (listener) => subscribe<WalkEnded>(IpcChannel.PetWalkEnded, listener),
  onUserIdleChanged: (listener) => subscribe<boolean>(IpcChannel.SystemUserIdle, listener),
  showContextMenu: () => ipcRenderer.send(IpcChannel.PetShowContextMenu)
}

contextBridge.exposeInMainWorld('petApi', petApi)
