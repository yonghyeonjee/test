# jiwon.knowhow-it.com

조건(지역·나이·취업상태·가구상황)을 넣으면 해당될 수 있는
복지서비스를 찾아주는 화면.

## 로컬 실행

```bash
cd web
npm install
cp .env.local.example .env.local   # anon 키 채우기
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

## 데이터

- 읽기는 `programs_public` 뷰와 `match_welfare` 함수만 사용한다.
  원문(raw_*)과 내부 메타는 공개하지 않는다.
- 매칭 대상은 정규화가 끝나고 확신도 0.3 을 넘는 행뿐이다.
  미정규화 행은 나이 조건이 비어 있어 전 연령에 걸리므로 제외한다.
