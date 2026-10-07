// 타임박스 알림 발송 함수 (Supabase Edge Function, Deno)
//
// 두 가지 방식으로 불립니다.
//  1) 1분마다 pg_cron이 호출 (헤더 x-cron-secret) → 지금 알려야 할 블록을 찾아 각 사용자 기기로 웹 푸시 발송
//  2) 앱의 설정 > "테스트 알림 보내기" (로그인한 사용자의 JWT) → 그 사용자 기기들로 테스트 알림 발송
//
// 필요한 비밀값 (supabase secrets set ...):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT(mailto:주소), CRON_SECRET
// SUPABASE_URL과 관리자 키(SUPABASE_SERVICE_ROLE_KEY 또는 새 방식의 SUPABASE_SECRET_KEYS)는 Supabase가 자동으로 넣어줍니다.
//
// 배포: supabase functions deploy send-timebox-push --no-verify-jwt
//  (cron 호출은 JWT 대신 CRON_SECRET으로 확인하고, 테스트 호출은 함수 안에서 직접 JWT를 확인함)

import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
// 관리자 키: 예전 방식(service_role) 키가 있으면 그걸, 새 API 키만 쓰는 프로젝트면 secret 키를 사용
function serviceKey(): string {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (legacy) return legacy;
  try {
    const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}') as Record<string, string>;
    return keys.default ?? Object.values(keys)[0] ?? '';
  } catch {
    return '';
  }
}
const SERVICE_KEY = serviceKey();
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com';
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';

// 키가 없을 때 함수가 아예 안 켜지는(BOOT_ERROR) 대신 이유를 응답으로 돌려주도록, 키가 있을 때만 만듦
const admin = SERVICE_KEY ? createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } }) : null!;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface DueBlock {
  block_id: string;
  owner_id: string;
  block_title: string;
  block_start: string;
  block_end: string;
  block_remind: number;
}

interface Subscription {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  time_zone: string | null;
}

interface PushPayload {
  title: string;
  body: string;
  tag: string;
  url: string;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
}

function formatTime(iso: string, timeZone: string | null): string {
  return new Intl.DateTimeFormat('ko-KR', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: timeZone || 'Asia/Seoul',
  }).format(new Date(iso));
}

function durationLabel(startIso: string, endIso: string): string {
  const mins = Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h}시간 ${m}분`;
  if (h) return `${h}시간`;
  return `${m}분`;
}

function buildPayload(block: DueBlock, timeZone: string | null): PushPayload {
  const lead = block.block_remind > 0 ? `${block.block_remind}분 후 시작` : '지금 시작';
  return {
    title: `${lead} · ${block.block_title}`,
    body: `${formatTime(block.block_start, timeZone)} – ${formatTime(block.block_end, timeZone)} (${durationLabel(block.block_start, block.block_end)})`,
    tag: `timeblock-${block.block_id}`,
    url: '/?screen=timebox',
  };
}

// 보내기. 기기가 구독을 해지했거나 만료됐으면(404/410) 구독 줄을 지움
async function send(sub: Subscription, payload: PushPayload): Promise<boolean> {
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
      { TTL: 600, urgency: 'high' },
    );
    return true;
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) {
      await admin.from('push_subscriptions').delete().eq('id', sub.id);
    } else {
      console.error('push failed', status, (err as Error).message);
    }
    return false;
  }
}

async function fetchSubscriptions(userIds: string[]): Promise<Subscription[]> {
  if (userIds.length === 0) return [];
  const { data, error } = await admin
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth, time_zone')
    .in('user_id', userIds);
  if (error) throw error;
  return data ?? [];
}

async function runDueReminders() {
  const { data, error } = await admin.rpc('claim_due_timeblock_reminders');
  if (error) throw error;
  const due = (data ?? []) as DueBlock[];
  if (due.length === 0) return { due: 0, sent: 0 };

  const subs = await fetchSubscriptions([...new Set(due.map(b => b.owner_id))]);
  const jobs: Promise<boolean>[] = [];
  for (const block of due) {
    for (const sub of subs.filter(s => s.user_id === block.owner_id)) {
      jobs.push(send(sub, buildPayload(block, sub.time_zone)));
    }
  }
  const results = await Promise.all(jobs);
  return { due: due.length, sent: results.filter(Boolean).length };
}

async function runTest(req: Request) {
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: { user }, error } = await admin.auth.getUser(jwt);
  if (error || !user) return json({ error: 'unauthorized' }, 401);

  const subs = await fetchSubscriptions([user.id]);
  if (subs.length === 0) return json({ sent: 0, devices: 0 });
  const results = await Promise.all(subs.map(sub => send(sub, {
    title: '모아 알림 테스트',
    body: '이렇게 타임박스가 시작할 때 알려드려요.',
    tag: 'moa-test',
    url: '/?screen=timebox',
  })));
  return json({ sent: results.filter(Boolean).length, devices: subs.length });
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  if (!SERVICE_KEY) return json({ error: 'service key not found (SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SECRET_KEYS)' }, 500);
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return json({ error: 'VAPID keys are not configured' }, 500);
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  try {
    if (CRON_SECRET && req.headers.get('x-cron-secret') === CRON_SECRET) {
      return json(await runDueReminders());
    }
    return await runTest(req);
  } catch (err) {
    console.error(err);
    return json({ error: (err as Error).message }, 500);
  }
});
