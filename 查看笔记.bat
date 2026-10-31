@echo off
chcp 65001 >nul
echo ==================================================
echo   考研数学二【及格保线】复习系统 - 浏览器阅读器
echo ==================================================
echo.

if not exist "index.html" (
    echo [提示] 正在重新渲染最新及格宝典为 HTML...
    node build.js
)

echo [OK] 正在使用默认浏览器打开总目录...
start "" "index.html"

exit
