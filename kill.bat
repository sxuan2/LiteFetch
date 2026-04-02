@echo off
echo Killing all LiteFetch processes...

taskkill /F /IM litefetch.exe /T >nul 2>&1

echo Done.
pause
