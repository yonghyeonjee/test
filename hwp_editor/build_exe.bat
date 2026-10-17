@echo off
rem 실행 파일 하나로 묶는다(Windows). 결과: dist\HwpEditor.exe
rem 준비: pip install pyinstaller olefile
cd /d "%~dp0.."
pyinstaller --noconfirm --clean --onefile --name HwpEditor ^
  --paths . ^
  --add-data "%CD%\hwp_editor\static;hwp_editor\static" ^
  --hidden-import olefile ^
  --distpath dist --workpath build\pyinstaller --specpath build\pyinstaller ^
  hwp_editor\launcher.py
