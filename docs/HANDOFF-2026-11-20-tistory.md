# 인수인계 — 티스토리(abcfact.tistory.com) 발행 · 2026-11-20

이어받는 세션이 이 파일만 읽고 바로 일할 수 있게 적었다. 작업 브랜치 `claude/eager-goodall-uszo2f`, 열린 PR [#312](https://github.com/yonghyeonjee/test/pull/312).

## 1. 지금 막혀 있는 것 (사용자 손이 필요)

| 무엇 | 왜 막혔나 | 필요한 것 |
|---|---|---|
| **TISTORY_COOKIE 만료** (11-06부터) | 쿠키가 2~3주마다 만료된다 | 사용자가 크롬에서 `https://abcfact.tistory.com/manage` 를 연다. F12 → Network → `manage` 요청 → Request Headers 의 `Cookie` 값 전체를 복사해 GitHub → Settings → Secrets → `TISTORY_COOKIE` 에 넣는다. **값은 채팅·코드·PR 에 절대 붙이지 않는다.** |
| **PR #312 머지** | 사용자 머지 대기 (CI 초록, 충돌 없음) | 사용자가 머지. 머지 전에는 main 이 옛 기획표와 썸네일 없는 코드로 돈다 |

쿠키가 만료돼도 **이미 예약된 글은 티스토리가 정한 시각에 스스로 공개한다.** 새 글 발행·고쳐 쓰기·`check` 만 막힌다.

## 2. 쿠키 갱신 직후 할 일 (순서대로)

1. **쿠키 확인** — `tistory_publish.yml` 을 `check=true`, ref `claude/eager-goodall-uszo2f` 로 돌린다. 최근 글 목록이 찍히면 살아 있다.
2. **청년 버팀목 전세대출 글 발행** (사용자 요청 11-06 "오늘 바로 발행", 쿠키 만료로 못 냄)
   - 글: `pipeline/data/guide_posts/01-youth-jeonse-loan-2026.json` (공백 제외 약 1,620자, 스크린샷 3장: 주택도시기금·HUG 금리 공시·K나라지원 원문)
   - **먼저 숫자를 다시 확인한다.** 은행 금리가 HUG 「전세안심대출 금리 안내」 2026년 9월분(국민 4.63%, 신한 4.85%, 우리 4.27%, 기업 4.91%, 하나 4.74%, 농협 4.67%, 부산 4.40%)이다.
     - 최신 달 공시를 `probe.yml` 로 읽어 고친다: `script=probe_pages.py`, `arg=text:https://www.khug.or.kr/hug/web/ig/dl/igdl000005.jsp`.
     - 고칠 곳: 본문, 요약, `compare` 차트, `hugshot` 대체 카드.
     - 청년 버팀목 고시(연 2.2~3.3%, 한도 1.5억, 순자산 3.45억)도 `https://nhuf.molit.go.kr/FP/FP05/FP0502/FP05020301.jsp` 로 다시 본다.
   - 검사: `python pipeline/ai_series.py --series guide --check`
   - 발행: `tistory_publish.yml` `batch=ai:youth-jeonse-loan-2026:` (번호 없이 끝나면 바로 공개). 그날 이미 공개(예약 포함) 글이 있으면 하루 1편 한도에 막힌다. 사용자가 그날 내라고 했으면 `daily_max=2` 를 같이 준다.
3. **11-23 이후 발행 일정** — 예약 글은 11-22(213번)까지다. 그 뒤 할 일:
   - TOP10 연재는 매일 자동으로 나간다. 다만 PR #312 머지 뒤라야 새 기획표·썸네일이 적용된다. 기획표는 `pipeline/top10_plan.json`, 11-23 부터 이어진다.
   - 사용자가 예약을 더 원하면 `batch` 로 미리 예약한다. 예약된 날짜는 기획표에 `reserved: true` 또는 `topic: ""` 로 막아 그날 자동 실행이 겹쳐 쓰지 않게 한다.
4. **맞구독 자동화 손보기** — `tistory_mutual.yml` 은 매일 10:17 KST 에 돈다. 쿠키가 죽으면 '구독 응답 TimeoutError' 로 한 곳도 못 하는데도 **성공(초록)으로 끝난다.** 로그인 여부를 먼저 확인하고(예: `/manage` 가 로그인 쪽으로 가면) 실패로 끝나게 고칠 것.

## 3. 반드시 지킬 규칙 (사용자 지시)

- **공개는 하루 1편** (`DAILY_MAX=1`, 공개 예약 글도 센다). 사용자가 그날 더 내라고 할 때만 `daily_max` 로 올린다.
- 글마다 본문 **1,250자 이상**, 소제목마다 **사진 1장 + 바깥 링크 1개 이상**. 근거 링크는 많이, 대충 쓴 글 금지.
- 바깥 링크는 여러 공식 사이트로. **jiwon 링크는 글당 1~2개**. 원문 각색 글은 출처로 2개까지.
- 제목에 **'○월 ○일' 같은 일(日)을 넣지 않는다.** 반복 글(모음)은 한 달에 한 편.
- 숫자는 **공식 자료로 확인한 것만.** 확정 안 된 것(정부안 등)은 그렇게 표시.
- 사용자가 "냅둬"라고 하면 손대지 않는다(11-06 버팀목 글 삭제·재예약 요청을 바로 철회함).

## 4. 발행 구조 (코드)

| 경로 | 하는 일 |
|---|---|
| `pipeline/tistory_publish.py` | 티스토리 관리자 API(쿠키). 아래 기능이 여기 있다. 대표 이미지(`thumbnail`), 예약 `--at`, 하루 한도, 공개 글 고쳐 쓸 때 발행일·예약 유지 |
| `pipeline/ai_series.py` | 단독 글 생성기(글 JSON → 차트·공식 사이트 캡처·규칙 검사). 시리즈별로 폴더가 나뉜다. `ai_series`, `senior_series`, `psy_series`, `guide_posts`(단독) |
| `pipeline/top10.py`, `chart_top10.py`, `tistory_top10.py` | TOP10 연재(jiwon 자료로 글·차트) |
| `.github/workflows/tistory_publish.yml` | 아래 입력이 있다. `check`, `inspect`, `batch`, `at`, `daily_max`, `slug`/`update`/`redigest` |
| `.github/workflows/tistory_top10_daily.yml` | 매일 13:00 KST(늦게 돈다) TOP10. `topics`+`at` 로 여러 편 예약 가능 |
| `.github/workflows/tistory_mutual.yml` | 맞구독 |

`batch` 항목 형식은 쉼표로 이어 쓴다.
- `top10:<slug>:<번호>`
- `ai:<slug>:<번호 | @2026-11-23T19:00 | 빈칸=바로 공개>`
- `script:<파일>:<번호>`
- `digest:<번호>`

## 5. 예약·발행 현황 (11-20 기준)

| 날짜 | 번호 | 글 |
|---|---|---|
| 11-13~11-17 | 204~208 | 어르신 복지 시리즈 5편(기초연금·장기요양·노인일자리·맞춤돌봄·치매) |
| 11-18~11-22 | 209~213 | 지피디아 심리테스트 시리즈 5편(자가진단·성격검사·30초 그림·행동 예측·심리 효과) |
| 11-23~ | — | 비어 있음. TOP10 자동 발행 차례(쿠키·PR 필요) |
| 미발행 | — | 청년 버팀목 전세대출(위 2-2) |

## 6. 알아 둘 것

- 샌드박스에서는 티스토리·jiwon·대부분의 정부 사이트에 직접 닿지 않는다. 모든 확인은 GitHub Actions 러너에서 한다.
  - `probe.yml` + `probe_pages.py`: `text:`, `links:`, `head:`, `shot:`
  - `probe_thumbs.py`: 대표 이미지 확인
- 러너가 만든 결과 파일(artifact)은 샌드박스에서 내려받지 못한다(blob 호스트 차단). 그림은 로그 글자로 확인한다.
- main 의 예약 실행은 4~6시간 늦게 돈다.
- `tistory-publish` 동시 실행 묶음은 대기 1개만 남긴다. 실행은 하나씩 차례로.
- 대표 이미지: 발행 body 의 `thumbnail` 에 첨부 ref 를 넣어야 목록 카드와 og:image 가 나온다. 11-03 에 기존 글 33편과 예약 10편을 모두 고쳤다.
