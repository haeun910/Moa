# 모아 (Moa)

할 일과 일정을 한 곳에 모아서 관리하는 개인용 플래너 웹앱(PWA)입니다.

## 주요 기능

- **할 일 관리** — 하위 항목, 카테고리, 날짜·시간 지정, 드래그로 순서/날짜 변경
- **캘린더** — 월간/주간 보기, 날짜별 시간표(시간대별 일정) 보기
- **타임박스** — 일주일을 시간 블록으로 계획(할 일 끌어다 놓기), 홈 화면에 오늘 하루 막대, 블록 시작 시 웹 푸시 알림
- **저장소** — 날짜 없이 카테고리별로 보관하는 할 일 목록
- **메모**
- **이번 달 목표 & D-Day**
- **내 보드** — 오늘/내일 할 일을 한눈에
- **성취 리포트** — 월별 달성률, 최근 14일 추이, 카테고리별 통계
- **공지사항** — 운영자가 올리는 공지를 모든 사용자가 확인 (관리자만 작성 가능)
- **다크모드** (라이트/다크/시스템)
- **PWA 설치** — 홈 화면에 앱처럼 설치 가능 (설정 화면에서 원클릭 설치 또는 안내)
- **계정 관리** — 비밀번호 변경, 데이터 내보내기(JSON 백업), 계정 삭제
- 이메일/비밀번호 및 Google 로그인 지원

## 기술 스택

- [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) + [Vite](https://vite.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Supabase](https://supabase.com/) — 인증, 데이터베이스(Postgres + RLS), 실시간 동기화
- [dnd-kit](https://dndkit.com/) — 드래그 앤 드롭
- [date-fns](https://date-fns.org/)
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) — PWA/오프라인 지원

## 시작하기

### 1. 설치

```bash
npm install
```

### 2. 환경변수 설정

`.env.example`을 참고해서 프로젝트 루트에 `.env` 파일을 만듭니다.

```bash
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

값은 [Supabase 대시보드](https://supabase.com/dashboard) → 프로젝트 → **Project Settings → API**에서 확인할 수 있습니다.

> `.env`가 없거나 값이 비어 있으면 앱이 흰 화면 대신 "환경설정이 필요해요" 안내 화면을 보여줍니다.

### 3. Supabase 데이터베이스 설정

Supabase 대시보드 → **SQL Editor**에서 실행합니다.

**새 프로젝트:** [`supabase/schema.sql`](supabase/schema.sql) 하나만 실행하면 됩니다. 모든 테이블, RLS 정책, 함수, 신규 가입자 기본 카테고리까지 마이그레이션 001~016, 018을 모두 실행한 것과 같은 상태가 됩니다. 실행 전에 파일 안의 관리자 계정 UUID를 본인 것으로 바꾸세요. (`017_timebox_push_cron.sql`은 아래 "타임박스 알림" 설정을 마친 뒤에 따로 실행)

**이미 운영 중인 DB:** `schema.sql`은 실행하지 말고, [`supabase/migrations/`](supabase/migrations/)에서 아직 실행하지 않은 파일만 번호 순서대로 실행합니다. 예를 들어 `018_hardening.sql`은 순서 바꾸기를 요청 한 번으로 저장하는 함수, 남의 데이터를 연결하지 못하게 막는 검사, 글자 수 상한을 추가합니다. 실행하지 않아도 앱은 동작하지만(예전 방식으로 저장) 보안 검사는 빠집니다.

`schema.sql`과 마이그레이션 결과가 같은지는 `npm run test:db`로 검사합니다(아래 "테스트" 참고).

Google 로그인을 쓰려면 Supabase 대시보드 → **Authentication → Providers**에서 Google을 활성화하고 OAuth 클라이언트를 등록해야 합니다.

### 4. 타임박스 알림(웹 푸시) 설정 — 선택

타임박스 블록이 시작할 때 앱을 닫아둬도 알림이 오게 하려면 아래를 한 번 설정합니다.
설정하지 않아도 앱은 그대로 동작하고, 설정 화면의 알림 스위치만 "알림 서버 설정이 아직 안 되어 있어요"로 표시됩니다.

**구조:** Supabase의 pg_cron이 1분마다 Edge Function `send-timebox-push`를 부름 → 함수가 지금 알려야 할 블록을 찾아 각 기기로 웹 푸시 발송 → 서비스워커(`public/push-sw.js`)가 알림을 띄움. 모두 Supabase 서버에서 돌아가므로 내 컴퓨터를 켜둘 필요는 없습니다.

1. VAPID 키 만들기 (한 번만, 터미널/PowerShell 어디서든)

   ```bash
   npx web-push generate-vapid-keys
   ```

2. **공개 키(Public Key)** 를 프런트엔드에 넣기: 로컬 `.env`에 `VITE_VAPID_PUBLIC_KEY=<Public Key>`, 배포 서비스(Vercel 등) 환경 변수에도 같은 값 → 다시 배포

3. Supabase 대시보드 → **Edge Functions → Secrets**에 비밀값 추가 (`CRON_SECRET`은 직접 정한 긴 임의 문자열)
   - `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`(`mailto:내 이메일`), `CRON_SECRET`
   - **Private Key는 여기에만** 넣고 `.env`·git에는 넣지 않습니다.

4. 함수 배포: 대시보드 → **Edge Functions → Deploy a new function → Via Editor**, 내용은 [`supabase/functions/send-timebox-push/index.ts`](supabase/functions/send-timebox-push/index.ts) 전체 → **이름을 `send-timebox-push`로 입력한 뒤** Deploy → 함수 설정에서 **Verify JWT 끄기**

   > ⚠️ **함수 주소(slug)는 처음 만들 때 정해지고 나중에 바뀌지 않아요.** 이름을 입력하지 않고 Deploy하면 `quick-processor` 같은 임의 주소가 붙고, 설정에서 이름을 바꿔도 주소는 그대로라 앱이 함수를 찾지 못해요(`NOT_FOUND`).
   > 배포 후 브라우저로 `https://<프로젝트ID>.supabase.co/functions/v1/send-timebox-push`를 열어 `{"error":"method not allowed"}`가 나오면 주소가 맞는 거예요.
   > 편집기에는 **함수 코드(TypeScript)**만 넣어야 해요. SQL을 넣으면 `Expression expected` 오류로 배포가 실패해요.

   CLI로 하려면 (PowerShell은 한 줄로):

   ```bash
   npx supabase link --project-ref <프로젝트ID>
   npx supabase secrets set VAPID_PUBLIC_KEY=<Public> VAPID_PRIVATE_KEY=<Private> VAPID_SUBJECT=mailto:<이메일> CRON_SECRET=<임의 문자열>
   npx supabase functions deploy send-timebox-push --no-verify-jwt
   ```

5. **SQL Editor**에서 Vault에 비밀값을 넣고 스케줄 등록

   ```sql
   select vault.create_secret('https://<프로젝트ID>.supabase.co', 'project_url');
   select vault.create_secret('<3번의 CRON_SECRET과 같은 값>', 'timebox_cron_secret');
   ```

   그다음 [`supabase/migrations/017_timebox_push_cron.sql`](supabase/migrations/017_timebox_push_cron.sql) 실행

6. 앱의 **설정 → 할 일 정리 → 알림**을 켜고 **테스트 알림 보내기**로 확인 → 2~3분 뒤 시작하는 블록을 만들어 실제 알림도 확인

**알림이 안 올 때**

| 증상 | 확인 / 해결 |
| --- | --- |
| 알림 칸에 "알림 서버 설정이 아직 안 되어 있어요" | 배포 환경에 `VITE_VAPID_PUBLIC_KEY`가 없거나, 넣은 뒤 다시 배포하지 않음 |
| 테스트 알림: `Failed to send a request to the Edge Function` | 함수 주소가 `send-timebox-push`가 아님 (4번 주의사항) |
| 테스트 알림: `500 · VAPID keys are not configured` | Edge Functions → Secrets에 VAPID 키가 없음 |
| 테스트는 되는데 블록 알림만 안 옴 | SQL Editor에서 `select status_code, content, created from net._http_response order by created desc limit 5;` 실행 |
| ↳ `404` | Vault의 `project_url`이 틀림 (`https://`는 한 번만, 끝에 `/` 없이) |
| ↳ `401` | Vault의 `timebox_cron_secret`과 함수 Secrets의 `CRON_SECRET` 값이 다름 |
| ↳ `500 · Could not find the function public.claim_due_timeblock_reminders` | `016_timeblocks.sql`을 끝까지 다시 실행 (마지막 줄이 API 새로고침) |
| ↳ `200`이고 `{"due":0,...}`만 계속 | 정상. 블록 알림 시각이 되면 `due`가 1 이상으로 바뀜 (10분 넘게 지난 알림은 보내지 않음) |

> - 알림은 1분 단위로 확인하므로 최대 1분 정도 늦게 올 수 있어요.
> - 아이폰·아이패드는 iOS 16.4 이상에서 **홈 화면에 설치한 앱**으로만 알림을 받을 수 있어요.
> - 알림은 기기(브라우저)마다 따로 켭니다. 로그아웃하면 그 기기의 알림 구독은 자동으로 정리돼요.

### 5. 오류 수집(Sentry) — 선택

사용자 화면에서 난 오류(저장 실패, 화면 오류 등)를 운영자가 모아 보려면 [Sentry](https://sentry.io)에서 React 프로젝트를 만들고 DSN을 환경변수로 넣습니다.

```bash
VITE_SENTRY_DSN=https://...@....ingest.sentry.io/...
```

넣지 않으면 오류는 브라우저 콘솔에만 남고 Sentry 코드도 번들에 들어가지 않습니다. 이메일·IP·입력한 내용은 보내지 않고 계정 ID(UUID)만 붙입니다.

### 6. 개발 서버 실행

```bash
npm run dev
```

## 스크립트

| 명령어 | 설명 |
| --- | --- |
| `npm run dev` | 개발 서버 실행 |
| `npm run build` | 타입 체크 후 프로덕션 빌드 |
| `npm run preview` | 빌드 결과 미리보기 |
| `npm run lint` | oxlint 실행 |
| `npm test` | 단위 테스트 (Vitest) |
| `npm run test:db` | 로컬 Postgres에서 `schema.sql`과 마이그레이션 결과 비교 + RLS·탈퇴·소유자 확인 등 DB 테스트 (`PGHOST`/`PGUSER` 등으로 접속 정보 지정) |
| `npm run test:e2e` | 가짜 Supabase로 화면 스모크 테스트 (Playwright, 할 일 1,000개 넘게 불러오기 포함). 설치된 크롬을 쓰려면 `CHROMIUM_PATH` 지정 |

GitHub에 푸시하면 `.github/workflows/ci.yml`이 위 검사를 모두 자동으로 돌립니다.

## 폴더 구조

```
src/
  components/   재사용 컴포넌트 (모달, 로고, 알림 등)
  context/      전역 상태 (Auth, App 데이터)
  hooks/        커스텀 훅 (PWA 설치 등)
  lib/          Supabase 클라이언트 & DB 함수, 타임박스 계산, 웹 푸시 구독
  pages/        화면 단위 페이지
  types/        공용 타입 정의
supabase/
  schema.sql        새 프로젝트용 전체 스키마 (마이그레이션 결과와 같음)
  migrations/       스키마 변경 이력 (운영 중인 DB에는 번호 순으로 실행)
  tests/            스키마 비교·DB 동작 테스트 (npm run test:db)
  functions/        Edge Functions (send-timebox-push: 타임박스 알림 발송)
public/
  push-sw.js        서비스워커에 덧붙는 웹 푸시 처리
```

## 배포

Vite로 빌드되는 정적 SPA + PWA입니다. Vercel, Netlify 등 정적 호스팅 서비스에 연결해 `npm run build`(빌드 명령), `dist`(출력 폴더)로 배포할 수 있습니다. 배포 환경에도 `.env`와 동일한 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`(타임박스 알림을 쓰면 `VITE_VAPID_PUBLIC_KEY`, 오류 수집을 쓰면 `VITE_SENTRY_DSN`도) 환경변수를 설정해야 합니다.
