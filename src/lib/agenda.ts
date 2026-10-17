import { DAY_MINUTES, DEFAULT_BLOCK_MINUTES, DEFAULT_BLOCK_COLOR, getBlockSpan, parseMinutes } from './timebox';
import type { Category, DDay, ScheduleItem, TimeBlock, Todo } from '../types';

// 타임박스·홈 타임라인에 블록과 함께 보여줄 "다른 기능의 시간 정보"
// - 시간이 정해진 할 일 (그 날 그 할 일에 연결된 블록이 없을 때만. 있으면 블록이 대신 보임)
// - 시간이 정해진 일정 / 시간 없는 일정
// - D-Day (직접 만든 것 + 할 일에서 "D-Day로 표시"한 것)
// 따로 저장하지 않고 원래 데이터에서 그때그때 계산해서, 할 일·일정을 고치면 바로 따라 바뀜

export const SCHEDULE_COLOR = '#4F73A8';
// 할 일·일정은 끝 시간이 없어서 1시간짜리로 보여줌
export const AGENDA_MINUTES = DEFAULT_BLOCK_MINUTES;

export type AgendaTimed =
  | { key: string; kind: 'todo'; startMin: number; endMin: number; title: string; color: string; done: boolean; todo: Todo }
  | { key: string; kind: 'schedule'; startMin: number; endMin: number; title: string; color: string; done: false; schedule: ScheduleItem };

export type AgendaAllDay =
  | { key: string; kind: 'schedule'; title: string; schedule: ScheduleItem }
  | { key: string; kind: 'dday'; title: string; dday: DDay };

export interface DayAgenda {
  timed: AgendaTimed[];
  allDay: AgendaAllDay[];
}

// 할 일에서 "D-Day로 표시"한 것들. 반복 할 일은 회차마다 D-Day가 쌓이지 않게
// 묶음마다 하나만(오늘 이후 가장 가까운 회차, 다 지났으면 마지막 회차) 보여줌
export function todoDdays(todos: Todo[], todayKey: string): DDay[] {
  const single: DDay[] = [];
  const bySeries = new Map<string, DDay>();
  for (const t of todos) {
    const targetDate = t.dueDate || t.date;
    if (!t.isDday || !targetDate) continue;
    const dday: DDay = { id: `todo-${t.id}`, title: t.title, targetDate, fromTodoId: t.id };
    if (!t.seriesId) { single.push(dday); continue; }
    const kept = bySeries.get(t.seriesId);
    if (!kept) { bySeries.set(t.seriesId, dday); continue; }
    const keptUpcoming = kept.targetDate >= todayKey;
    const upcoming = targetDate >= todayKey;
    const better = upcoming
      ? !keptUpcoming || targetDate < kept.targetDate
      : !keptUpcoming && targetDate > kept.targetDate;
    if (better) bySeries.set(t.seriesId, dday);
  }
  return [...single, ...bySeries.values()];
}

export function buildAgenda(
  dateKeys: string[],
  data: { todos: Todo[]; schedules: ScheduleItem[]; ddays: DDay[]; timeblocks: TimeBlock[]; categories: Category[]; todayKey: string },
): Map<string, DayAgenda> {
  const days = new Set(dateKeys);
  const result = new Map<string, DayAgenda>(dateKeys.map(d => [d, { timed: [], allDay: [] }]));
  const categoryColor = new Map(data.categories.map(c => [c.id, c.color]));

  // 이미 블록으로 잡아 둔 할 일(그 날짜)은 블록으로만 보여줌
  const linked = new Set<string>();
  for (const b of data.timeblocks) {
    if (b.todoId) linked.add(`${b.todoId}|${getBlockSpan(b).dateKey}`);
  }

  const timedRange = (hhmm: string | null | undefined) => {
    const start = hhmm ? parseMinutes(hhmm) : null;
    if (start === null || start >= DAY_MINUTES) return null;
    return { startMin: start, endMin: Math.min(DAY_MINUTES, start + AGENDA_MINUTES) };
  };

  for (const todo of data.todos) {
    if (!todo.date || !days.has(todo.date) || linked.has(`${todo.id}|${todo.date}`)) continue;
    const range = timedRange(todo.startTime);
    if (!range) continue;
    result.get(todo.date)!.timed.push({
      key: `todo-${todo.id}`, kind: 'todo', ...range, title: todo.title,
      color: (todo.categoryId && categoryColor.get(todo.categoryId)) || DEFAULT_BLOCK_COLOR,
      done: todo.completed, todo,
    });
  }

  for (const schedule of data.schedules) {
    if (!days.has(schedule.date)) continue;
    const day = result.get(schedule.date)!;
    const range = timedRange(schedule.startTime);
    if (range) day.timed.push({ key: `schedule-${schedule.id}`, kind: 'schedule', ...range, title: schedule.title, color: SCHEDULE_COLOR, done: false, schedule });
    else day.allDay.push({ key: `schedule-${schedule.id}`, kind: 'schedule', title: schedule.title, schedule });
  }

  for (const dday of [...data.ddays, ...todoDdays(data.todos, data.todayKey)]) {
    if (!days.has(dday.targetDate)) continue;
    result.get(dday.targetDate)!.allDay.unshift({ key: `dday-${dday.id}`, kind: 'dday', title: dday.title, dday });
  }

  for (const day of result.values()) day.timed.sort((a, b) => a.startMin - b.startMin);
  return result;
}
