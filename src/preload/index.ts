import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import {
  IpcChannel,
  type CareRequest,
  type ClimbPhase,
  type CareView,
  type CursorNear,
  type PetApi,
  type WalkEnded
} from '../shared/ipc'
import type { ActivityLevel } from '../shared/settings'
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
  onFallStart: (listener) => subscribe<void>(IpcChannel.PetFallStart, () => listener()),
  onLanded: (listener) => subscribe<void>(IpcChannel.PetLanded, () => listener()),
  startJump: () => ipcRenderer.invoke(IpcChannel.PetJumpStart),
  stopJump: () => ipcRenderer.send(IpcChannel.PetJumpStop),
  startClimb: () => ipcRenderer.invoke(IpcChannel.PetClimbStart),
  stopClimb: () => ipcRenderer.send(IpcChannel.PetClimbStop),
  onClimbPhase: (listener) => subscribe<ClimbPhase>(IpcChannel.PetClimbPhase, listener),
  startWalk: (request) => ipcRenderer.invoke(IpcChannel.PetWalkStart, request),
  stopWalk: () => ipcRenderer.send(IpcChannel.PetWalkStop),
  onWalkEnded: (listener) => subscribe<WalkEnded>(IpcChannel.PetWalkEnded, listener),
  onUserIdleChanged: (listener) => subscribe<boolean>(IpcChannel.SystemUserIdle, listener),
  showContextMenu: () => ipcRenderer.send(IpcChannel.PetShowContextMenu),
  onCareState: (listener) => subscribe<CareView | null>(IpcChannel.CareState, listener),
  onCareRequest: (listener) => subscribe<CareRequest>(IpcChannel.CareRequest, listener),
  careAct: (act) => ipcRenderer.invoke(IpcChannel.CareAct, act),
  getLanguage: () => ipcRenderer.invoke(IpcChannel.AppGetLanguage),
  getActivity: () => ipcRenderer.invoke(IpcChannel.PetGetActivity),
  onActivityChanged: (listener) =>
    subscribe<ActivityLevel>(IpcChannel.PetActivityChanged, listener),
  onLanguageChanged: (listener) => subscribe<Language>(IpcChannel.AppLanguageChanged, listener),
  getFocus: () => ipcRenderer.invoke(IpcChannel.FocusGet),
  onFocusState: (listener) => subscribe<FocusView>(IpcChannel.FocusState, listener),
  onFocusReaction: (listener) => subscribe<FocusReaction>(IpcChannel.FocusReaction, listener),
  setLookWatch: (on) => ipcRenderer.send(IpcChannel.PetLookWatch, on),
  onCursor: (listener) => subscribe<CursorNear>(IpcChannel.PetCursor, listener)
}

contextBridge.exposeInMainWorld('petApi', petApi)
