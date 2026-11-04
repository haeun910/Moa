import type { ScheduleItem } from '../types';

// 여러 날에 걸친 일정(시작 날짜 date ~ 끝 날짜 endDate)을 날짜별로 다루는 도우미

export function scheduleEndDate(s: ScheduleItem): string {
  return s.endDate && s.endDate > s.date ? s.endDate : s.date;
}

export function isMultiDay(s: ScheduleItem): boolean {
  return scheduleEndDate(s) !== s.date;
}

// 그 날짜(YYYY-MM-DD)에 걸쳐 있는 일정인지
export function scheduleOnDate(s: ScheduleItem, dateKey: string): boolean {
  return s.date <= dateKey && dateKey <= scheduleEndDate(s);
}

// fromKey~toKey 기간과 하루라도 겹치는지
export function scheduleOverlaps(s: ScheduleItem, fromKey: string, toKey: string): boolean {
  return s.date <= toKey && scheduleEndDate(s) >= fromKey;
}
