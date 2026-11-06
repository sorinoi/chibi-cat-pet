import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import {
  IpcChannel,
  type CareRequest,
  type CareView,
  type PetApi,
  type WalkEnded
} from '../shared/ipc'
import type { Language } from '../shared/strings'
import type { FocusReaction, FocusView } from '../shared/focusText'

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
  showContextMenu: () => ipcRenderer.send(IpcChannel.PetShowContextMenu),
  onCareState: (listener) => subscribe<CareView | null>(IpcChannel.CareState, listener),
  onCareRequest: (listener) => subscribe<CareRequest>(IpcChannel.CareRequest, listener),
  careAct: (act) => ipcRenderer.invoke(IpcChannel.CareAct, act),
  getLanguage: () => ipcRenderer.invoke(IpcChannel.AppGetLanguage),
  onLanguageChanged: (listener) => subscribe<Language>(IpcChannel.AppLanguageChanged, listener),
  getFocus: () => ipcRenderer.invoke(IpcChannel.FocusGet),
  onFocusState: (listener) => subscribe<FocusView>(IpcChannel.FocusState, listener),
  onFocusReaction: (listener) => subscribe<FocusReaction>(IpcChannel.FocusReaction, listener)
}

contextBridge.exposeInMainWorld('petApi', petApi)
