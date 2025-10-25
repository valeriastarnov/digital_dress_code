@echo off
echo ========================================
echo   Digital Dress Code - Local Server
echo ========================================
echo.
echo Запуск локального сервера...
echo После запуска откройте браузер и перейдите по адресу:
echo http://localhost:8000
echo.
echo Чтобы остановить сервер, закройте это окно.
echo.

:: Проверяем Python
python --version >nul 2>&1
if %errorlevel% == 0 (
    echo ✅ Python найден, запускаем сервер...
    python -m http.server 8000
) else (
    echo ❌ Python не найден!
    echo.
    echo Установите Python с официального сайта:
    echo https://www.python.org/downloads/
    echo.
    pause
)