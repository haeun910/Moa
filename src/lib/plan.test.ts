import { describe, expect, it } from 'vitest';
import { distribute, guessSubcategory, openLoadByDate, parsePlanLines, planDays, planProgress, planRange, planTodos, spreadLabel } from './plan';
import type { Todo } from '../types';

const todo = (id: string, extra: Partial<Todo>): Todo => ({
  id, title: id, completed: false, categoryId: null, subcategoryId: null, date: null, createdAt: '', ...extra,
});

describe('planRange', () => {
  it('시작일부터 D-Day 전날까지', () => {
    expect(planRange('2026-11-05', '2026-11-20')).toEqual({ from: '2026-11-05', to: '2026-11-19' });
  });
  it('D-Day가 오늘이면 오늘 하루', () => {
    expect(planRange('2026-11-05', '2026-11-05')).toEqual({ from: '2026-11-05', to: '2026-11-05' });
  });
  it('D-Day가 내일이면 오늘 하루', () => {
    expect(planRange('2026-11-05', '2026-11-06')).toEqual({ from: '2026-11-05', to: '2026-11-05' });
  });
  it('지난 D-Day는 null', () => {
    expect(planRange('2026-11-05', '2026-11-04')).toBeNull();
  });
});

describe('planDays', () => {
  it('쉬는 요일을 뺌 (2026-11-08은 일요일)', () => {
    expect(planDays('2026-11-06', '2026-11-10', [0, 6])).toEqual(['2026-11-06', '2026-11-09', '2026-11-10']);
  });
  it('월이 바뀌어도 이어짐', () => {
    expect(planDays('2026-11-29', '2026-12-02', [])).toEqual(['2026-11-29', '2026-11-30', '2026-12-01', '2026-12-02']);
  });
  it('모든 요일을 쉬면 빈 목록', () => {
    expect(planDays('2026-11-01', '2026-11-30', [0, 1, 2, 3, 4, 5, 6])).toEqual([]);
  });
});

const days = (n: number) => Array.from({ length: n }, (_, i) => `d${String(i).padStart(2, '0')}`);

describe('distribute', () => {
  it('날이 더 많으면 같은 간격으로 하루 하나씩', () => {
    const r = distribute(3, days(30), {}, null);
    expect(r).toEqual({ ok: true, dates: ['d00', 'd10', 'd20'] });
  });
  it('할 일이 더 많으면 하루에 여러 개, 차이는 최대 1개', () => {
    const r = distribute(7, days(3), {}, null);
    if (!r.ok) throw new Error('fail');
    const counts = days(3).map(d => r.dates.filter(x => x === d).length);
    expect(counts.reduce((a, b) => a + b)).toBe(7);
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
  });
  it('적은 순서가 날짜 순서로 유지됨', () => {
    const r = distribute(25, days(10), {}, null);
    if (!r.ok) throw new Error('fail');
    expect([...r.dates].sort()).toEqual(r.dates);
  });
  it('이미 잡힌 날은 덜 받음', () => {
    const r = distribute(2, days(3), { d00: 1, d01: 1 }, null);
    if (!r.ok) throw new Error('fail');
    expect(r.dates).toHaveLength(2);
    expect(r.dates).toContain('d02');
    const total = (d: string) => (({ d00: 1, d01: 1 } as Record<string, number>)[d] ?? 0) + r.dates.filter(x => x === d).length;
    expect(Math.max(total('d00'), total('d01'), total('d02'))).toBe(2);
  });
  it('하루 최대를 넘으면 실패하고 필요한 개수를 알려줌', () => {
    expect(distribute(7, days(3), {}, 2)).toEqual({ ok: false, reason: 'too-many', needed: 3 });
  });
  it('하루 최대 안이면 지킴', () => {
    const r = distribute(6, days(3), {}, 2);
    expect(r).toEqual({ ok: true, dates: ['d00', 'd00', 'd01', 'd01', 'd02', 'd02'] });
  });
  it('날이 없으면 실패', () => {
    expect(distribute(1, [], {}, null)).toEqual({ ok: false, reason: 'no-days' });
  });
  it('0개면 빈 결과', () => {
    expect(distribute(0, [], {}, null)).toEqual({ ok: true, dates: [] });
  });
});

describe('spreadLabel', () => {
  it('하루 개수 범위', () => {
    expect(spreadLabel(['a', 'b'])).toBe('하루 1개씩');
    expect(spreadLabel(['a', 'a', 'b'])).toBe('하루 1~2개');
  });
});

describe('parsePlanLines', () => {
  it('줄마다 하나, 빈 줄과 목록 표시는 뺌', () => {
    expect(parsePlanLines('- 단어 1\n\n2. 단어 2\n• LC 파트1\n  [ ] 모의고사 \n- [x] 오답노트', 500))
      .toEqual(['단어 1', '단어 2', 'LC 파트1', '모의고사', '오답노트']);
  });
  it('너무 긴 줄은 자름', () => {
    expect(parsePlanLines('가'.repeat(10), 4)).toEqual(['가가가가']);
  });
  it('숫자로 시작하는 제목은 그대로 (점이 없으면)', () => {
    expect(parsePlanLines('3회 모의고사', 500)).toEqual(['3회 모의고사']);
  });
});

describe('planTodos / progress', () => {
  const list = [
    todo('b', { ddayId: 'x', date: '2026-11-07', completed: true }),
    todo('a', { ddayId: 'x', date: '2026-11-06' }),
    todo('c', { ddayId: 'x', date: null }),
    todo('d', { ddayId: 'x', date: '2026-11-06', skipped: true }),
    todo('e', { ddayId: 'y', date: '2026-11-06' }),
  ];
  it('이 D-Day 것만 날짜순, 날짜 없는 것은 끝', () => {
    expect(planTodos(list, 'x').map(t => t.id)).toEqual(['a', 'd', 'b', 'c']);
  });
  it('남은 일 수는 끝냈거나 안 하기로 한 것 제외', () => {
    expect(openLoadByDate(planTodos(list, 'x'))).toEqual({ '2026-11-06': 1 });
  });
  it('진행률은 안 하기를 뺌', () => {
    expect(planProgress(planTodos(list, 'x'))).toEqual({ done: 1, total: 3 });
  });
});

describe('guessSubcategory', () => {
  const subs = [
    { id: '1', categoryId: 'c', name: '토익' },
    { id: '2', categoryId: 'c', name: '토익 스피킹' },
    { id: '3', categoryId: 'c', name: '' },
  ];
  it('이름이 들어 있는 하위 카테고리, 더 긴 이름 먼저', () => {
    expect(guessSubcategory('11월 토익 시험', subs)?.id).toBe('1');
    expect(guessSubcategory('토익스피킹 시험', subs)?.id).toBe('2');
    expect(guessSubcategory('정보처리기사', subs)).toBeUndefined();
  });
});
