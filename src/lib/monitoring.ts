// 오류 수집 (Sentry). 사용자 화면에는 이미 알림이 뜨지만, 운영자는 이게 없으면 장애를 알 방법이 없었음.
//
// VITE_SENTRY_DSN 환경변수가 있을 때만 켜지고, 없으면 콘솔에만 남김.
// Sentry 코드는 켜져 있을 때만 따로 불러와서(동적 import) 기본 번들 크기에는 영향이 없음.
//
// 개인정보: 이메일·IP 등은 보내지 않고(sendDefaultPii: false) 사용자 id(UUID)만 붙임.
// 할 일·메모 내용이 섞이지 않도록 보내기 전에 오류를 정리함 (sanitizeError).
import { APP_VERSION } from '../data/changelog';

type SentryModule = typeof import('./sentryClient');

const dsn = (import.meta.env.VITE_SENTRY_DSN as string | undefined) || '';
let sentry: SentryModule | null = null;
// Sentry를 불러오는 동안 생긴 오류는 모아 뒀다가 보냄
let pending: { err: unknown; context: string }[] = [];
let pendingUserId: string | null | undefined;

// DB(PostgREST) 오류의 details/hint에는 "Failing row contains (...)"처럼 행의 실제 값이 들어갈 수 있음.
// 그래서 오류 코드와 메시지만 남기고, 메시지에 섞인 행 값·따옴표 안 값도 지움.
const MAX_MESSAGE = 300;

export function redactMessage(message: string): string {
  return message
    .replace(/Failing row contains \(.*\)/gs, 'Failing row contains (…)')
    .replace(/Key \(([^)]*)\)=\(.*?\)/gs, 'Key ($1)=(…)')
    // 따옴표 안 값은 지우되, 제약·테이블 이름(todos_title_length 같은 것)은 원인 파악용으로 남김
    .replace(/"[^"]*"|'[^']*'/g, m => (/^["'][a-z0-9.]*_[a-z0-9_.]*["']$/.test(m) ? m : '"…"'))
    .slice(0, MAX_MESSAGE);
}

export function sanitizeError(err: unknown): Error {
  if (err && typeof err === 'object') {
    const { code, message, name } = err as { code?: unknown; message?: unknown; name?: unknown };
    const msg = typeof message === 'string' ? redactMessage(message) : 'unknown error';
    // Supabase 오류: details/hint는 버리고 코드+메시지만
    if (typeof code === 'string' && code) {
      const out = new Error(`${code}: ${msg}`);
      out.name = 'DbError';
      return out;
    }
    if (err instanceof Error) {
      const out = new Error(msg);
      out.name = typeof name === 'string' ? name : 'Error';
      out.stack = err.stack ? err.stack.replace(err.message, msg) : undefined;
      return out;
    }
    return new Error(msg);
  }
  return new Error(typeof err === 'string' ? redactMessage(err) : 'unknown error');
}

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
    for (const p of pending) mod.captureException(sanitizeError(p.err), { tags: { context: p.context } });
    pending = [];
  }).catch(err => console.error('monitoring init failed', err));
}

export function reportError(err: unknown, context: string) {
  console.error(context, err);
  if (!dsn) return;
  if (sentry) sentry.captureException(sanitizeError(err), { tags: { context } });
  else if (pending.length < 20) pending.push({ err, context });
}

export function setMonitoringUser(userId: string | null) {
  if (!dsn) return;
  if (sentry) sentry.setUser(userId ? { id: userId } : null);
  else pendingUserId = userId;
}
