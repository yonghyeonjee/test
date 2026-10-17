#!/bin/sh
# 실행 파일 하나로 묶는다(macOS·Linux). 결과: dist/HwpEditor
# 준비: pip install pyinstaller olefile
cd "$(dirname "$0")/.." || exit 1
pyinstaller --noconfirm --clean --onefile --name HwpEditor \
  --paths . \
  --add-data "$(pwd)/hwp_editor/static:hwp_editor/static" \
  --hidden-import olefile \
  --distpath dist --workpath build/pyinstaller --specpath build/pyinstaller \
  hwp_editor/launcher.py
