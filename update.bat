@echo off
echo STARTING UPDATE...
git add .
git commit -m "Update site"
git push
echo.
echo ==========================================
echo SUCCESS! SITE UPDATED.
echo ==========================================
pause