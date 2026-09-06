# jiwon.knowhow-it.com

조건(지역·나이·취업상태·가구상황)을 넣으면 해당될 수 있는
복지서비스를 찾아주는 화면.

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
