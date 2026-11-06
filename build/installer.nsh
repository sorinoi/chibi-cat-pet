; Extra uninstall steps (NFR-08: no stray files or registry values).
; "DesktopPet" must match LOGIN_ITEM_NAME in src/main/config.ts.
!macro customUnInstall
  ${ifNot} ${isUpdated}
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "DesktopPet"
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run" "DesktopPet"
    ; The installer keeps a copy of itself here for differential updates, which this app
    ; does not use. Without this it stays behind (about 110 MB).
    RMDir /r "$LOCALAPPDATA\${APP_PACKAGE_NAME}-updater"
  ${endIf}
!macroend
