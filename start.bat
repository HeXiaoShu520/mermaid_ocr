@echo off
chcp 65001 >nul
title 图片转Mermaid 启动程序

echo ===================================
echo   正在启动 "图片转Mermaid" 服务...
echo ===================================
echo.

:: 检查是否安装了 Node.js
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Node.js，请先安装 Node.js!
    pause
    exit /b
)

:: 检查 node_modules 是否存在，不存在则自动安装依赖
if not exist "node_modules\" (
    echo [提示] 初次运行或缺少依赖，正在自动安装，请稍候...
    call npm install
    echo.
)

:: 启动浏览器打开本地地址
echo [提示] 正在打开浏览器...
start http://localhost:3333

:: 启动 Next.js 开发服务器
echo [提示] 正在启动 Next.js 服务器...
npm run dev
