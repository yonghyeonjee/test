# 메일·문자 알림 설계

> "저장한 조건에 새 공고가 올라오면 알려 드린다"를 위한 설계. 아직 아무것도 보내지 않는다.
> 법 규정은 2026-10-02 에 확인한 내용이며, 실제로 보내기 전에 담당자가 KISA 최신 안내서와
> 법령 원문을 다시 확인한다. 이 문서는 법률 자문이 아니다.

## 1. 지금 상태

- 조건 저장: 익명 기기 열쇠(`saved_condition`). 이름·연락처 없음.
- 선택 계정(`save_account`): 아이디·비밀번호(scrypt) + 원하면 이름·**휴대폰 뒤 8자리**·이메일·동의 1개(`notify_consent`, `consent_at`).
  동의 문구: "지원사업 안내를 받기 위해 이름·휴대폰 뒤 8자리·이메일을 수집·이용하는 데 동의합니다."
  화면에는 "지금은 아무것도 보내지 않는다"고 적혀 있다(`components/AccountBox.tsx`).
- 첫 화면 오른쪽 "내 조건 · 알림" 상자는 **알림 준비 중**이라고만 적는다(`components/AlertBox.tsx`).

보내기 전에 모자란 것:

1. 동의가 하나로 뭉쳐 있다 → **채널별(메일·문자·알림톡)·목적별(알림·광고·야간)로 나눈다.**
2. 동의 문구 판(version)과 동의·철회 이력이 없다 → `consent_log` 표.
3. 휴대폰 번호가 뒤 8자리뿐이고 본인 확인이 없다 → 문자를 보내려면 전체 번호 + 확인 코드.
4. 수신 거부 경로가 없다 → 메시지마다 한 번에 거부하는 링크·번호.
5. 발송 기록·실패 처리·중복 방지가 없다 → `outbox`, `delivery` 표와 큐.

## 2. 규칙 (요약과 출처)

| 규칙 | 내용 | 근거 |
|---|---|---|
| 사전 동의 | 영리 목적 광고성 정보를 보내려면 받는 사람의 **명시적 사전 동의** | 정보통신망법 제50조 제1항 |
| 야간 | **21:00~다음 날 08:00** 에 광고성 정보를 보내려면 **별도 사전 동의** | 같은 법 제50조 제3항 |
| 표기 | 광고성이면 시작 부분에 `(광고)`, 전송자 명칭·연락처, 끝 부분에 **무료** 수신 거부 방법 | 같은 법 제50조 제4항, 시행령 |
| 처리 결과 통지 | 동의·거부·철회 의사를 받은 날부터 **14일 안에** 전송자 명칭, 의사 표시 사실과 날짜, 처리 결과를 알린다 | 같은 법 제50조 제7항, 시행령 제62조의2 |
| 2년마다 확인 | 광고성 수신 동의를 받은 날부터 **2년마다** 동의 여부를 확인. 전송자 명칭, 동의 사실과 날짜, 유지·철회 방법을 알린다 | 시행령 제62조의3 |
| 모호한 동의 문구 금지 | 광고 수신 동의를 받으면서 "혜택 알림", "정보 제공" 같은 모호한 말로 감싸지 않는다. 앱 푸시 수신 거부에 로그인 같은 복잡한 절차를 요구하지 않는다 | KISA·방송미디어통신위원회 「불법스팸 방지를 위한 정보통신망법 안내서」 제7차 개정본(2026-03-04) |
| 발신번호 사전등록 | 문자는 미리 등록한 발신번호로만 보낸다(거짓 번호 표시 금지) | 전기통신사업법 제84조의2 |
| 대량문자 전송자격 | 문자 재판매사는 전송자격인증을 받아야 한다 — 문자 중계사·재판매사를 고를 때 인증 여부 확인 | 방송통신위원회 가이드라인(2025-06 시행) |
| 개인정보 수집 동의 | 수집·이용 목적, 항목, 보유·이용 기간, 동의를 거부할 권리와 그에 따른 불이익을 알리고 받는다. 만 14세 미만은 법정대리인 동의 | 개인정보 보호법 제15조 제2항, 제22조의2 |
| 알림톡 | 카카오 알림톡은 **정보성 메시지만**, 미리 심사받은 템플릿으로만 보낸다 | 카카오비즈니스 알림톡 심사 가이드 |

### 우리 알림은 광고성인가

"내가 저장한 조건에 맞는 새 공공 지원사업"은 받는 사람이 요청한 정보라 정보성으로 볼 여지가 있다.
하지만 우리 사이트는 광고 수익을 내는 영리 서비스이고, 메시지에 사이트 홍보·광고·다른 서비스 안내가
섞이는 순간 광고성이 된다. 그래서 다음처럼 보수적으로 설계한다.

- 알림 메시지에는 **조건에 맞는 공고 목록과 링크만** 넣는다. 광고·홍보·제휴 문구를 넣지 않는다.
- 그래도 동의는 광고성 수준으로 받는다: 채널별 명시적 사전 동의, 기본값 꺼짐, 철회 쉬움, 2년마다 확인.
- **야간(21~08시)에는 보내지 않는다.** 아침 8시 이후로 미룬다(야간 별도 동의를 받지 않는다).
- 광고성 메시지(서비스 홍보 등)를 보낼 일이 생기면 별도 동의(`purpose = marketing`)를 따로 받고 `(광고)` 표기 규칙을 지킨다.
- 동의 문구는 무엇을 보내는지 그대로 쓴다. 예: "저장한 조건에 맞는 새 지원사업 공고가 올라오면 문자로 알려 받겠습니다(하루 한 번, 오전 8시~오후 9시)."

## 3. 데이터 모델 (Aurora, 새 표)

```sql
-- 사람(계정). 지금의 save_account 를 이어받는다.
create table member (
  id bigint generated always as identity primary key,
  device_key uuid not null unique,           -- 지금의 익명 기기 열쇠
  email text, email_verified_at timestamptz,
  phone_e164 text, phone_verified_at timestamptz,   -- +8210…, 문자에는 확인된 번호만
  created_at timestamptz not null default now(),
  deleted_at timestamptz                      -- 탈퇴: 즉시 개인정보 지우고 표시만 남김
);

-- 채널·목적별 현재 동의 상태
create table consent (
  member_id bigint references member(id),
  channel text check (channel in ('email','sms','kakao')),
  purpose text check (purpose in ('alert','marketing','night')),
  granted boolean not null,
  text_version text not null,                 -- 동의 화면 문구의 판
  granted_at timestamptz, revoked_at timestamptz,
  reconfirm_due date,                         -- 동의일 + 2년
  primary key (member_id, channel, purpose)
);

-- 동의·철회 이력(지우지 않는다 — 분쟁 대비 증거)
create table consent_log (
  id bigint generated always as identity primary key,
  member_id bigint, channel text, purpose text, granted boolean,
  text_version text, source text,             -- web, unsubscribe-link, 080, admin
  ip_hash text, user_agent text, at timestamptz not null default now()
);

-- 저장 조건에 건 알림
create table alert_subscription (
  member_id bigint references member(id),
  cond_key text not null,
  channels text[] not null,
  cadence text not null default 'daily',
  last_sent_at timestamptz,
  primary key (member_id, cond_key)
);

-- 보낼 것(트랜잭션 아웃박스) → 큐 → 발송 기록
create table outbox (
  id bigint generated always as identity primary key,
  member_id bigint, channel text, template text, payload jsonb,
  dedupe_key text unique,                     -- 같은 공고를 두 번 보내지 않게
  not_before timestamptz,                     -- 야간이면 다음 날 08:00 으로
  created_at timestamptz not null default now()
);
create table delivery (
  outbox_id bigint references outbox(id),
  provider text, provider_msg_id text,
  status text check (status in ('sent','delivered','bounced','failed','suppressed')),
  error text, at timestamptz not null default now()
);

-- 받지 않을 주소(반송·거부)
create table suppression (
  channel text, address_hash text, reason text, at timestamptz not null default now(),
  primary key (channel, address_hash)
);
```

`saved_searches`(옛 표, 0행)는 버린다. `save_account.phone_tail` 은 문자에 쓸 수 없으므로 이전 때
번호를 다시 받고 본인 확인을 한다.

## 4. 보내는 구조 (AWS)

```
EventBridge Scheduler (매일 07:50 KST)
  └─▶ 알림 배치(ECS 작업 / Spring Batch)
        1. 어제 08:00 이후 새로 들어온 공고를 저장 조건마다 다시 맞춰 본다(match_* 와 같은 규칙)
        2. 새로 걸린 것이 있으면 outbox 에 한 줄(사람·채널마다 하루 한 통으로 묶음)
        3. 동의·확인·suppression 을 다시 검사하고 SQS 로 넘긴다
SQS (+ DLQ) ─▶ 발송 워커 (ECS 서비스, 동시성 제한)
  ├─ 메일: Amazon SES (도메인 인증 DKIM·SPF·DMARC, 반송·스팸신고 → SNS → suppression)
  ├─ 문자: 국내 문자 중계사 API 또는 AWS End User Messaging SMS (아래)
  └─ 알림톡: 카카오 비즈메시지 공식 딜러 API (템플릿 심사 후)
CloudWatch: 발송 수·실패율·반송률 경보. 반송률이 오르면 발송 자동 중지 깃발.
```

### 문자 경로 고르기

| 안 | 장점 | 확인할 것 |
|---|---|---|
| 국내 문자 중계사·재판매사 API (예: NHN Cloud Notification, 네이버 클라우드 SENS, 통신사 계열) | 국내 발신번호 사전등록·080 수신거부·알림톡을 한곳에서. 한국 번호로 발신 | 전송자격인증 여부, 단가, 장애 시 대체 경로 |
| AWS End User Messaging SMS | AWS 안에서 끝남, IAM·CloudWatch 연동 | 한국 수신자에게 국내 등록 발신번호로 보이는지, 등록 절차, 국제 발신 표시 여부 — **보내기 전에 AWS 문서·지원으로 확인** |

기본안은 **국내 중계사 API + 알림톡**, 메일은 SES. 발송 코드는 `Sender` 인터페이스 하나 뒤에 두어
공급자를 바꿀 수 있게 한다.

## 5. 메시지 모양

알림(정보성으로 설계한 것):

```
[나라지원] 저장한 조건(서울 · 28세)에 새 지원사업 3건
- 청년 월세 한시 특별지원 (~10/16)
- …
보기: https://jiwon.knowhow-it.com/a/xxxx
알림 끄기: https://jiwon.knowhow-it.com/u/xxxx
```

광고성 메시지를 보낼 일이 생기면(별도 동의자에게만):

```
(광고)[나라지원] …본문…
문의 02-…
무료수신거부 080-…-…
```

- 메일은 제목 앞에 `(광고)`(광고성일 때), 본문 끝에 전송자 정보·수신 거부 링크(한 번 누르면 끝).
  `List-Unsubscribe`·`List-Unsubscribe-Post` 머리글을 넣는다.
- 짧은 주소(`/a/…`, `/u/…`)는 서명된 토큰이다. 거부 링크는 로그인 없이 바로 처리한다.

## 6. 화면에서 바꿀 것 (보내기 시작할 때)

1. "내 조건 · 알림" 상자: 채널별 스위치(메일·문자·알림톡), 각 스위치 아래 동의 문구(무엇을·언제·얼마나),
   기본값 꺼짐. 켜면 즉시 "동의 처리 결과" 안내.
2. 휴대폰 번호 전체 + 확인 코드(문자 6자리, 3분, 5회 제한).
3. 개인정보 처리방침(`/privacy`)에 항목·목적·보유 기간(탈퇴 또는 2년 미사용 시 파기)·처리 위탁(SES, 문자 중계사) 추가.
4. 2년 재확인 메일·문자, 실패 시 동의 만료 처리.

## 출처 (2026-10-02 확인)

- 국가법령정보센터 — 정보통신망법 제50조: https://www.law.go.kr (법령명 "정보통신망 이용촉진 및 정보보호 등에 관한 법률")
- 정보통신망법 시행령 제62조의2(처리 결과 통지, 14일): https://lbox.kr (시행령 제62조의2, 2025-05-20 시행본)
- 시행령 제62조의3(2년마다 수신동의 확인) 해설: https://www.a4b4.co.kr/2552
- KISA 「불법스팸 방지를 위한 정보통신망법 안내서」 제7차 개정본(2026-03-04) 소개: https://www.kisa.or.kr/402/form?postSeq=2382&lang_type=KO , https://www.digitaltoday.co.kr/news/articleView.html?idxno=511472
- 광고 표기 의무(`(광고)`, 전송자 정보, 무료 수신 거부) 정리: https://powersms.kr/smsv2/docs/ (영리목적의 광고성 정보 전송 시 표기의무 준수 안내)
- 대량문자 전송자격인증제: https://eiec.kdi.re.kr/policy/materialView.do?num=252214
- 발신번호 사전등록제 안내: https://www.smsko.co.kr/info_law/law_callback.html
- 카카오 알림톡 심사 가이드: https://kakaobusiness.gitbook.io/main/ad/infotalk/audit
- AWS End User Messaging SMS 국가별 지원: https://docs.aws.amazon.com/sms-voice/latest/userguide/phone-numbers-sms-by-country.html (한국 세부 조건은 보내기 전에 다시 확인)
