"""
probe_shots.py — shot_pages.py 를 그대로 돌리고, 찍힌 사진을 작은 JPEG base64 로 로그에 남긴다(화면 품질 확인용).
probe.yml 로만 돈다:  script=probe_shots.py  arg="<shot_pages.py 와 같은 인자>"
"""

import base64
import io
import json
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).parent
rc = subprocess.run([sys.executable, "-u", str(HERE / "shot_pages.py"), sys.argv[1]]).returncode
subprocess.run([sys.executable, "-m", "pip", "install", "-q", "pillow"], check=True)
from PIL import Image  # noqa: E402

for m in json.load(open("shots/manifest.json", encoding="utf-8")):
    im = Image.open(f"shots/{m['file']}").convert("RGB")
    im.thumbnail((960, 960))
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=50)
    print(f"--B64 {Path(m['file']).stem}--\n{base64.b64encode(buf.getvalue()).decode()}\n--END--")
sys.exit(rc)
