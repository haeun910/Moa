import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetOutboxForTest, configureOutbox, createOfflineFetch, drainOutbox, isQueueable, onOutboxDrained, pendingFor, setOutboxUser, syntheticResponse,
} from './outbox';

const BASE = 'https://x.supabase.co/rest/v1';
const USER = '00000000-0000-0000-0000-00000000000a';
const jwt = (sub: string) => `h.${btoa(JSON.stringify({ sub, role: 'authenticated' })).replace(/=+$/, '')}.s`;
const authHeaders = { Authorization: `Bearer ${jwt(USER)}`, apikey: 'anon', 'Content-Type': 'application/json' };

function setOnline(on: boolean) {
  Object.defineProperty(globalThis.navigator, 'onLine', { value: on, configurable: true });
}

beforeEach(() => {
  __resetOutboxForTest();
  setOutboxUser(USER);
  setOnline(true);
});
afterEach(() => setOnline(true));

describe('isQueueable', () => {
  it('내 데이터 표의 쓰기와 순서 바꾸기만 보관', () => {
    expect(isQueueable(`${BASE}/todos?id=eq.1`, 'PATCH')).toBe(true);
    expect(isQueueable(`${BASE}/todos`, 'GET')).toBe(false);
    expect(isQueueable(`${BASE}/notices`, 'POST')).toBe(false);
    expect(isQueueable(`${BASE}/rpc/reorder_items`, 'POST')).toBe(true);
    expect(isQueueable(`${BASE}/rpc/delete_my_account`, 'POST')).toBe(false);
    expect(isQueueable('https://x.supabase.co/auth/v1/token', 'POST')).toBe(false);
  });
});

describe('syntheticResponse', () => {
  it('추가는 보낸 내용 + 기본값을 한 줄로', async () => {
    const res = syntheticResponse({
      url: `${BASE}/todos?select=*`, method: 'POST',
      headers: { prefer: 'return=representation', accept: 'application/vnd.pgrst.object+json' },
      body: JSON.stringify({ id: 't1', user_id: USER, title: '우유 사기' }),
    });
    expect(res.status).toBe(201);
    const row = await res.json();
    expect(row).toMatchObject({ id: 't1', title: '우유 사기', completed: false, skipped: false });
    expect(typeof row.created_at).toBe('string');
  });
  it('수정·삭제는 빈 응답', () => {
    expect(syntheticResponse({ url: `${BASE}/todos?id=eq.t1`, method: 'PATCH', headers: {}, body: '{"completed":true}' }).status).toBe(204);
    expect(syntheticResponse({ url: `${BASE}/todos?id=eq.t1`, method: 'DELETE', headers: {}, body: null }).status).toBe(204);
  });
});

describe('createOfflineFetch + drainOutbox', () => {
  it('연결돼 있으면 그대로 보냄', async () => {
    const base = vi.fn(async () => new Response(null, { status: 204 }));
    const f = createOfflineFetch(base as unknown as typeof fetch);
    const res = await f(`${BASE}/todos?id=eq.t1`, { method: 'PATCH', headers: authHeaders, body: '{"completed":true}' });
    expect(res.status).toBe(204);
    expect(base).toHaveBeenCalledTimes(1);
    expect(pendingFor(USER)).toBe(0);
  });

  it('끊기면 보관했다가 다시 연결되면 순서대로 보냄', async () => {
    const calls: string[] = [];
    let network = false;
    const base = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      if (!network) throw new TypeError('Failed to fetch');
      calls.push(`${init?.method} ${String(url).replace(BASE, '')} ${init?.body ?? ''} ${new Headers(init?.headers).get('authorization')}`);
      return new Response(null, { status: 201 });
    });
    const f = createOfflineFetch(base as unknown as typeof fetch);
    configureOutbox({ apiKey: 'anon', getAccessToken: async () => 'fresh-token', baseFetch: base as unknown as typeof fetch });

    // 1) 서버에 닿지 못함 → 보관, 화면에는 성공으로 돌려줌
    const created = await f(`${BASE}/todos?select=*`, {
      method: 'POST', body: JSON.stringify({ id: 't9', user_id: USER, title: '새 할 일' }),
      headers: { ...authHeaders, Prefer: 'return=representation', Accept: 'application/vnd.pgrst.object+json' },
    });
    expect((await created.json()).id).toBe('t9');
    // 2) 보관한 게 남아 있으면 연결 여부와 상관없이 뒤에 줄 섬 (순서 유지)
    setOnline(false);
    await f(`${BASE}/todos?id=eq.t9`, { method: 'PATCH', headers: authHeaders, body: '{"completed":true}' });
    expect(pendingFor(USER)).toBe(2);

    const drained = vi.fn();
    onOutboxDrained(drained);
    setOnline(true);
    network = true;
    await drainOutbox();
    expect(pendingFor(USER)).toBe(0);
    expect(calls).toEqual([
      'POST /todos?select=* {"id":"t9","user_id":"00000000-0000-0000-0000-00000000000a","title":"새 할 일"} Bearer fresh-token',
      'PATCH /todos?id=eq.t9 {"completed":true} Bearer fresh-token',
    ]);
    expect(drained).toHaveBeenCalledWith({ sent: 2, failed: 0 });
  });

  it('이미 들어간 추가(중복)는 성공으로, 거절은 버리고, 서버 오류면 멈춤', async () => {
    const replies = [
      new Response('{"code":"23505"}', { status: 409 }),
      new Response('{"code":"23503"}', { status: 409 }),
      new Response('oops', { status: 503 }),
    ];
    let offline = true;
    const base = vi.fn(async () => { if (offline) throw new TypeError('Failed to fetch'); return replies.shift()!; });
    const f = createOfflineFetch(base as unknown as typeof fetch);
    configureOutbox({ apiKey: 'anon', getAccessToken: async () => 'tok', baseFetch: base as unknown as typeof fetch });
    setOnline(false);
    for (const id of ['a', 'b', 'c']) await f(`${BASE}/todos`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ id }) });
    expect(pendingFor(USER)).toBe(3);
    setOnline(true);
    offline = false;
    await drainOutbox();
    expect(pendingFor(USER)).toBe(1); // 503에서 멈추고 다음에 다시
  });

  it('조회나 계정 삭제 같은 요청은 보관하지 않음', async () => {
    setOnline(false);
    const base = vi.fn(async () => { throw new TypeError('Failed to fetch'); });
    const f = createOfflineFetch(base as unknown as typeof fetch);
    await expect(f(`${BASE}/todos?select=*`, { headers: authHeaders })).rejects.toThrow();
    await expect(f(`${BASE}/rpc/delete_my_account`, { method: 'POST', headers: authHeaders, body: '{}' })).rejects.toThrow();
    expect(pendingFor(USER)).toBe(0);
  });
});
