@echo off
echo ========================================
echo   澳門童軍第5旅 點名系統
echo ========================================
echo.
echo 啟動後端服務器...
start "Scout Attendance API" cmd /k "cd /d %~dp0 && node server.js"
timeout /t 2 /nobreak >nul
echo.
echo 系統已啟動！
echo.
echo 請在瀏覽器中打開: http://localhost:3001/frontend/index.html
echo.
echo 預設登入帳號: admin
echo 預設登入密碼: scout5th
echo.
echo 按任意鍵退出...
pause >nul
