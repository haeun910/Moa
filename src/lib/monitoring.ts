// 오류 수집 (Sentry). 사용자 화면에는 이미 알림이 뜨지만, 운영자는 이게 없으면 장애를 알 방법이 없었음.
//
// VITE_SENTRY_DSN 환경변수가 있을 때만 켜지고, 없으면 콘솔에만 남김.
// Sentry 코드는 켜져 있을 때만 따로 불러와서(동적 import) 기본 번들 크기에는 영향이 없음.
//
// 개인정보: 이메일·IP 등은 보내지 않고(sendDefaultPii: false) 사용자 id(UUID)만 붙임.
// 할 일·메모 내용은 오류 메시지에 들어가지 않음 (DB 오류는 제약 이름만 돌려줌).
import { APP_VERSION } from '../data/changelog';

type SentryModule = typeof import('./sentryClient');

const dsn = (import.meta.env.VITE_SENTRY_DSN as string | undefined) || '';
let sentry: SentryModule | null = null;
// Sentry를 불러오는 동안 생긴 오류는 모아 뒀다가 보냄
let pending: { err: unknown; context: string }[] = [];
let pendingUserId: string | null | undefined;

export function initMonitoring() {
  if (!dsn) return;
  import('./sentryClient').then(mod => {
    mod.init({
      dsn,
      release: `moa@${APP_VERSION}`,
      environment: import.meta.env.MODE,
      sendDefaultPii: false,
      // 무료 한도를 아끼고 개인 데이터가 섞일 여지를 줄이기 위해 성능 추적·화면 녹화는 끔
      tracesSampleRate: 0,
    });
    sentry = mod;
    if (pendingUserId !== undefined) mod.setUser(pendingUserId ? { id: pendingUserId } : null);
    for (const p of pending) mod.captureException(p.err, { tags: { context: p.context } });
    pending = [];
  }).catch(err => console.error('monitoring init failed', err));
}

export function reportError(err: unknown, context: string) {
  console.error(context, err);
  if (!dsn) return;
  if (sentry) sentry.captureException(err, { tags: { context } });
  else if (pending.length < 20) pending.push({ err, context });
}

export function setMonitoringUser(userId: string | null) {
  if (!dsn) return;
  if (sentry) sentry.setUser(userId ? { id: userId } : null);
  else pendingUserId = userId;
}
