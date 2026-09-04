# 복지·지원사업 매칭 서비스

조건(지역·나이·취업여부·기업형태)을 입력하면 해당 가능성이 있는
정부 복지서비스와 기업 지원사업을 찾아주는 서비스.

```
공공데이터 API ──▶ raw_items (원본 그대로)
                        │
                   Gemini 배치 정규화 (1회)
                        ▼
                   programs (구조화 컬럼)
                        │
                     순수 SQL 조회
                        ▼
                   Next.js 웹
```

핵심 원칙: **매칭을 런타임에 하지 않는다.** 수집 시점에 한 번만
정규화하고, 사용자 조회는 인덱스 SQL로만 처리한다.

---

## 셋업 순서 (로컬 설치 없음)

### 1. GitHub 저장소 만들기

1. github.com → 우측 상단 **+** → **New repository**
2. 이름 `welfare`, **Private** 선택 → Create
3. 이 압축 파일을 푼 뒤, 저장소 화면에서 **Add file → Upload files**
   → 폴더 안 내용물 전체를 드래그 → **Commit changes**

> `.github` 처럼 점으로 시작하는 폴더가 드래그에서 빠질 수 있습니다.
> 업로드 후 저장소에 `.github/workflows/` 가 보이는지 확인하세요.
> 안 보이면 그 폴더만 따로 한 번 더 올리면 됩니다.

### 2. 키 등록

저장소 → **Settings** → **Secrets and variables** → **Actions**

**Secrets** 탭 → New repository secret (4개):

| Name | Value |
|---|---|
| `DATA_GO_KR_KEY` | 공공데이터포털 **Decoding** 키 |
| `GEMINI_API_KEY` | AI Studio 키 |
| `SUPABASE_URL` | `https://iabtlainrxzkwyhyqajl.supabase.co` |
| `SUPABASE_SERVICE_KEY` | service_role 키 (Rotate 한 새 것) |

**Variables** 탭 → New repository variable (2개):

| Name | Value |
|---|---|
| `GEMINI_MODEL` | `gemini-3.1-flash-lite` |
| `MAX_ITEMS_PER_RUN` | `2000` |

### 3. API 샘플 수집 실행 ← **지금 할 일**

저장소 → **Actions** 탭 → 왼쪽 **explore-apis** → **Run workflow** → 초록 버튼

1~2분 뒤 완료되면 실행 항목 클릭 → **explore** 잡 클릭 → 각 단계를 펼쳐 로그 확인

- `설정 점검` 에 `[OK]` 3개가 나와야 합니다
- `API 샘플 수집` 로그 전체를 복사해서 Claude에 붙여넣으세요
- 화면 하단 **Artifacts → api-samples** 에서 원본 XML도 받을 수 있습니다

`bizinfo_support`, `bizinfo_event` 는 `pipeline/endpoints.json` 의
`PUT_ENDPOINT_HERE` 를 실제 경로로 바꿔야 동작합니다.
GitHub 에서 파일 클릭 → 연필 아이콘으로 바로 수정할 수 있습니다.

### 4. (선택) 로컬에서 하고 싶을 때

Claude Code 나 터미널이 편하면 로컬도 됩니다:

```bash
pip install -r requirements.txt
cp .env.example .env        # 값 채우기
python pipeline/check_setup.py
python pipeline/explore_apis.py
```

---

## 폴더 구조

```
welfare/
├─ pipeline/
│  ├─ endpoints.json     API 경로 설정 (Swagger 보고 수정)
│  ├─ explore_apis.py    샘플 수집 + 필드 분석
│  └─ check_setup.py     키 3종 점검
├─ sql/
│  └─ 000_init.sql       원본 적재 테이블
├─ samples/              API 응답 원본 (git 제외)
├─ .github/workflows/
│  └─ daily.yml          매일 KST 03:00 배치
└─ web/                  Next.js (추후)
```

---

## 비용 메모

| 항목 | 월 |
|---|---|
| Supabase Free | $0 |
| Vercel Hobby | $0 |
| GitHub Actions | $0 (무료 2,000분 내) |
| Gemini 정규화 (초기 1회, 1.5만건) | 약 $6 |
| Gemini 증분 (일 수백건) | $1 미만 |

주의사항:
- Google Cloud는 **하드 지출 한도가 없습니다.** 예산 알림만 옵니다.
  코드 쪽 `MAX_ITEMS_PER_RUN` 이 실질적인 안전장치입니다.
- `gemini-2.5-flash-lite` 는 더 싸지만 2026-10-16 종료 예정이니 쓰지 마세요.
- Gemini는 thinking 토큰이 출력 토큰으로 과금됩니다.
  정규화 호출에서는 thinking을 끄고, `usage_metadata` 로 실사용량을 확인하세요.

---

## 아직 안 만든 것 (의도적)

- `sql/001_schema.sql` — 정규화 스키마. **API 샘플을 본 뒤에** 확정
- `pipeline/collect.py` — 수집 본체
- `pipeline/normalize.py` — Gemini 배치 정규화
- `web/` — Next.js

스키마를 먼저 만들면 실제 응답과 안 맞아서 두 번 만들게 됩니다.
4단계 결과를 확인하고 진행하세요.
