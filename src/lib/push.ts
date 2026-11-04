import { supabase } from './supabase';

// 타임박스 알림(웹 푸시) - 기기(브라우저)마다 따로 켜고 끔.
// 서버 쪽 발송은 supabase/functions/send-timebox-push, 알림 표시는 public/push-sw.js가 맡음.

const VAPID_PUBLIC_KEY = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) ?? '';

export const isPushConfigured = Boolean(VAPID_PUBLIC_KEY);

export function isPushSupported(): boolean {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
}

// 아이폰/아이패드는 홈 화면에 설치한 앱에서만 웹 푸시를 받을 수 있음 (iOS 16.4+)
export function isIosBrowserTab(): boolean {
  const ua = navigator.userAgent;
  const isIos = /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return isIos && !standalone;
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

// 서비스워커가 아직 등록 안 됐으면(개발 서버 첫 실행 등) ready가 영원히 안 끝나므로 시간 제한을 둠
async function getRegistration(timeoutMs = 8000): Promise<ServiceWorkerRegistration> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('앱 준비가 아직 안 됐어요. 잠시 후 다시 시도해주세요.')), timeoutMs));
  return Promise.race([navigator.serviceWorker.ready, timeout]);
}

export async function getPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return (await reg?.pushManager.getSubscription()) ?? null;
}

export async function enablePush(): Promise<void> {
  if (!isPushSupported()) throw new Error('이 브라우저는 알림을 지원하지 않아요.');
  if (!isPushConfigured) throw new Error('알림 서버 설정(VAPID 키)이 아직 안 되어 있어요.');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('알림 권한이 허용되지 않았어요. 브라우저 설정에서 허용해주세요.');

  const reg = await getRegistration();
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const json = sub.toJSON();
  const { error } = await supabase.rpc('register_push_subscription', {
    p_endpoint: sub.endpoint,
    p_p256dh: json.keys?.p256dh ?? '',
    p_auth: json.keys?.auth ?? '',
    p_time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    p_user_agent: navigator.userAgent.slice(0, 300),
  });
  if (error) throw error;
}

// 이 기기의 알림 끄기 (로그아웃할 때도 호출 - 다른 사람이 같은 기기로 로그인해도 이전 계정 알림이 오지 않게)
export async function disablePush(): Promise<void> {
  const sub = await getPushSubscription();
  if (!sub) return;
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
  await sub.unsubscribe();
}

export async function sendTestPush(): Promise<{ sent: number; devices: number }> {
  const { data, error } = await supabase.functions.invoke('send-timebox-push', { body: { mode: 'test' } });
  if (error) {
    // 함수가 돌려준 실제 이유(상태 코드 + error 문구)를 화면에 보여줘서 설정 문제를 바로 찾을 수 있게 함
    const res = (error as { context?: unknown }).context;
    if (res instanceof Response) {
      const body = await res.clone().json().catch(() => null) as { error?: string; message?: string } | null;
      const detail = body?.error ?? body?.message ?? (await res.text().catch(() => '')).slice(0, 120);
      throw new Error(`${res.status}${detail ? ` · ${detail}` : ''}`);
    }
    throw error;
  }
  return data as { sent: number; devices: number };
}
