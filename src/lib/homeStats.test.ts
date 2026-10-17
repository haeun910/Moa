import { describe, expect, it } from 'vitest';
import { completionStreak, dayProgress, dueSoonTodos, nextSchedule, overdueTodos, rate, timeboxMinutes, weekComparison } from './homeStats';
import { spanToRange } from './timebox';
import type { ScheduleItem, TimeBlock, Todo } from '../types';

const todo = (id: string, extra: Partial<Todo>): Todo => ({
  id, title: id, completed: false, categoryId: null, subcategoryId: null, date: null, createdAt: '', ...extra,
});
const schedule = (id: string, date: string, startTime: string | null = null): ScheduleItem => ({
  id, title: id, date, startTime, createdAt: '',
});

// 2026-10-17은 토요일
const today = new Date(2026, 9, 17, 10, 30);

describe('dayProgress / rate', () => {
  it('그 날 할 일 중 완료 개수', () => {
    const todos = [todo('a', { date: '2026-10-17', completed: true }), todo('b', { date: '2026-10-17' }), todo('c', { date: '2026-10-16', completed: true })];
    const p = dayProgress(todos, '2026-10-17');
    expect(p).toEqual({ total: 2, done: 1 });
    expect(rate(p)).toBe(50);
    expect(rate({ total: 0, done: 0 })).toBeNull();
  });
});

describe('completionStreak', () => {
  it('오늘 완료가 있으면 오늘부터, 없으면 어제부터 연속 일수', () => {
    const base = [
      todo('15', { date: '2026-10-15', completed: true }),
      todo('16', { date: '2026-10-16', completed: true }),
      todo('14x', { date: '2026-10-14' }),
    ];
    expect(completionStreak(base, today)).toBe(2);
    expect(completionStreak([...base, todo('17', { date: '2026-10-17', completed: true })], today)).toBe(3);
    expect(completionStreak([todo('15', { date: '2026-10-15', completed: true })], today)).toBe(0);
  });
});

describe('weekComparison', () => {
  it('이번 주 일요일~오늘, 지난주는 같은 요일까지만', () => {
    const todos = [
      todo('this', { date: '2026-10-11', completed: true }),
      todo('this2', { date: '2026-10-17' }),
      todo('future', { date: '2026-10-18' }),
      todo('last', { date: '2026-10-04', completed: true }),
      todo('last2', { date: '2026-10-10', completed: true }),
      todo('old', { date: '2026-10-03' }),
    ];
    const { thisWeek, lastWeek } = weekComparison(todos, today);
    expect(thisWeek).toEqual({ total: 2, done: 1 });
    expect(lastWeek).toEqual({ total: 2, done: 2 });
  });
});

describe('overdue / dueSoon', () => {
  it('지난 미완료, 3일 안 마감', () => {
    const todos = [
      todo('late', { date: '2026-10-10' }),
      todo('lateDone', { date: '2026-10-10', completed: true }),
      todo('due19', { dueDate: '2026-10-19' }),
      todo('due17', { dueDate: '2026-10-17' }),
      todo('due25', { dueDate: '2026-10-25' }),
      todo('dueDone', { dueDate: '2026-10-18', completed: true }),
    ];
    expect(overdueTodos(todos, '2026-10-17').map(t => t.id)).toEqual(['late']);
    expect(dueSoonTodos(todos, today).map(t => t.id)).toEqual(['due17', 'due19']);
  });
});

describe('timeboxMinutes', () => {
  it('오늘 블록만, 완료한 시간 따로', () => {
    const block = (id: string, dateKey: string, s: number, e: number, completed: boolean): TimeBlock => ({
      id, title: id, todoId: null, color: null, ...spanToRange(dateKey, s, e), completed, remindMinutes: null, createdAt: '', seriesId: null,
    });
    const blocks = [block('a', '2026-10-17', 540, 660, true), block('b', '2026-10-17', 780, 840, false), block('c', '2026-10-16', 0, 60, true)];
    expect(timeboxMinutes(blocks, '2026-10-17', b => b.completed)).toEqual({ planned: 180, done: 120 });
  });
});

describe('nextSchedule', () => {
  it('오늘 남은 시간 일정이 먼저, 지난 시간·시간 없는 오늘 일정은 제외', () => {
    const list = [
      schedule('past', '2026-10-17', '09:00'),
      schedule('allday', '2026-10-17'),
      schedule('tomorrow', '2026-10-18', '08:00'),
      schedule('later', '2026-10-17', '14:00'),
    ];
    expect(nextSchedule(list, today)?.id).toBe('later');
    expect(nextSchedule(list.filter(s => s.id !== 'later'), today)?.id).toBe('tomorrow');
    expect(nextSchedule([schedule('far', '2026-11-30')], today)).toBeNull();
  });
});
