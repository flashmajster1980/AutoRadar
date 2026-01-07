@echo off
echo Installing Git...
echo.
echo Please download Git from: https://git-scm.com/download/win
echo.
echo After installing Git:
echo 1. Close this window
echo 2. Open NEW PowerShell window
echo 3. Run these commands:
echo.
echo    cd C:\Users\Flash\Documents\test1\BazosBot
echo    git init
echo    git add .
echo    git commit -m "Initial commit: AutoRadar"
echo    git branch -M main
echo    git remote add origin https://github.com/YOUR_USERNAME/AutoRadar.git
echo    git push -u origin main
echo.
echo Replace YOUR_USERNAME with your GitHub username!
echo.
pause

REM If Git is already installed, uncomment these lines:
REM cd C:\Users\Flash\Documents\test1\BazosBot
REM git init
REM git add .
REM git commit -m "Initial commit: AutoRadar"
REM echo.
REM echo Now create a new repository on GitHub.com named 'AutoRadar'
REM echo Then run: git remote add origin https://github.com/YOUR_USERNAME/AutoRadar.git
REM echo Then run: git push -u origin main
REM pause
