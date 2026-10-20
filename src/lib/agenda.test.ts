import { describe, expect, it } from 'vitest';
import { buildAgenda, todoDdays } from './agenda';
import { spanToRange } from './timebox';
import type { Todo, ScheduleItem, DDay, TimeBlock } from '../types';

const todo = (id: string, extra: Partial<Todo>): Todo => ({
  id, title: id, completed: false, categoryId: null, date: null, notes: '', createdAt: '', ...extra,
} as Todo);

describe('buildAgenda', () => {
  const day = '2026-10-17';

  it('시간이 정해진 할 일·일정은 시간표에, 시간 없는 일정·D-Day는 하루 종일 칸에', () => {
    const todos = [
      todo('운동', { date: day, startTime: '19:00' }),
      todo('시간없음', { date: day }),
      todo('다른날', { date: '2026-10-18', startTime: '09:00' }),
      todo('마감', { date: '2026-10-01', dueDate: day, isDday: true }),
    ];
    const schedules: ScheduleItem[] = [
      { id: 's1', title: '회의', date: day, startTime: '10:30', notes: null, createdAt: '', seriesId: null },
      { id: 's2', title: '생일', date: day, startTime: null, notes: null, createdAt: '', seriesId: null },
    ];
    const ddays: DDay[] = [{ id: 'd1', title: '시험', targetDate: day }];
    const agenda = buildAgenda([day], { todos, schedules, ddays, timeblocks: [], categories: [], todayKey: day }).get(day)!;
    expect(agenda.timed.map(t => [t.title, t.startMin, t.endMin])).toEqual([['회의', 630, 690], ['운동', 1140, 1200]]);
    expect(agenda.allDay.map(a => `${a.kind}:${a.title}`).sort()).toEqual(['dday:마감', 'dday:시험', 'schedule:생일']);
  });

  it('그 날 블록으로 잡아 둔 할 일은 중복으로 보이지 않는다', () => {
    const t = todo('운동', { date: day, startTime: '19:00' });
    const block: TimeBlock = {
      id: 'b1', title: '운동', todoId: t.id, color: null, completed: false, remindMinutes: 0, createdAt: '', seriesId: null,
      ...spanToRange(day, 20 * 60, 21 * 60),
    };
    const agenda = buildAgenda([day], { todos: [t], schedules: [], ddays: [], timeblocks: [block], categories: [], todayKey: day }).get(day)!;
    expect(agenda.timed).toEqual([]);
  });

  it('23:30 할 일은 자정까지만 그린다', () => {
    const agenda = buildAgenda([day], { todos: [todo('야식', { date: day, startTime: '23:30' })], schedules: [], ddays: [], timeblocks: [], categories: [], todayKey: day }).get(day)!;
    expect(agenda.timed[0].endMin).toBe(1440);
  });
});

describe('buildAgenda 끝 시간·기간', () => {
  const day = '2026-10-17';
  it('끝 시간이 있으면 그 길이로, 끝이 시작보다 이르면 1시간으로', () => {
    const todos = [todo('공부', { date: day, startTime: '09:00', endTime: '11:30' }), todo('잘못', { date: day, startTime: '13:00', endTime: '12:00' })];
    const schedules: ScheduleItem[] = [{ id: 's1', title: '수업', date: day, startTime: '14:00', endTime: '15:15', notes: null, createdAt: '', seriesId: null }];
    const agenda = buildAgenda([day], { todos, schedules, ddays: [], timeblocks: [], categories: [], todayKey: day }).get(day)!;
    expect(agenda.timed.map(t => [t.title, t.startMin, t.endMin])).toEqual([['공부', 540, 690], ['잘못', 780, 840], ['수업', 840, 915]]);
  });

  it('여러 날 일정은 걸친 날마다 하루 종일 칸에', () => {
    const schedules: ScheduleItem[] = [{ id: 'trip', title: '여행', date: '2026-10-16', endDate: '2026-10-18', startTime: '09:00', notes: null, createdAt: '', seriesId: null }];
    const keys = ['2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18', '2026-10-19'];
    const agenda = buildAgenda(keys, { todos: [], schedules, ddays: [], timeblocks: [], categories: [], todayKey: day });
    expect(keys.map(k => agenda.get(k)!.allDay.length)).toEqual([0, 1, 1, 1, 0]);
    expect(keys.every(k => agenda.get(k)!.timed.length === 0)).toBe(true);
  });
});

describe('todoDdays', () => {
  it('반복 할 일의 D-Day는 묶음마다 다가오는 회차 하나만', () => {
    const series = ['2026-10-10', '2026-10-17', '2026-10-24', '2026-10-31']
      .map(d => todo(`w-${d}`, { date: d, isDday: true, seriesId: 'w' }));
    const past = ['2026-09-01', '2026-09-08'].map(d => todo(`p-${d}`, { date: d, isDday: true, seriesId: 'p' }));
    const result = todoDdays([...series, ...past, todo('단건', { date: '2026-11-01', isDday: true })], '2026-10-17');
    expect(result.map(d => d.targetDate).sort()).toEqual(['2026-09-08', '2026-10-17', '2026-11-01']);
  });
});
