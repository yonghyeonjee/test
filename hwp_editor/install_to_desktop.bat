@echo off
rem HwpEditor.exe 를 바탕화면에 복사하고 "HWP 편집기" 바로가기를 만든다.
rem 이 파일과 같은 폴더에 HwpEditor.exe 가 있어야 한다(내려받은 zip 을 푼 폴더에서 더블클릭).
chcp 65001 >nul
set "SRC=%~dp0HwpEditor.exe"
if not exist "%SRC%" (
  echo HwpEditor.exe 가 이 폴더에 없습니다: %~dp0
  pause
  exit /b 1
)
for /f "usebackq delims=" %%D in (`powershell -NoProfile -Command "[Environment]::GetFolderPath('Desktop')"`) do set "DESKTOP=%%D"
if not exist "%DESKTOP%" set "DESKTOP=%USERPROFILE%\Desktop"
rem 폴더 이름은 코드 페이지 문제를 피하려고 영문으로 둔다. 바로가기 이름만 한글(PowerShell 안에서 유니코드로 만든다).
set "DIR=%DESKTOP%\HwpEditor"
if not exist "%DIR%" mkdir "%DIR%"
copy /y "%SRC%" "%DIR%\HwpEditor.exe" >nul || (echo 복사하지 못했습니다. & pause & exit /b 1)
rem 바로가기 저장(WScript.Shell)은 시스템 코드 페이지에 없는 글자가 든 이름에서 실패할 수 있다.
rem 그래서 영문 이름으로 저장한 뒤 PowerShell 로 한글 이름 "HWP 편집기.lnk" 로 바꾼다. 실패하면 오류 코드로 알린다.
powershell -NoProfile -Command ^
  "$ErrorActionPreference='Stop';" ^
  "$tmp=Join-Path '%DESKTOP%' 'HwpEditor-shortcut.lnk';" ^
  "$s=(New-Object -ComObject WScript.Shell).CreateShortcut($tmp);" ^
  "$s.TargetPath='%DIR%\HwpEditor.exe'; $s.WorkingDirectory='%DIR%'; $s.Description='HWP/HWPX editor'; $s.Save();" ^
  "$name='HWP ' + [char]0xD3B8 + [char]0xC9D1 + [char]0xAE30 + '.lnk';" ^
  "$dst=Join-Path '%DESKTOP%' $name;" ^
  "if (Test-Path -LiteralPath $dst) { Remove-Item -LiteralPath $dst -Force };" ^
  "Rename-Item -LiteralPath $tmp -NewName $name"
if errorlevel 1 (
  echo.
  echo 바로가기를 만들지 못했습니다. 실행 파일은 복사됐으니 아래 파일을 직접 더블클릭해도 됩니다:
  echo   %DIR%\HwpEditor.exe
  pause
  exit /b 1
)
echo.
echo 바탕화면에 설치했습니다:
echo   %DIR%\HwpEditor.exe
echo   바로가기: %DESKTOP%\HWP 편집기.lnk
echo 바로가기를 더블클릭하면 검은 창이 뜨고 브라우저가 열립니다. 검은 창을 닫으면 편집기가 꺼집니다.
echo.
echo (Windows 가 "알 수 없는 게시자" 경고를 띄우면 "추가 정보" ^> "실행" 을 누르세요.)
pause
