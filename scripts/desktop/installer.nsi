; 云境 v6.9.4 Windows 安装器 (NSIS Unicode)
; 严格复刻 electron-builder 官方解压逻辑：
;   嵌入 7z 时 SetCompress off（避免二次压缩），
;   解压先用 nsis7z 到临时 7z-out 目录，再 CopyFiles 到安装目录（原子、可重试）。
; 用 zlib 整体压缩，规避 8GB 内存限额下的 lzma solid OOM。

Unicode true

!define PRODUCT_NAME "云境"
!define PRODUCT_VERSION "7.0.6"
!define PRODUCT_PUBLISHER "云境工作室"
!define PRODUCT_WEB_SITE "https://github.com/AYun07/yunjing"
!define PRODUCT_DIR_REGKEY "Software\Microsoft\Windows\CurrentVersion\App Paths\YunJing.exe"
!define PRODUCT_UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}"
!define PRODUCT_UNINST_ROOT_KEY "HKCU"
!define APP_EXE "YunJing.exe"

Name "${PRODUCT_NAME} ${PRODUCT_VERSION}"
OutFile "云境-Windows-7.0.6-x64.exe"
InstallDir "$LOCALAPPDATA\Programs\云境"
InstallDirRegKey HKCU "${PRODUCT_DIR_REGKEY}" ""
RequestExecutionLevel user
ShowInstDetails show
ShowUnInstDetails show
SetCompressor zlib

!addplugindir "plugins"
!include "MUI2.nsh"
!include "FileFunc.nsh"

!define MUI_ABORTWARNING
!define MUI_ICON "icon.ico"
!define MUI_UNICON "icon.ico"
!define MUI_FINISHPAGE_TITLE "云境安装完成"
!define MUI_FINISHPAGE_TEXT "云境已安装完成。点击完成即可启动。"
!define MUI_FINISHPAGE_RUN "$INSTDIR\${APP_EXE}"
!define MUI_FINISHPAGE_RUN_TEXT "立即启动云境"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "license.txt"
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "SimpChinese"

Section "云境主程序" SEC_MAIN
  SectionIn RO

  ; ---- 嵌入 7z 时关闭 NSIS 压缩（复刻官方），避免二次压缩 ----
  SetCompress off
  SetOutPath "$PLUGINSDIR"
  File /oname=app-64.7z "app-64.7z"
  SetCompress auto

  DetailPrint "正在解压云境程序文件，请稍候..."

  ; ---- 复刻官方 extractUsing7za：先解压到临时目录，再 CopyFiles ----
  Push $OUTDIR
  CreateDirectory "$PLUGINSDIR\7z-out"
  ClearErrors
  SetOutPath "$PLUGINSDIR\7z-out"
  Nsis7z::Extract "$PLUGINSDIR\app-64.7z"
  Pop $R0
  SetOutPath $R0

  ; ---- DR-101：覆盖安装时强制删除旧 app.asar ----
  ; 旧版 asar 若因时间戳/占用未覆盖，会残留缺 content-sync.js 的坏包，
  ; 导致启动报 "Cannot find module './content-sync.js'"。先删再复制，杜绝残留。
  Delete "$INSTDIR\resources\app.asar"
  Delete "$INSTDIR\app.asar"

  StrCpy $R1 0
  LoopExtract:
    IntOp $R1 $R1 + 1
    SetOutPath "$INSTDIR"
    CopyFiles /SILENT "$PLUGINSDIR\7z-out\*" "$INSTDIR"
    IfErrors 0 DoneExtract
    DetailPrint "文件复制重试 $R1 ..."
    ${if} $R1 < 5
      Goto LoopExtract
    ${else}
      MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "无法写入程序文件，请关闭正在运行的云境后重试。错误：$R0" /SD IDCANCEL IDCANCEL AbortExtract
      Goto DoneExtract
    ${endIf}
  AbortExtract:
    Quit
  DoneExtract:
  Pop $OUTDIR
  SetOutPath $OUTDIR

  ; 主程序存在性校验
  IfFileExists "$INSTDIR\${APP_EXE}" exeOk
    MessageBox MB_OK|MB_ICONEXCLAMATION "未找到主程序 ${APP_EXE}，安装异常（解压返回：$R0）。"
    Quit
  exeOk:

  ; 写卸载注册表
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "DisplayName" "${PRODUCT_NAME} ${PRODUCT_VERSION}"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "UninstallString" "$\"$INSTDIR\uninst.exe$\""
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "DisplayIcon" "$\"$INSTDIR\${APP_EXE}$\""
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "DisplayVersion" "${PRODUCT_VERSION}"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "Publisher" "${PRODUCT_PUBLISHER}"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "URLInfoAbout" "${PRODUCT_WEB_SITE}"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_DIR_REGKEY}" "" "$INSTDIR\${APP_EXE}"

  WriteUninstaller "$INSTDIR\uninst.exe"

  CreateDirectory "$SMPROGRAMS\${PRODUCT_NAME}"
  CreateShortCut "$SMPROGRAMS\${PRODUCT_NAME}\${PRODUCT_NAME}.lnk" "$INSTDIR\${APP_EXE}" "" "$INSTDIR\${APP_EXE}" 0
  CreateShortCut "$SMPROGRAMS\${PRODUCT_NAME}\卸载${PRODUCT_NAME}.lnk" "$INSTDIR\uninst.exe"
  CreateShortCut "$DESKTOP\${PRODUCT_NAME}.lnk" "$INSTDIR\${APP_EXE}" "" "$INSTDIR\${APP_EXE}" 0
SectionEnd

Section "Uninstall"
  Delete "$DESKTOP\${PRODUCT_NAME}.lnk"
  Delete "$SMPROGRAMS\${PRODUCT_NAME}\${PRODUCT_NAME}.lnk"
  Delete "$SMPROGRAMS\${PRODUCT_NAME}\卸载${PRODUCT_NAME}.lnk"
  RMDir "$SMPROGRAMS\${PRODUCT_NAME}"
  DeleteRegKey ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}"
  DeleteRegKey ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_DIR_REGKEY}"
  RMDir /r "$INSTDIR"
SectionEnd

Function .onInit
  IfFileExists "$INSTDIR\${APP_EXE}" 0 noExisting
    MessageBox MB_YESNO "检测到已安装的云境，是否覆盖安装（保留存档）？" /SD IDYES IDYES noExisting IDNO abortInstall
    abortInstall:
      Abort
  noExisting:
FunctionEnd
