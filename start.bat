@echo off
setlocal enabledelayedexpansion

title OLMS Launcher

echo ========================================================
echo                  OLMS - Khoi dong he thong
echo ========================================================
echo.

set "ROOT_DIR=%~dp0"
set "BACKEND_DIR=%ROOT_DIR%backend"
set "FRONTEND_DIR=%ROOT_DIR%frontend"

cd /d "%ROOT_DIR%"

:: Kiem tra Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [LOI] Khong tim thay Node.js trong PATH!
    echo Vui long cai dat Node.js tai https://nodejs.org/ truoc khi tiep tuc.
    echo.
    pause
    exit /b 1
)

:: Kiem tra file .env
if not exist "%BACKEND_DIR%\.env" (
    echo [CANH BAO] Chua tim thay backend\.env!
    echo Ban co the can sao chep tu backend\.env.example va cau hinh Supabase va JWT.
    echo.
)

if not exist "%FRONTEND_DIR%\.env" (
    if exist "%FRONTEND_DIR%\.env.example" (
        echo [THONG TIN] Chua co frontend\.env, Frontend se dung VITE_API_BASE_URL mac dinh: http://localhost:3000/api/v1
        echo.
    )
)

:: Kiem tra node_modules
if not exist "%BACKEND_DIR%\node_modules\" (
    echo [THONG TIN] Dang cai dat dependencies cho backend...
    call npm --prefix "%BACKEND_DIR%" ci
    echo.
)

if not exist "%FRONTEND_DIR%\node_modules\" (
    echo [THONG TIN] Dang cai dat dependencies cho frontend...
    call npm --prefix "%FRONTEND_DIR%" ci
    echo.
)

echo [1/2] Dang khoi dong Backend (Express API) tai http://localhost:3000...
start "OLMS Backend (Port 3000)" /D "%BACKEND_DIR%" cmd /k npm start

echo [2/2] Dang khoi dong Frontend (Vite React) tai http://localhost:5173...
start "OLMS Frontend (Port 5173)" /D "%FRONTEND_DIR%" cmd /k npm run dev

echo.
echo ========================================================
echo  OLMS dang chay trong 2 cua so rieng biet:
echo  - Backend:  http://localhost:3000 (Health: http://localhost:3000/health)
echo  - Frontend: http://localhost:5173
echo.
echo  De dung he thong: Dong ca 2 cua so Backend va Frontend
echo  hoac nhan Ctrl + C trong tung cua so.
echo  (Cua so nay se tu dong dong sau vai giay, 2 cua so BE va FE van tiep tuc chay)
echo ========================================================
echo.

ping 127.0.0.1 -n 5 >nul
