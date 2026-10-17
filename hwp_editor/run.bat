@echo off
rem HWP·HWPX 편집기 켜기 (Windows). 저장소 루트에서 python -m hwp_editor 를 돈다.
cd /d "%~dp0.."
python -c "import olefile" 2>nul || (echo olefile 이 없어 HWP 는 못 읽습니다. 설치: pip install olefile)
python -m hwp_editor %*
pause
