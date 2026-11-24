// 달력의 "할 일 배치": 날짜 칸으로 옮길 수 있는 할 일 목록과, 다른 화면(저장소)에서 배치 창을 열어 달라는 요청
import { overdueTodos } from './homeStats';
import type { Todo } from '../types';

export type PlanTab = 'storage' | 'overdue';

// 저장소(날짜 없는 할 일)와 밀린 할 일 중 달력에 옮길 수 있는 것.
// - 반복 할 일은 뺌: 한 회차만 다른 날로 옮기면 반복 규칙과 어긋남 (밀린 일 창에서 따로 정리)
// - 설정에서 숨긴 카테고리는 뺌: 옮겨도 달력 칸에 안 보여서 "안 옮겨진 것"처럼 보임
// 밀린 할 일은 오래된 것부터 (홈·밀린 일 창과 같은 기준: 끝냈거나 '안 하기'한 것은 빠짐)
export function placementLists(todos: Todo[], todayKey: string, hiddenCategoryIds: string[]) {
  const shown = (t: Todo) => !t.categoryId || !hiddenCategoryIds.includes(t.categoryId);
  const storage = todos.filter(t => !t.date && !t.completed && !t.skipped && !t.seriesId && shown(t));
  const allOverdue = overdueTodos(todos, todayKey).filter(shown);
  const overdue = allOverdue
    .filter(t => !t.seriesId)
    .sort((a, b) => (a.date as string).localeCompare(b.date as string));
  return { storage, overdue, recurringOverdue: allOverdue.length - overdue.length };
}

const REQUEST_KEY = 'moa-open-plan';

// 저장소 화면의 "달력에 배치하기": 달력 화면이 열릴 때 배치 창을 그 탭으로 열어 달라고 남겨 둠
export function requestPlanPanel(tab: PlanTab) {
  try { sessionStorage.setItem(REQUEST_KEY, tab); } catch { /* 못 남겨도 달력은 열림 */ }
}
export function peekPlanRequest(): PlanTab | null {
  try {
    const v = sessionStorage.getItem(REQUEST_KEY);
    return v === 'storage' || v === 'overdue' ? v : null;
  } catch { return null; }
}
export function clearPlanRequest() {
  try { sessionStorage.removeItem(REQUEST_KEY); } catch { /* 무시 */ }
}
