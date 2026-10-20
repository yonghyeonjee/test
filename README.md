# jiwon.knowhow-it.com

조건(지역·나이·취업상태·가구상황)을 넣으면 해당될 수 있는
복지서비스를 찾아주는 화면.

## AWS · Java 이전 대비

나중에 AWS 와 Java(Spring Boot) 백엔드로 옮길 때를 위한 문서가 [`docs/migration/`](docs/migration/README.md) 에 있다.
지금 의존성 목록, DB 스키마 스냅샷, REST 계약 초안(OpenAPI), 메일·문자 알림과 수신 동의 규칙을 담았다.

## 로컬 실행

```bash
cd web
npm install
cp env.example .env.local   # anon 키 채우기
npm run dev
```

`NEXT_PUBLIC_SUPABASE_ANON_KEY` 는 Supabase > Settings > API 의
**anon** 키다. service_role 키를 넣으면 브라우저에 노출되므로 절대 쓰지 않는다.

## Vercel 배포

1. Vercel 에서 GitHub 저장소 연결
2. **Root Directory 를 `web` 으로 지정** (저장소 루트에는 파이썬 파이프라인이 있다)
3. 환경변수 3개 등록: `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`
4. Settings > Domains 에 `jiwon.knowhow-it.com` 추가 → 안내되는 CNAME 을 DNS 에 등록

## 관리자 (/admin)

Vercel > Settings > Environment Variables 에 아래를 넣어야 동작한다.
**코드나 저장소에는 절대 두지 않는다.** 저장소가 공개돼 있고, 한 번
커밋되면 이력에서 지워도 남는다.

| 변수 | 값 |
|---|---|
| `ADMIN_USER` | 관리자 아이디 |
| `ADMIN_PASSWORD` | 관리자 비밀번호 (16자 이상 권장) |
| `ADMIN_SECRET` | 아무 긴 무작위 문자열 (세션 서명용) |
| `SUPABASE_SERVICE_KEY` | Supabase service_role 키 |

`/admin` 은 robots 에서 noindex 이고 사이트맵에도 넣지 않는다.

## 관리자 로그인 배경 영상

`public/login-bg.mp4` 를 직접 만들어 넣었다 (130KB, 12초 무한루프).
숲색 바탕에 초록·황금빛이 느리게 흐르며, 히어로 그라데이션과 같은 계열이다.

자체 파일로 둔 이유:

- 외부 CDN 이 막히거나 파일이 사라져도 깨지지 않는다
- 저작권 표기가 필요 없다
- Vercel 엣지에서 나가므로 빠르다
- Datacenter 로그인의 파란 입자 영상과 겹치지 않는다 (두 서비스는 무관하다)

다른 영상으로 바꾸려면 `NEXT_PUBLIC_LOGIN_VIDEO` 에 .mp4 주소를 넣는다.
출처 표기가 필요한 소재면 `NEXT_PUBLIC_LOGIN_CREDIT` 도 채운다.

## 속도

체감 속도를 좌우하는 것은 쿼리 성능이 아니라 **왕복 횟수와 거리**다.

| 조치 | 효과 |
|---|---|
| `vercel.json` 의 `regions: ["icn1"]` | 함수를 서울로. DB(도쿄)까지 거리가 짧아진다 |
| `home_bundle()` RPC | 홈 조회 9번 → 1번 (130ms) |
| 검색 로깅을 `await` 하지 않음 | 왕복 1번 제거 |
| 폰트를 CSS `@import` → `<link>` | 렌더 차단 제거 |
| 영상·포스터 1년 캐시 | 재방문 시 재다운로드 없음 |

Vercel Hobby 는 리전을 하나만 고를 수 있다. 기본값이 미국(iad1)이라
`vercel.json` 이 없으면 매 조회마다 태평양을 왕복한다.

## 검색 로그와 개인정보

`search_log` 에는 개인을 식별할 수 있는 정보를 넣지 않는다.

- 저장: 지역, 나이대(10년 단위), 취업상태, 가구상황, 결과 수, 유입경로
- 미저장: IP, User-Agent, 세션ID, 검색창에 입력한 원문

푸터 고지문이 이 내용과 일치해야 한다. 로깅 범위를 바꾸면 고지문도 함께
고친다.

## 데이터

- 읽기는 `programs_public` 뷰와 `match_welfare` 함수만 사용한다.
  원문(raw_*)과 내부 메타는 공개하지 않는다.
- 매칭 대상은 정규화가 끝나고 확신도 0.3 을 넘는 행뿐이다.
  미정규화 행은 나이 조건이 비어 있어 전 연령에 걸리므로 제외한다.

## 티스토리 (abcfact.tistory.com)

`blog_daily` 가 쓴 글을 매일 낮 12시(KST) [abcfact.tistory.com](https://abcfact.tistory.com) 에도 올린다
(`.github/workflows/tistory_publish.yml` → `pipeline/tistory_publish.py`). 기본은 **요약 + 원문 링크**다.
사이트 `/story/<slug>` 에 전문이 있으므로 같은 글을 두 곳에 통째로 두지 않는다(`--mode full` 로 바꿀 수 있다).

티스토리 공개 API 는 끝났다. 관리자 화면이 쓰는 내부 주소(`POST /manage/post.json`)를 **로그인 쿠키**로 부른다.
npm 의 [tistory-mcp](https://github.com/kim-se-hee/tistory-mcp) 가 쓰는 길과 같다. 그래서 사람이 한 번 로그인해 쿠키를 넘겨야 한다.

1. 크롬에서 카카오 계정으로 티스토리에 로그인하고 `https://abcfact.tistory.com/manage` 를 연다.
2. F12 → Network → 아무 `manage` 요청 → Request Headers 의 `Cookie:` 값 전체를 복사한다
   (`TSSESSION=…` 이 들어 있다. 여러 줄이어도 된다).
3. GitHub → Settings → Secrets → `TISTORY_COOKIE` 에 붙여 넣는다. **코드·채팅·PR 에 붙이지 않는다** — 그 자체가 로그인이다.
4. Actions → tistory-publish → Run workflow, `check=true`. 쿠키가 살아 있으면 카테고리 id 목록이 찍힌다.
   카테고리는 글마다 자동으로 고른다(자격증 순위 → 일상TIP, 기업지원 순위 → B2G, 채용·공무원·복지·브리핑 → policy;
   id 는 `tistory_publish.CATEGORIES`). 전부 한 카테고리로 몰고 싶을 때만 Settings → Variables → `TISTORY_CATEGORY`.
5. 처음엔 `slug` 하나에 `visibility=private` 로 올려 보고, 티스토리 관리자에서 모양을 본 뒤 공개로 바꾼다.

쿠키가 만료되면 실행이 종료 코드 2 로 빨갛게 실패하고 "쿠키가 만료됐다" 고 찍는다. 1~3 을 다시 한다.
어느 글을 올렸는지는 `tistory_posts` 표(`sql/015`)에 남고, 한 글은 한 번만 올라간다.
비공식 주소라 카카오 쪽이 바꾸면 멈출 수 있다. 그때는 `--check` 부터 돌려 본다.

**사진과 순위 글.** 워크플로 입력 `shots` 에 `주소|파일이름|설명|선택자` 를 쉼표로 적으면 러너가 운영 사이트 화면을
찍어(`pipeline/shot_pages.py`) 본문에 끼운다 — 들머리 뒤 한 장, 절마다 첫 블록 뒤 한 장. `top10=true` 는 먼저
`pipeline/blog_top_roles.py` 로 "많이 뽑는 직무 순위 TOP10" 글을 jiwon(blog_posts)에 쓰고 나서 올린다(출처가 jiwon 이 된다).
이미 올린 글을 고치려면 `update` 에 티스토리 글 번호(숫자)를 넣는다. 번호는 `check=true` 가 찍는 최근 글 목록에 있다.
이 블로그는 글 주소가 `/entry/<제목>` 꼴(문자 주소)이라 발행 기록의 post_id 도 그 슬러그다.

**순위 TOP10 연재(매일 13:00 KST).** `.github/workflows/tistory_top10_daily.yml` 이 `pipeline/top10_plan.json` 의 그날 주제를
`pipeline/top10.py` 로 jiwon 에 쓰고(출처), `chart_top10.py` 로 차트를 그려 `tistory_publish.py --composer top10` 으로 티스토리에 올린다.
30일 일정과 틀은 [`docs/TISTORY-TOP10-PLAN.md`](docs/TISTORY-TOP10-PLAN.md). 직무·직렬 글의 "어려운 점"(번아웃·감정노동 등)은
`pipeline/top10_notes.py`. 손으로 한 편 내려면 Actions → tistory-publish 의 `top10_topic` 에 주제 키(예: civil).
같은 slug 를 다시 올리면 새 글을 만들지 않고 기록된 번호의 글을 고쳐 쓴다.
