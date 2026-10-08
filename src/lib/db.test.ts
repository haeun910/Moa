import { describe, expect, it, vi, beforeEach } from 'vitest';

// supabase 클라이언트 흉내: rpc / from(...).update(...).eq(...) 호출을 기록
const rpc = vi.fn();
const updates: { table: string; values: unknown; id: string }[] = [];
vi.mock('./supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpc(...args),
    from: (table: string) => ({
      update: (values: unknown) => ({
        eq: async (_col: string, id: string) => { updates.push({ table, values, id }); return { error: null }; },
      }),
    }),
  },
}));

const { fetchAllPages, PAGE_SIZE, reorderItems } = await import('./db');

describe('fetchAllPages', () => {
  it('1,000줄이 넘어도 끝까지 이어서 가져온다', async () => {
    const total = PAGE_SIZE * 2 + 37;
    const rows = Array.from({ length: total }, (_, i) => i);
    const ranges: [number, number][] = [];
    const result = await fetchAllPages<number>(async (from, to) => {
      ranges.push([from, to]);
      return { data: rows.slice(from, to + 1), error: null };
    });
    expect(result).toEqual(rows);
    expect(ranges).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });

  it('딱 1,000줄이면 빈 페이지를 한 번 더 확인하고 끝낸다', async () => {
    const page = vi.fn(async (from: number) => ({ data: from === 0 ? Array(PAGE_SIZE).fill(1) : [], error: null }));
    const result = await fetchAllPages<number>(page);
    expect(result).toHaveLength(PAGE_SIZE);
    expect(page).toHaveBeenCalledTimes(2);
  });

  it('적으면 요청 한 번으로 끝낸다', async () => {
    const page = vi.fn(async () => ({ data: [1, 2, 3], error: null }));
    expect(await fetchAllPages<number>(page)).toEqual([1, 2, 3]);
    expect(page).toHaveBeenCalledTimes(1);
  });

  it('중간에 실패하면 일부만 돌려주지 않고 오류를 던진다', async () => {
    const boom = new Error('network');
    await expect(fetchAllPages<number>(async from => (
      from === 0 ? { data: Array(PAGE_SIZE).fill(1), error: null } : { data: null, error: boom }
    ))).rejects.toBe(boom);
  });
});

describe('reorderItems', () => {
  beforeEach(() => { rpc.mockReset(); updates.length = 0; });

  it('요청 한 번(reorder_items)으로 저장한다', async () => {
    rpc.mockResolvedValue({ error: null });
    await reorderItems('todos', ['a', 'b', 'c']);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('reorder_items', { p_table: 'todos', p_ids: ['a', 'b', 'c'] });
    expect(updates).toHaveLength(0);
  });

  it('018 마이그레이션 전 DB면 예전처럼 한 줄씩 저장한다', async () => {
    rpc.mockResolvedValue({ error: { code: 'PGRST202', message: 'Could not find the function public.reorder_items' } });
    await reorderItems('categories', ['x', 'y']);
    expect(updates).toEqual([
      { table: 'categories', values: { sort_order: 0 }, id: 'x' },
      { table: 'categories', values: { sort_order: 1 }, id: 'y' },
    ]);
  });

  it('다른 오류는 그대로 던진다', async () => {
    const err = { code: '42501', message: 'permission denied' };
    rpc.mockResolvedValue({ error: err });
    await expect(reorderItems('todos', ['a'])).rejects.toBe(err);
  });
});
