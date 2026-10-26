@echo off
chcp 65001 >nul
echo 正在为您整合所有笔记章节并生成高保真 PDF 电子书...
node export_pdf.js
echo.
echo 导出完成！已在当前目录生成【考研数学二_完整通关宝典与题库全集.pdf】
pause
