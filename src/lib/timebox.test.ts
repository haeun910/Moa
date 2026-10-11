import { describe, expect, it } from 'vitest';
import { applySeriesUpdate, getBlockSpan, spanToRange } from './timebox';
import { buildRecurringDates } from './recurrence';
import type { DbTimeBlock } from './supabase';

function row(dateKey: string, startMin: number, endMin: number, extra: Partial<DbTimeBlock> = {}): DbTimeBlock {
  const r = spanToRange(dateKey, startMin, endMin);
  return {
    id: dateKey, user_id: 'u', todo_id: null, title: '운동', color: '#86A03F',
    start_at: r.startAt, end_at: r.endAt, completed: false, remind_minutes: 0,
    notified_at: '2026-10-01T00:00:00Z', created_at: '2026-10-01T00:00:00Z', series_id: 's', ...extra,
  };
}

describe('applySeriesUpdate', () => {
  it('시간을 바꾸면 각 회차의 날짜는 그대로 두고 시각만 바꾼다', () => {
    const rows = [row('2026-10-12', 7 * 60, 8 * 60), row('2026-10-19', 7 * 60, 8 * 60)];
    const next = applySeriesUpdate(rows, { startMin: 6 * 60 + 30, endMin: 7 * 60 });
    expect(next.map(r => getBlockSpan({ startAt: r.start_at, endAt: r.end_at }))).toEqual([
      { dateKey: '2026-10-12', startMin: 390, endMin: 420 },
      { dateKey: '2026-10-19', startMin: 390, endMin: 420 },
    ]);
    expect(next.every(r => r.notified_at === null)).toBe(true); // 새 시간에 다시 알림
  });

  it('제목만 바꾸면 따로 옮겨 둔 회차의 시간과 알림 상태는 그대로', () => {
    const moved = row('2026-10-19', 9 * 60, 10 * 60);
    const [next] = applySeriesUpdate([moved], { title: '헬스', color: '#4F73A8', remindMinutes: 0 });
    expect(next.title).toBe('헬스');
    expect(next.color).toBe('#4F73A8');
    expect(next.start_at).toBe(moved.start_at);
    expect(next.notified_at).toBe(moved.notified_at);
  });
});

describe('매주 고정 블록 날짜', () => {
  it('매주 월·수·금을 1년 동안 만들면 회차가 요일에만 생긴다', () => {
    const dates = buildRecurringDates('2026-10-12', { freq: 'weekly', weekdays: [1, 3, 5], until: '2027-10-12' });
    expect(dates.length).toBe(157);
    expect(dates.every(d => [1, 3, 5].includes(new Date(`${d}T00:00:00`).getDay()))).toBe(true);
  });
});
