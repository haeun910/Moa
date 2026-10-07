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

Supabase 대시보드 → **SQL Editor**에서 아래 순서대로 실행합니다.

1. [`supabase/schema.sql`](supabase/schema.sql) — 전체 테이블, RLS 정책, 신규 가입자 기본 카테고리 설정
2. [`supabase/migrations/001_add_start_time.sql`](supabase/migrations/001_add_start_time.sql)
3. [`supabase/migrations/002_monthly_goals_ddays.sql`](supabase/migrations/002_monthly_goals_ddays.sql)
4. [`supabase/migrations/003_notices.sql`](supabase/migrations/003_notices.sql) — 공지사항 기능 (관리자 계정 UUID를 본인 것으로 바꿔서 실행)
5. 나머지 [`supabase/migrations/`](supabase/migrations/) 파일도 번호 순서대로 실행 (예: `012_recurrence_series.sql` — 반복 일정/할 일 묶음 수정·삭제)
   (`017_timebox_push_cron.sql`은 아래 "타임박스 알림" 설정을 마친 뒤에 실행)

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

4. 함수 배포: 대시보드 → **Edge Functions → Deploy a new function → Via Editor**, 이름 `send-timebox-push`, 내용은 [`supabase/functions/send-timebox-push/index.ts`](supabase/functions/send-timebox-push/index.ts) → Deploy → 함수 설정에서 **Verify JWT 끄기**

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

6. 앱의 **설정 → 할 일 정리 → 알림**을 켜고 **테스트 알림 보내기**로 확인

> - 알림은 1분 단위로 확인하므로 최대 1분 정도 늦게 올 수 있어요.
> - 아이폰·아이패드는 iOS 16.4 이상에서 **홈 화면에 설치한 앱**으로만 알림을 받을 수 있어요.
> - 알림은 기기(브라우저)마다 따로 켭니다. 로그아웃하면 그 기기의 알림 구독은 자동으로 정리돼요.

### 5. 개발 서버 실행

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
  schema.sql        기본 스키마
  migrations/       스키마 변경 이력 (번호 순으로 실행)
  functions/        Edge Functions (send-timebox-push: 타임박스 알림 발송)
public/
  push-sw.js        서비스워커에 덧붙는 웹 푸시 처리
```

## 배포

Vite로 빌드되는 정적 SPA + PWA입니다. Vercel, Netlify 등 정적 호스팅 서비스에 연결해 `npm run build`(빌드 명령), `dist`(출력 폴더)로 배포할 수 있습니다. 배포 환경에도 `.env`와 동일한 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`(타임박스 알림을 쓰면 `VITE_VAPID_PUBLIC_KEY`도) 환경변수를 설정해야 합니다.
