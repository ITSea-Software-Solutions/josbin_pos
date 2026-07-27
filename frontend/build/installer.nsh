; Josbin POS — installer customisation
;
; A till runs fullscreen and frameless. NSIS' default "app is running"
; check asks the user to close it politely; on a kiosk-style window that
; request can go unanswered, and the upgrade dead-ends with
; "Josbin POS cannot be closed, please close it manually or retry" —
; with no visible window to close. Force-close instead: an upgrade must
; never depend on the operator finding a window.

!macro customCheckAppRunning
  DetailPrint "Closing any running Josbin POS instance…"
  ; /T also takes the Electron helper processes (GPU, renderer, utility).
  nsExec::Exec 'taskkill /F /IM "${APP_EXECUTABLE_FILENAME}" /T'
  Pop $0
  Sleep 1200
!macroend

!macro customInit
  nsExec::Exec 'taskkill /F /IM "${APP_EXECUTABLE_FILENAME}" /T'
  Pop $0
!macroend
