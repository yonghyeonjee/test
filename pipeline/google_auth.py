"""구글 API 접근 토큰.

두 길을 받는다.
  1) 서비스 계정 JSON 통째(GOOGLE_INDEXING_SA). 서비스 계정 이메일을 서치 콘솔 소유자로 넣어야 한다.
  2) 계정 로그인(OAuth). 서치 콘솔 소유자 계정으로 한 번 허용해 받은 새로고침 토큰으로 매번 접근 토큰을 받는다.
     GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REFRESH_TOKEN.
     2026-10-17: 구글 클라우드 프로젝트에 조직 정책(iam.disableServiceAccountKeyCreation)이 걸려 서비스 계정 키를
     못 만들어 이 길을 더했다. 범위(scope)는 허용할 때 정해진다 — webmasters.readonly 와 indexing 둘 다로 받는다.
비밀값 끝에 빈칸·탭이 붙어 들어오는 일이 있어(알리오 키가 그랬다) 모두 strip 한다.
"""
from __future__ import annotations

import json
import os

import requests

INDEXING = "https://www.googleapis.com/auth/indexing"
WEBMASTERS_RO = "https://www.googleapis.com/auth/webmasters.readonly"


def _env(name: str) -> str:
    return os.environ.get(name, "").strip()


def mode() -> str | None:
    """어느 길이 설정돼 있나. 'sa' · 'oauth' · None."""
    if _env("GOOGLE_INDEXING_SA"):
        return "sa"
    if _env("GOOGLE_OAUTH_CLIENT_ID") and _env("GOOGLE_OAUTH_CLIENT_SECRET") and _env("GOOGLE_OAUTH_REFRESH_TOKEN"):
        return "oauth"
    return None


def access_token(scopes: list[str]) -> str | None:
    """접근 토큰. 설정이 없으면 None, 설정이 틀리면 예외."""
    m = mode()
    if m == "sa":
        from google.oauth2 import service_account  # noqa: PLC0415 — 이 길일 때만 필요
        from google.auth.transport.requests import Request  # noqa: PLC0415
        cred = service_account.Credentials.from_service_account_info(json.loads(_env("GOOGLE_INDEXING_SA")), scopes=scopes)
        cred.refresh(Request())
        return cred.token
    if m == "oauth":
        r = requests.post("https://oauth2.googleapis.com/token", data={
            "client_id": _env("GOOGLE_OAUTH_CLIENT_ID"),
            "client_secret": _env("GOOGLE_OAUTH_CLIENT_SECRET"),
            "refresh_token": _env("GOOGLE_OAUTH_REFRESH_TOKEN"),
            "grant_type": "refresh_token",
        }, timeout=30)
        if r.status_code != 200:
            # invalid_grant: 토큰이 만료·취소됨(동의 화면이 '테스트' 상태면 7일 뒤 만료). 다시 받아야 한다.
            raise RuntimeError(f"OAuth 토큰 갱신 실패 {r.status_code}: {r.text[:200]}")
        body = r.json()
        granted = set((body.get("scope") or "").split())
        missing = [s for s in scopes if granted and s not in granted]
        if missing:
            raise RuntimeError(f"허용받은 범위에 없음: {' '.join(missing)} — 플레이그라운드에서 두 범위를 다 넣고 다시 받아야 한다")
        return body["access_token"]
    return None
