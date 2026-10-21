"""AI 시리즈 글 하나의 공식 사이트 화면을 러너에서 찍어 기록에 작게 찍는다(발행 전 확인용). probe.yml 로 돈다.
    python -u pipeline/probe_ai_shots.py vibe-coding-top10
"""
import os
import subprocess
import sys

slug = (sys.argv[1] if len(sys.argv) > 1 else "").strip()
os.environ["SHOT_PREVIEW"] = "1"
subprocess.run([sys.executable, "-m", "pip", "install", "-q", "matplotlib"], check=True)
subprocess.run(["sudo", "apt-get", "install", "-y", "-qq", "fonts-nanum"], check=False)
sys.exit(subprocess.run([sys.executable, "-u", os.path.join(os.path.dirname(__file__), "ai_series.py"), "--slug", slug]).returncode)
