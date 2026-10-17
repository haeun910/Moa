import { addDays, differenceInCalendarDays, format, parseISO, startOfWeek } from 'date-fns';
import { getBlockSpan, parseMinutes } from './timebox';
import type { ScheduleItem, TimeBlock, Todo } from '../types';

// 홈 화면 요약 카드에 쓰는 숫자들. 따로 저장하지 않고 할 일·일정·타임박스에서 그때그때 계산.
// 할 일에는 "언제 완료했는지"가 없어서, 달성 관련 숫자는 모두 할 일의 날짜(date) 기준.

const key = (d: Date) => format(d, 'yyyy-MM-dd');

export interface Progress { total: number; done: number }

export function rate(p: Progress): number | null {
  return p.total > 0 ? Math.round((p.done / p.total) * 100) : null;
}

export function dayProgress(todos: Todo[], dateKey: string): Progress {
  const day = todos.filter(t => t.date === dateKey);
  return { total: day.length, done: day.filter(t => t.completed).length };
}

function rangeProgress(todos: Todo[], fromKey: string, toKey: string): Progress {
  const inRange = todos.filter(t => t.date && t.date >= fromKey && t.date <= toKey);
  return { total: inRange.length, done: inRange.filter(t => t.completed).length };
}

// 하루에 1개 이상 완료한 날이 며칠 연속인지. 오늘 아직 하나도 못 끝냈으면 어제부터 셈
// (아침에 열자마자 0일로 끊겨 보이지 않게)
export function completionStreak(todos: Todo[], today: Date, maxDays = 365): number {
  const doneDays = new Set(todos.filter(t => t.completed && t.date).map(t => t.date as string));
  let cursor = doneDays.has(key(today)) ? today : addDays(today, -1);
  let streak = 0;
  while (streak < maxDays && doneDays.has(key(cursor))) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

// 이번 주(일요일~오늘)와 지난주 같은 요일까지의 달성률. 지난주는 같은 일수만 비교해야 공평함
export function weekComparison(todos: Todo[], today: Date): { thisWeek: Progress; lastWeek: Progress } {
  const weekStart = startOfWeek(today, { weekStartsOn: 0 });
  const elapsed = differenceInCalendarDays(today, weekStart);
  const lastStart = addDays(weekStart, -7);
  return {
    thisWeek: rangeProgress(todos, key(weekStart), key(today)),
    lastWeek: rangeProgress(todos, key(lastStart), key(addDays(lastStart, elapsed))),
  };
}

// 지난 날짜에 잡혀 있는데 아직 못 끝낸 할 일
export function overdueTodos(todos: Todo[], todayKey: string): Todo[] {
  return todos.filter(t => t.date && t.date < todayKey && !t.completed);
}

// 마감일이 오늘부터 days일 안에 있는 미완료 할 일 (마감일 가까운 순)
export function dueSoonTodos(todos: Todo[], today: Date, days = 3): Todo[] {
  const from = key(today);
  const to = key(addDays(today, days));
  return todos
    .filter(t => !t.completed && t.dueDate && t.dueDate >= from && t.dueDate <= to)
    .sort((a, b) => (a.dueDate as string).localeCompare(b.dueDate as string));
}

// 오늘 타임박스에 잡아 둔 시간과 그중 완료한 시간 (분)
export function timeboxMinutes(blocks: TimeBlock[], todayKey: string, isDone: (b: TimeBlock) => boolean): { planned: number; done: number } {
  let planned = 0;
  let done = 0;
  for (const b of blocks) {
    const span = getBlockSpan(b);
    if (span.dateKey !== todayKey) continue;
    const len = span.endMin - span.startMin;
    planned += len;
    if (isDone(b)) done += len;
  }
  return { planned, done };
}

// 지금 이후 가장 가까운 일정 (오늘 남은 시간 일정 → 그 뒤 날짜 순). 시간 없는 오늘 일정은 "다음"으로 치지 않음
export function nextSchedule(schedules: ScheduleItem[], now: Date, withinDays = 7): ScheduleItem | null {
  const todayKey = key(now);
  const lastKey = key(addDays(now, withinDays));
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const sortMin = (s: ScheduleItem) => (s.startTime ? parseMinutes(s.startTime) ?? -1 : -1);
  const candidates = schedules.filter(s => {
    if (s.date > lastKey || s.date < todayKey) return false;
    if (s.date > todayKey) return true;
    const m = s.startTime ? parseMinutes(s.startTime) : null;
    return m !== null && m >= nowMin;
  });
  candidates.sort((a, b) => a.date.localeCompare(b.date) || sortMin(a) - sortMin(b));
  return candidates[0] ?? null;
}

export function daysUntil(dateKey: string, today: Date): number {
  return differenceInCalendarDays(parseISO(dateKey), today);
}
