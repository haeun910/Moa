import { addDays, format, getDay, parseISO } from 'date-fns';
import type { DDay, DDayPlan, Todo } from '../types';

// 프로젝트 로드맵(준비 계획): D-Day까지 준비할 일을 남은 날짜에 고르게 나눔

export const PLAN_MAX_ITEMS = 100; // 한 번에 나눌 수 있는 할 일 수
export const PLAN_MAX_PER_DAY_OPTIONS = [1, 2, 3, 4, 5, 6, 8, 10];
const MAX_RANGE_DAYS = 3660; // 10년 넘게 남은 D-Day도 날짜 목록은 여기까지만

export const DEFAULT_PLAN: DDayPlan = { categoryId: null, subcategoryId: null, restDays: [], maxPerDay: null };

const key = (d: Date) => format(d, 'yyyy-MM-dd');

// 준비 기간: 시작일 ~ D-Day 전날. D-Day가 시작일 당일이면 그날 하루. 이미 지난 D-Day면 null
export function planRange(startStr: string, targetStr: string): { from: string; to: string } | null {
  if (targetStr < startStr) return null;
  const dayBefore = key(addDays(parseISO(targetStr), -1));
  return { from: startStr, to: dayBefore < startStr ? targetStr : dayBefore };
}

// 기간 안에서 쉬는 요일을 뺀 날짜들 (yyyy-MM-dd, 오름차순)
export function planDays(from: string, to: string, restDays: number[]): string[] {
  const rest = new Set(restDays);
  const days: string[] = [];
  let d = parseISO(from);
  for (let i = 0; i < MAX_RANGE_DAYS; i++, d = addDays(d, 1)) {
    const k = key(d);
    if (k > to) break;
    if (!rest.has(getDay(d))) days.push(k);
  }
  return days;
}

export type DistributeResult =
  | { ok: true; dates: string[] }
  | { ok: false; reason: 'no-days' }
  | { ok: false; reason: 'too-many'; needed: number };

// n개를 days에 순서대로 고르게 나눔. existing: 날짜별로 이미 잡혀 있는 이 계획의 할 일 수.
// 1) 가장 바쁜 날도 넘지 않는 가장 낮은 "하루 개수"를 찾고(이미 많은 날은 덜 받음)
// 2) 그 개수만큼 날짜별 빈 자리를 늘어놓은 뒤 n개를 같은 간격으로 고름 → 순서는 유지되고 고르게 퍼짐
export function distribute(n: number, days: string[], existing: Record<string, number>, maxPerDay: number | null): DistributeResult {
  if (n <= 0) return { ok: true, dates: [] };
  if (days.length === 0) return { ok: false, reason: 'no-days' };
  const load = days.map(d => existing[d] ?? 0);
  const room = (level: number) => load.reduce((sum, e) => sum + Math.max(0, level - e), 0);
  let level = 1;
  while (room(level) < n) level++;
  if (maxPerDay != null && level > maxPerDay) return { ok: false, reason: 'too-many', needed: level };
  const slots: string[] = [];
  days.forEach((d, j) => { for (let k = load[j]; k < level; k++) slots.push(d); });
  return { ok: true, dates: Array.from({ length: n }, (_, i) => slots[Math.floor((i * slots.length) / n)]) };
}

// 나눈 결과를 한 줄로: "하루 1개씩" / "하루 2~3개"
export function spreadLabel(dates: string[]): string {
  const counts = new Map<string, number>();
  for (const d of dates) counts.set(d, (counts.get(d) ?? 0) + 1);
  const values = [...counts.values()];
  if (values.length === 0) return '';
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  return lo === hi ? `하루 ${hi}개씩` : `하루 ${lo}~${hi}개`;
}

// 적어 둔 글을 줄마다 할 일 하나로 ("- ", "1. ", "• " 같은 목록 표시는 뗌)
export function parsePlanLines(text: string, maxLength: number): string[] {
  return text
    .split(/\r?\n/)
    .map(line => line.replace(/^\s*(?:(?:[-*•·]|\d+[.)])\s+)?(?:\[[\sxX]?\]\s+)?/, '').trim())
    .filter(Boolean)
    .map(line => line.slice(0, maxLength));
}

// 이 D-Day에 연결된 할 일들 (날짜순, 날짜 없는 것은 맨 뒤)
export function planTodos(todos: Todo[], ddayId: string): Todo[] {
  return todos
    .filter(t => t.ddayId === ddayId)
    .sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999')); // 같은 날은 만든 순서 그대로
}

// 아직 남은 일 (끝내지도, 안 하기로 하지도 않은 것)
export const isOpenPlanTodo = (t: Todo) => !t.completed && !t.skipped;

// 날짜별로 이미 잡혀 있는 남은 일 수
export function openLoadByDate(list: Todo[]): Record<string, number> {
  const load: Record<string, number> = {};
  for (const t of list) if (t.date && isOpenPlanTodo(t)) load[t.date] = (load[t.date] ?? 0) + 1;
  return load;
}

// 진행 상황: 안 하기로 한 일은 전체에서 뺌
export function planProgress(list: Todo[]): { done: number; total: number } {
  const counted = list.filter(t => !t.skipped);
  return { done: counted.filter(t => t.completed).length, total: counted.length };
}

// 준비 계획을 세울 수 있는 D-Day: 직접 만든 것(할 일에서 연동된 가상 D-Day 제외)
export const isPlannableDDay = (d: DDay) => !d.fromTodoId;

// D-Day 이름에 하위 카테고리 이름이 들어 있으면 그걸 먼저 골라 둠 ("토익 시험" → 자격증 > 토익)
export function guessSubcategory<S extends { id: string; categoryId: string; name: string }>(title: string, subcategories: S[]): S | undefined {
  const t = title.replace(/\s/g, '').toLowerCase();
  return [...subcategories]
    .filter(s => s.name.trim().length > 0 && t.includes(s.name.replace(/\s/g, '').toLowerCase()))
    .sort((a, b) => b.name.length - a.name.length)[0];
}
