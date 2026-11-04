// 오프라인 저장: 인터넷이 끊겨도 추가·수정·삭제가 실패하지 않게, 보내지 못한 요청을 이 기기에 보관했다가
// 다시 연결되면 적은 순서대로 서버에 보냄.
//
// Supabase 클라이언트의 fetch를 감싸서 동작함 (supabase.ts의 global.fetch).
// - 보관 대상: 내 데이터 표의 추가(POST)·수정(PATCH)·삭제(DELETE), 순서 바꾸기(reorder_items)
// - 새 항목은 기기에서 id를 정해 보내므로(db.ts), 오프라인에서 만든 항목을 바로 고치거나 지워도 순서대로 맞게 반영됨
// - 보관한 요청에는 응답이 없으므로, 보낸 내용으로 "성공" 응답을 만들어 돌려줌 (화면은 그대로 진행)
// - 같은 요청이 두 번 가도 결과가 같게(추가는 같은 id면 중복 오류 → 이미 반영된 것으로 봄) 만들어 둠
import { offlineStore } from './offlineStore';

export interface OutboxEntry {
  seq: number;
  userId: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | null;
  createdAt: string;
}

export interface OutboxState {
  online: boolean;
  pending: number; // 지금 로그인한 사람의 보관 중인 변경 수
  syncing: boolean;
}

const QUEUE_TABLES = new Set([
  'todos', 'categories', 'subcategories', 'notes', 'note_folders', 'user_settings',
  'monthly_goals', 'ddays', 'schedules', 'timeblocks', 'feedback',
]);
const QUEUE_RPCS = new Set(['reorder_items']);
const KEEP_HEADERS = ['content-type', 'prefer', 'accept', 'content-profile', 'accept-profile', 'x-client-info'];

// 응답을 흉내 낼 때 DB 기본값 (화면이 읽는 칸만)
const DEFAULTS: Record<string, Record<string, unknown>> = {
  todos: { completed: false, skipped: false, is_dday: false, notes: null, series_id: null },
  notes: { pinned: false, folder_id: null },
  categories: { is_default: false, description: null },
  subcategories: { notes: null },
  schedules: { completed: false, notes: null, series_id: null, end_date: null, end_time: null },
  timeblocks: { completed: false, notified_at: null, series_id: null, todo_id: null },
  monthly_goals: { completed: false },
};

let queue: OutboxEntry[] = [];
let loaded: Promise<void> | null = null;
let lastSeq = 0;
let syncing = false;
let activeUserId: string | null = null;
let config: { apiKey: string; getAccessToken: () => Promise<string | null>; baseFetch: typeof fetch } | null = null;

type Listener = (state: OutboxState) => void;
const listeners = new Set<Listener>();
type DrainListener = (result: { sent: number; failed: number }) => void;
const drainListeners = new Set<DrainListener>();

function isOnline() {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

export function getOutboxState(): OutboxState {
  return { online: isOnline(), pending: pendingFor(activeUserId), syncing };
}

function emit() {
  const state = getOutboxState();
  for (const l of listeners) l(state);
}

export function subscribeOutbox(listener: Listener): () => void {
  listeners.add(listener);
  listener(getOutboxState());
  return () => { listeners.delete(listener); };
}

// 보관한 변경을 다 보낸 뒤 알림 (화면을 서버 내용으로 다시 맞추는 데 사용)
export function onOutboxDrained(listener: DrainListener): () => void {
  drainListeners.add(listener);
  return () => { drainListeners.delete(listener); };
}

export function pendingFor(userId: string | null): number {
  if (!userId) return 0;
  return queue.filter(e => e.userId === userId).length;
}

export function setOutboxUser(userId: string | null) {
  activeUserId = userId;
  emit();
}

export function loadOutbox(): Promise<void> {
  loaded ??= (async () => {
    const saved = (await offlineStore.getAll<OutboxEntry>('outbox')) ?? [];
    // 메모리에 먼저 쌓인 것(불러오는 사이에 생긴 것)과 합침
    const known = new Set(queue.map(e => e.seq));
    queue = [...saved.filter(e => !known.has(e.seq)), ...queue].sort((a, b) => a.seq - b.seq);
    lastSeq = queue.reduce((m, e) => Math.max(m, e.seq), lastSeq);
    emit();
  })();
  return loaded;
}

// 로그아웃할 때: 그 사람의 보관 중인 변경을 지움 (같은 기기를 다른 사람이 쓸 수 있으므로)
export async function clearOutboxFor(userId: string) {
  await loadOutbox();
  const mine = queue.filter(e => e.userId === userId);
  queue = queue.filter(e => e.userId !== userId);
  await Promise.all(mine.map(e => offlineStore.delete('outbox', e.seq)));
  emit();
}

function userIdFromAuth(headers: Headers): string | null {
  const token = (headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  const payload = token.split('.')[1];
  if (!payload) return null;
  try {
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as { sub?: string; role?: string };
    return json.role === 'authenticated' && json.sub ? json.sub : null;
  } catch {
    return null;
  }
}

function target(url: string): { kind: 'table' | 'rpc'; name: string } | null {
  let path: string;
  try { path = new URL(url).pathname; } catch { return null; }
  const m = /\/rest\/v1\/(rpc\/)?([A-Za-z0-9_]+)$/.exec(path);
  if (!m) return null;
  return m[1] ? { kind: 'rpc', name: m[2] } : { kind: 'table', name: m[2] };
}

export function isQueueable(url: string, method: string): boolean {
  const t = target(url);
  if (!t) return false;
  if (t.kind === 'rpc') return method === 'POST' && QUEUE_RPCS.has(t.name);
  return (method === 'POST' || method === 'PATCH' || method === 'DELETE') && QUEUE_TABLES.has(t.name);
}

// 보관한 요청에 대한 "성공" 응답 만들기 (보낸 내용 + DB 기본값)
export function syntheticResponse(entry: Pick<OutboxEntry, 'url' | 'method' | 'headers' | 'body'>): Response {
  const t = target(entry.url);
  const prefer = (entry.headers.prefer ?? '').toLowerCase();
  const accept = (entry.headers.accept ?? '').toLowerCase();
  const wantsRows = prefer.includes('return=representation');
  if (!wantsRows || t?.kind === 'rpc' || entry.method === 'DELETE') return new Response(null, { status: entry.method === 'POST' ? 201 : 204 });

  let body: unknown = null;
  try { body = entry.body ? JSON.parse(entry.body) : null; } catch { body = null; }
  const now = new Date().toISOString();
  const defaults = (t && DEFAULTS[t.name]) ?? {};
  let rows: Record<string, unknown>[] = Array.isArray(body) ? body as Record<string, unknown>[] : body && typeof body === 'object' ? [body as Record<string, unknown>] : [];
  if (entry.method === 'PATCH') {
    const id = new URL(entry.url).searchParams.get('id')?.replace(/^eq\./, '');
    rows = id ? rows.map(r => ({ id, ...r })) : [];
  }
  rows = rows.map(r => ({ ...defaults, created_at: now, updated_at: now, ...r }));
  const single = accept.includes('vnd.pgrst.object');
  return new Response(JSON.stringify(single ? rows[0] ?? null : rows), {
    status: entry.method === 'POST' ? 201 : 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function nextSeq() {
  lastSeq = Math.max(Date.now() * 1000, lastSeq + 1);
  return lastSeq;
}

async function enqueue(entry: Omit<OutboxEntry, 'seq' | 'createdAt'>): Promise<OutboxEntry> {
  const full: OutboxEntry = { ...entry, seq: nextSeq(), createdAt: new Date().toISOString() };
  queue.push(full);
  await offlineStore.put('outbox', full);
  emit();
  return full;
}

async function remove(entry: OutboxEntry) {
  queue = queue.filter(e => e.seq !== entry.seq);
  await offlineStore.delete('outbox', entry.seq);
}

function headersOf(init: RequestInit | undefined, input: RequestInfo | URL): Headers {
  const h = new Headers(input instanceof Request ? input.headers : undefined);
  new Headers(init?.headers).forEach((v, k) => h.set(k, v));
  return h;
}

// Supabase 클라이언트에 넘기는 fetch
export function createOfflineFetch(baseFetch: typeof fetch = (...args) => fetch(...args)): typeof fetch {
  return async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
    if (!isQueueable(url, method) || (init?.body !== undefined && init.body !== null && typeof init.body !== 'string')) {
      return baseFetch(input, init);
    }
    const headers = headersOf(init, input);
    const userId = userIdFromAuth(headers);
    if (!userId) return baseFetch(input, init);
    const kept: Record<string, string> = {};
    for (const k of KEEP_HEADERS) { const v = headers.get(k); if (v !== null) kept[k] = v; }
    const draft = { userId, url, method, headers: kept, body: (init?.body as string | undefined) ?? null };

    await loadOutbox();
    // 끊겨 있거나, 앞서 보관한 변경이 남아 있으면(순서를 지키려고) 이것도 뒤에 보관
    if (!isOnline() || pendingFor(userId) > 0) {
      await enqueue(draft);
      void drainOutbox();
      return syntheticResponse(draft);
    }
    try {
      return await baseFetch(input, init);
    } catch (err) {
      if (init?.signal?.aborted || (err instanceof DOMException && err.name === 'AbortError')) throw err;
      // 네트워크 오류(서버에 닿지 못함) → 보관했다가 다시 보냄. 실제로는 닿았더라도 다시 보내도 결과가 같음
      await enqueue(draft);
      void drainOutbox();
      return syntheticResponse(draft);
    }
  };
}

export function configureOutbox(next: { apiKey: string; getAccessToken: () => Promise<string | null>; baseFetch?: typeof fetch }) {
  config = { baseFetch: (...args) => fetch(...args), ...next };
}

// 보관한 변경을 차례대로 보냄. 네트워크가 안 되거나 서버가 잠시 못 받으면 멈췄다가 다음 기회에 다시
export async function drainOutbox(): Promise<void> {
  if (syncing || !config || !isOnline()) return;
  await loadOutbox();
  const userId = activeUserId;
  if (!userId || pendingFor(userId) === 0) return;
  syncing = true;
  emit();
  let sent = 0;
  let failed = 0;
  try {
    const token = await config.getAccessToken();
    if (!token) return;
    for (;;) {
      const entry = queue.find(e => e.userId === userId);
      if (!entry) break;
      const headers = new Headers(entry.headers);
      headers.set('authorization', `Bearer ${token}`);
      headers.set('apikey', config.apiKey);
      let res: Response;
      try {
        res = await config.baseFetch(entry.url, { method: entry.method, headers, body: entry.body ?? undefined });
      } catch {
        break; // 아직 연결이 불안정함 → 다음에
      }
      if (res.ok) {
        sent++;
        await remove(entry);
      } else if (res.status === 401 || res.status === 408 || res.status === 429 || res.status >= 500) {
        break; // 로그인 갱신 중이거나 서버가 잠시 바쁨 → 다음에
      } else {
        // 같은 id로 이미 추가된 경우(중복) = 이미 반영됨. 그 밖의 거절(지워진 항목에 연결 등)은 버리고 다음으로
        const text = await res.text().catch(() => '');
        if (/"code"\s*:\s*"23505"/.test(text)) sent++;
        else failed++;
        await remove(entry);
      }
      emit();
    }
  } finally {
    syncing = false;
    emit();
    if ((sent > 0 || failed > 0) && pendingFor(userId) === 0) {
      for (const l of drainListeners) l({ sent, failed });
    }
  }
}

// 다시 연결되면, 앱으로 돌아오면, 그리고 남은 게 있으면 30초마다 다시 보내 봄
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { emit(); void drainOutbox(); });
  window.addEventListener('offline', emit);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void drainOutbox(); });
  setInterval(() => { if (pendingFor(activeUserId) > 0) void drainOutbox(); }, 30000);
}

// 테스트용: 모듈 상태 초기화
export function __resetOutboxForTest() {
  queue = [];
  loaded = null;
  lastSeq = 0;
  syncing = false;
  activeUserId = null;
  config = null;
  listeners.clear();
  drainListeners.clear();
}
