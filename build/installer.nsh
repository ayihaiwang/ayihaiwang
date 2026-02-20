; NSIS 安装脚本 - 仓库管理系统
; 确保所有运行环境都封装在安装包中，用户无需安装其他软件

; 检查系统要求（Windows 10/11）
Function .onInit
  ; 检查 Windows 版本（Windows 10 = 10.0, Windows 11 = 10.0）
  ReadRegStr $R0 HKLM "SOFTWARE\Microsoft\Windows NT\CurrentVersion" "CurrentVersion"
  StrCmp $R0 "10.0" check_build check_version_fail
  
  check_build:
    ; 检查构建号（Windows 10: 10240+, Windows 11: 22000+）
    ReadRegStr $R1 HKLM "SOFTWARE\Microsoft\Windows NT\CurrentVersion" "CurrentBuild"
    IntCmp $R1 10240 version_ok check_version_fail check_version_fail
    
  version_ok:
    Goto version_check_done
    
  check_version_fail:
    MessageBox MB_OK|MB_ICONSTOP "系统要求：$\r$\n$\r$\n本软件需要 Windows 10 或 Windows 11 操作系统。$\r$\n$\r$\n当前系统版本不符合要求，安装将终止。"
    Abort
    
  version_check_done:
FunctionEnd

; 安装完成后的提示
Function .onInstSuccess
  MessageBox MB_OK|MB_ICONINFORMATION "安装完成！$\r$\n$\r$\n仓库管理系统已成功安装。$\r$\n$\r$\n所有运行环境已包含在安装包中，无需额外安装任何软件。$\r$\n$\r$\n您可以从桌面或开始菜单启动应用。"
FunctionEnd

; 卸载时保留用户数据
Function un.onInit
  MessageBox MB_YESNO|MB_ICONQUESTION "确定要卸载仓库管理系统吗？$\r$\n$\r$\n注意：卸载不会删除您的数据文件（数据库、日志等）。$\r$\n数据保存在：%APPDATA%\warehouse-app\" IDYES uninstall_confirm
  Abort
  
  uninstall_confirm:
FunctionEnd

; 卸载时不删除用户数据目录
Function un.onUninstSuccess
  ; 用户数据目录 %APPDATA%\warehouse-app\ 不会被删除
  ; 这是 Electron app.getPath('userData') 的默认位置
FunctionEnd
