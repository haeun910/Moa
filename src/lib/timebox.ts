import { addMinutes, differenceInMinutes, format, parseISO, startOfDay } from 'date-fns';
import type { Category, TimeBlock, Todo } from '../types';
import type { DbTimeBlock } from './supabase';

// 타임박스 화면 공통 계산 (분 단위). 하루 = 0 ~ 1440분, 블록은 같은 날 안에서만 (24:00까지)
export const DAY_MINUTES = 24 * 60;
export const SNAP_MINUTES = 15;
export const DEFAULT_BLOCK_MINUTES = 60;
export const DEFAULT_BLOCK_COLOR = '#86A03F';

// 할 일과 연결 안 된 블록에 고를 수 있는 색 (카테고리 기본 색들과 비슷한 톤)
export const BLOCK_COLORS = ['#86A03F', '#4F73A8', '#7B7FE0', '#C99A3A', '#5FB98A', '#DB7FAE', '#D9705B', '#737A6F'];

export const REMIND_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: '없음' },
  { value: 0, label: '정각' },
  { value: 5, label: '5분 전' },
  { value: 10, label: '10분 전' },
];

export interface BlockSpan {
  dateKey: string; // YYYY-MM-DD (기기 시간대 기준)
  startMin: number;
  endMin: number; // 자정에 끝나면 1440
}

export function getBlockSpan(block: Pick<TimeBlock, 'startAt' | 'endAt'>): BlockSpan {
  const start = parseISO(block.startAt);
  const dayStart = startOfDay(start);
  const startMin = differenceInMinutes(start, dayStart);
  const endMin = Math.min(DAY_MINUTES, differenceInMinutes(parseISO(block.endAt), dayStart));
  return { dateKey: format(start, 'yyyy-MM-dd'), startMin, endMin: Math.max(endMin, startMin + 1) };
}

export function spanToRange(dateKey: string, startMin: number, endMin: number): { startAt: string; endAt: string } {
  const dayStart = startOfDay(parseISO(dateKey));
  return {
    startAt: addMinutes(dayStart, startMin).toISOString(),
    endAt: addMinutes(dayStart, endMin).toISOString(),
  };
}

export function minutesNow(now: Date): number {
  return now.getHours() * 60 + now.getMinutes();
}

export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// "HH:MM" → 분. 끝 시간에 00:00을 고르면 "자정(24:00)"으로 보고 싶을 때 asEnd=true
export function parseMinutes(hhmm: string, asEnd = false): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!match) return null;
  const min = Number(match[1]) * 60 + Number(match[2]);
  if (asEnd && min === 0) return DAY_MINUTES;
  return min;
}

export function snapMinutes(min: number, step = SNAP_MINUTES): number {
  return Math.round(min / step) * step;
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export function durationLabel(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h}시간 ${m}분`;
  if (h) return `${h}시간`;
  return `${m}분`;
}

export function blockTitle(block: TimeBlock, todosById: Map<string, Todo>): string {
  const todo = block.todoId ? todosById.get(block.todoId) : undefined;
  return todo?.title || block.title || '제목 없음';
}

export function blockColor(block: TimeBlock, todosById: Map<string, Todo>, categoriesById: Map<string, Category>): string {
  const todo = block.todoId ? todosById.get(block.todoId) : undefined;
  if (todo?.categoryId) {
    const cat = categoriesById.get(todo.categoryId);
    if (cat) return cat.color;
  }
  return block.color ?? DEFAULT_BLOCK_COLOR;
}

export function blockDone(block: TimeBlock, todosById: Map<string, Todo>): boolean {
  const todo = block.todoId ? todosById.get(block.todoId) : undefined;
  return todo ? todo.completed : block.completed;
}

// 겹치는 블록은 나란히 놓이도록 열(col)을 나눠줌. 서로 겹치는 묶음마다 필요한 열 수(cols)도 함께 계산
export function layoutOverlaps<T extends { id: string; startMin: number; endMin: number }>(items: T[]): Map<string, { col: number; cols: number }> {
  const sorted = [...items].sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);
  const result = new Map<string, { col: number; cols: number }>();
  let cluster: { item: T; col: number }[] = [];
  let clusterEnd = -1;
  let colEnds: number[] = [];

  function flush() {
    const cols = colEnds.length || 1;
    for (const { item, col } of cluster) result.set(item.id, { col, cols });
    cluster = [];
    colEnds = [];
  }

  for (const item of sorted) {
    if (item.startMin >= clusterEnd) {
      flush();
      clusterEnd = -1;
    }
    let col = colEnds.findIndex(end => end <= item.startMin);
    if (col === -1) {
      col = colEnds.length;
      colEnds.push(item.endMin);
    } else {
      colEnds[col] = item.endMin;
    }
    cluster.push({ item, col });
    clusterEnd = Math.max(clusterEnd, item.endMin);
  }
  flush();
  return result;
}

// 그 날에서 fromMin 이후로 duration만큼 비어 있는 첫 시간 (15분 단위). 없으면 fromMin을 그대로 돌려줌
export function findFreeSlot(spans: { startMin: number; endMin: number }[], fromMin: number, duration: number): number {
  const sorted = [...spans].sort((a, b) => a.startMin - b.startMin);
  let candidate = Math.ceil(fromMin / SNAP_MINUTES) * SNAP_MINUTES;
  for (const s of sorted) {
    if (s.endMin <= candidate) continue;
    if (s.startMin >= candidate + duration) break;
    candidate = Math.ceil(s.endMin / SNAP_MINUTES) * SNAP_MINUTES;
  }
  if (candidate + duration > DAY_MINUTES) return clamp(Math.ceil(fromMin / SNAP_MINUTES) * SNAP_MINUTES, 0, DAY_MINUTES - duration);
  return candidate;
}

// 반복 블록 여러 회차에 같은 수정을 적용. 시간(startMin/endMin)을 주면 각 회차의 날짜는 그대로 두고 시각만 바꿈.
// 시각이나 알림 시점이 바뀐 회차는 새 시간에 다시 울리도록 "보냄" 표시를 지움
export function applySeriesUpdate(
  rows: DbTimeBlock[],
  updates: { title?: string; color?: string | null; remindMinutes?: number | null; startMin?: number; endMin?: number },
): DbTimeBlock[] {
  const timeChanged = updates.startMin !== undefined && updates.endMin !== undefined;
  return rows.map(r => {
    const row = { ...r };
    if (updates.title !== undefined) row.title = updates.title;
    if ('color' in updates) row.color = updates.color ?? null;
    if ('remindMinutes' in updates && updates.remindMinutes !== r.remind_minutes) {
      row.remind_minutes = updates.remindMinutes ?? null;
      row.notified_at = null;
    }
    if (timeChanged) {
      const range = spanToRange(getBlockSpan({ startAt: r.start_at, endAt: r.end_at }).dateKey, updates.startMin!, updates.endMin!);
      if (range.startAt !== r.start_at) row.notified_at = null;
      row.start_at = range.startAt;
      row.end_at = range.endAt;
    }
    return row;
  });
}
