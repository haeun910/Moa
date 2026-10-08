import { describe, expect, it } from 'vitest';
import { buildRecurringDates, REPEAT_MAX_OCCURRENCES } from './recurrence';

describe('buildRecurringDates', () => {
  it('매일: 시작일과 종료일을 포함한다', () => {
    expect(buildRecurringDates('2026-10-01', { freq: 'daily', weekdays: [], until: '2026-10-03' }))
      .toEqual(['2026-10-01', '2026-10-02', '2026-10-03']);
  });

  it('종료일을 멀리 잡아도 최대 횟수까지만 만든다', () => {
    const dates = buildRecurringDates('2026-01-01', { freq: 'daily', weekdays: [], until: '2030-12-31' });
    expect(dates).toHaveLength(REPEAT_MAX_OCCURRENCES);
  });

  it('매월 31일: 짧은 달엔 말일로, 다음 달엔 다시 31일로', () => {
    expect(buildRecurringDates('2026-01-31', { freq: 'monthly', weekdays: [], until: '2026-04-30' }))
      .toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
  });

  it('격주 월·수', () => {
    // 2026-10-05는 월요일
    expect(buildRecurringDates('2026-10-05', { freq: 'biweekly', weekdays: [1, 3], until: '2026-10-25' }))
      .toEqual(['2026-10-05', '2026-10-07', '2026-10-19', '2026-10-21']);
  });

  it('반복 안 함이면 빈 목록', () => {
    expect(buildRecurringDates('2026-10-05', { freq: 'none', weekdays: [], until: '2026-10-25' })).toEqual([]);
  });
});
