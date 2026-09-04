"""
check_setup.py — 키 3종이 전부 살아있는지 한 번에 확인

    python pipeline/check_setup.py
"""

import os
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

OK, FAIL = "  [OK]  ", "  [FAIL]"


def check_env():
    print("\n1. 환경변수")
    required = [
        "DATA_GO_KR_KEY",
        "GEMINI_API_KEY",
        "SUPABASE_URL",
        "SUPABASE_SERVICE_KEY",
    ]
    ok = True
    for k in required:
        v = os.environ.get(k, "").strip()
        if v:
            print(f"{OK} {k} = {v[:8]}...({len(v)}자)")
        else:
            print(f"{FAIL} {k} 비어 있음")
            ok = False
    return ok


def check_gemini():
    print("\n2. Gemini API")
    try:
        from google import genai
    except ImportError:
        print(f"{FAIL} google-genai 미설치 → pip install google-genai")
        return False

    model = os.environ.get("GEMINI_MODEL", "gemini-3.1-flash-lite")
    try:
        client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
        resp = client.models.generate_content(
            model=model,
            contents='JSON만 출력하세요: {"status":"ok"}',
        )
        print(f"{OK} 모델 {model} 응답: {resp.text.strip()[:80]}")
        usage = getattr(resp, "usage_metadata", None)
        if usage:
            print(f"       토큰 사용량: {usage}")
            print("       ↑ 출력 토큰이 비정상적으로 크면 thinking이 켜져 있는 것")
        return True
    except Exception as e:
        print(f"{FAIL} {type(e).__name__}: {e}")
        print("       모델명이 유효한지, 결제가 연결됐는지 확인하세요.")
        return False


def check_supabase():
    print("\n3. Supabase")
    try:
        from supabase import create_client
    except ImportError:
        print(f"{FAIL} supabase 미설치 → pip install supabase")
        return False

    try:
        sb = create_client(
            os.environ["SUPABASE_URL"],
            os.environ["SUPABASE_SERVICE_KEY"],
        )
        # _setup_check 테이블은 sql/000_init.sql 로 생성됨
        sb.table("_setup_check").select("*").limit(1).execute()
        print(f"{OK} 연결 및 조회 성공")
        return True
    except Exception as e:
        msg = str(e)
        if "_setup_check" in msg or "does not exist" in msg:
            print(f"{OK} 연결은 됨 (테이블 미생성 - sql/000_init.sql 실행 필요)")
            return True
        print(f"{FAIL} {type(e).__name__}: {msg[:200]}")
        return False


if __name__ == "__main__":
    print("=" * 60)
    print("설정 점검")
    print("=" * 60)
    results = [check_env(), check_gemini(), check_supabase()]
    print("\n" + "=" * 60)
    print("전부 통과" if all(results) else "실패 항목이 있습니다. 위 로그를 확인하세요.")
    print("=" * 60)
