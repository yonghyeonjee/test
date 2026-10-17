#!/bin/sh
# HWP·HWPX 편집기 켜기 (macOS·Linux). 저장소 루트에서 python -m hwp_editor 를 돈다.
cd "$(dirname "$0")/.." || exit 1
PY=python3; command -v python3 >/dev/null 2>&1 || PY=python
$PY -c "import olefile" 2>/dev/null || echo "olefile 이 없어 HWP 는 못 읽습니다. 설치: pip install olefile"
exec $PY -m hwp_editor "$@"
