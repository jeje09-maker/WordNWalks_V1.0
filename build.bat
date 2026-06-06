@echo off
set PATH=%~dp0node-v20.12.2-win-x64;%PATH%
echo Running production build...
npx next build
