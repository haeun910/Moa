export type CalendarView = 'month' | 'week' | 'timebox';
const VIEW_KEY = 'calendar-view';

// 달력 화면에서 마지막으로 본 보기(월/주). 타임박스에서 "월"·"주"를 눌러 돌아올 때도 이걸로 고른 보기를 엶
export function savedCalendarView(): 'month' | 'week' {
  try { return localStorage.getItem(VIEW_KEY) === 'week' ? 'week' : 'month'; } catch { return 'month'; }
}
export function saveCalendarView(view: 'month' | 'week') {
  try { localStorage.setItem(VIEW_KEY, view); } catch { /* 기억 못 해도 동작에는 문제 없음 */ }
}

