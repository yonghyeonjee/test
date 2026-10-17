"""PyInstaller 진입점. `python hwp_editor/launcher.py` 로도 켤 수 있다."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from hwp_editor.app import main  # noqa: E402

if __name__ == "__main__":
    sys.exit(main())
