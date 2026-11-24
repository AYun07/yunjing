; 云境 v6.9.4 Windows 安装器 (NSIS Unicode)
; 应用主体 app-64.7z 内嵌，安装时由 nsis7z 插件解压到安装目录
; 独立构建，不依赖 electron-builder 运行时的复杂变量注入

Unicode true

; ---------- 基本信息 ----------
!define PRODUCT_NAME "云境"
!define PRODUCT_VERSION "6.9.4"
!define PRODUCT_PUBLISHER "云境工作室"
!define PRODUCT_WEB_SITE "https://github.com/AYun07/yunjing"
!define PRODUCT_DIR_REGKEY "Software\Microsoft\Windows\CurrentVersion\App Paths\YunJing.exe"
!define PRODUCT_UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}"
!define PRODUCT_UNINST_ROOT_KEY "HKCU"
!define APP_EXE "YunJing.exe"

Name "${PRODUCT_NAME} ${PRODUCT_VERSION}"
OutFile "云境-Windows-6.9.4-x64.exe"
InstallDir "$LOCALAPPDATA\Programs\云境"
InstallDirRegKey HKCU "${PRODUCT_DIR_REGKEY}" ""
RequestExecutionLevel user
ShowInstDetails show
ShowUnInstDetails show
SetCompressor zlib

; ---------- 插件 / 宏 ----------
!addplugindir "plugins"
!include "MUI2.nsh"
!include "FileFunc.nsh"

; ---------- 界面配置 ----------
!define MUI_ABORTWARNING
!define MUI_ICON "icon.ico"
!define MUI_UNICON "icon.ico"
!define MUI_FINISHPAGE_TITLE "云境安装完成"
!define MUI_FINISHPAGE_TEXT "云境已安装完成。点击完成即可启动。"
!define MUI_FINISHPAGE_RUN "$INSTDIR\${APP_EXE}"
!define MUI_FINISHPAGE_RUN_TEXT "立即启动云境"

; ---------- 安装页面 ----------
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "license.txt"
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

; ---------- 卸载页面 ----------
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

; ---------- 语言 ----------
!insertmacro MUI_LANGUAGE "SimpChinese"

; ============================================================
; 安装节
; ============================================================
Section "云境主程序" SEC_MAIN
  SectionIn RO
  SetOutPath "$INSTDIR"

  ; 把内嵌的应用压缩包释放到临时目录再解压
  SetOutPath "$PLUGINSDIR"
  File /oname=app-64.7z "app-64.7z"

  DetailPrint "正在解压云境程序文件，请稍候..."
  SetOutPath "$INSTDIR"
  ClearErrors
  Nsis7z::Extract "$PLUGINSDIR\app-64.7z"
  Pop $R0
  IfErrors 0 extractOk
    DetailPrint "解压发生错误：$R0"
    MessageBox MB_OK|MB_ICONEXCLAMATION "程序文件解压失败，安装中止。"
    Quit
  extractOk:

  ; 主程序存在性校验
  IfFileExists "$INSTDIR\${APP_EXE}" exeOk
    MessageBox MB_OK|MB_ICONEXCLAMATION "未找到主程序 ${APP_EXE}，安装异常，请联系开发者。"
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

  ; 生成卸载器
  WriteUninstaller "$INSTDIR\uninst.exe"

  ; 开始菜单快捷方式
  CreateDirectory "$SMPROGRAMS\${PRODUCT_NAME}"
  CreateShortCut "$SMPROGRAMS\${PRODUCT_NAME}\${PRODUCT_NAME}.lnk" "$INSTDIR\${APP_EXE}" "" "$INSTDIR\${APP_EXE}" 0
  CreateShortCut "$SMPROGRAMS\${PRODUCT_NAME}\卸载${PRODUCT_NAME}.lnk" "$INSTDIR\uninst.exe"

  ; 桌面快捷方式
  CreateShortCut "$DESKTOP\${PRODUCT_NAME}.lnk" "$INSTDIR\${APP_EXE}" "" "$INSTDIR\${APP_EXE}" 0
SectionEnd

; ============================================================
; 卸载节
; ============================================================
Section "Uninstall"
  Delete "$DESKTOP\${PRODUCT_NAME}.lnk"
  Delete "$SMPROGRAMS\${PRODUCT_NAME}\${PRODUCT_NAME}.lnk"
  Delete "$SMPROGRAMS\${PRODUCT_NAME}\卸载${PRODUCT_NAME}.lnk"
  RMDir "$SMPROGRAMS\${PRODUCT_NAME}"

  DeleteRegKey ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}"
  DeleteRegKey ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_DIR_REGKEY}"

  ; 删除程序文件（保留用户数据存档，若有）
  RMDir /r "$INSTDIR"
SectionEnd

; ============================================================
; 回调：安装启动时提示关闭正在运行的云境
; ============================================================
Function .onInit
  ; 安装目录已存在时提示覆盖
  IfFileExists "$INSTDIR\${APP_EXE}" 0 noExisting
    MessageBox MB_YESNO "检测到已安装的云境，是否覆盖安装（保留存档）？" /SD IDYES IDYES noExisting IDNO abortInstall
    abortInstall:
      Abort
  noExisting:
FunctionEnd
