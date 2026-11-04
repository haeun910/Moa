import { addDays, addMonths, addWeeks, differenceInCalendarWeeks, format, isAfter, parseISO } from 'date-fns';

// 반복 규칙. 반복은 "규칙"을 저장하는 방식이 아니라 종료일까지의 각 회차를 실제 항목으로
// 미리 만들어 두는 방식이고, 같은 반복으로 만든 항목들은 seriesId로 묶임.
export type RepeatFreq = 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly';

export interface RepeatRule {
  freq: RepeatFreq;
  weekdays: number[]; // 매주/격주일 때 반복할 요일 (0=일 ~ 6=토)
  until: string; // 종료일 YYYY-MM-DD (이 날짜 포함)
}

// 종료일을 너무 멀리 잡아도 한 번에 너무 많이 만들어지지 않도록 하는 안전장치 (매일 반복 기준 약 1년)
export const REPEAT_MAX_OCCURRENCES = 366;

export const REPEAT_FREQ_OPTIONS: [RepeatFreq, string][] = [
  ['none', '반복 안 함'],
  ['daily', '매일'],
  ['weekly', '매주'],
  ['biweekly', '격주'],
  ['monthly', '매월'],
];

// 시작일부터 종료일까지 규칙에 맞는 날짜 목록 (시작일이 포함되지 않는 요일이면 그 다음 해당 요일부터)
export function buildRecurringDates(startDate: string, rule: RepeatRule): string[] {
  if (rule.freq === 'none' || !startDate || !rule.until) return [];
  const start = parseISO(startDate);
  const until = parseISO(rule.until);
  const dates: string[] = [];
  const push = (d: Date) => dates.push(format(d, 'yyyy-MM-dd'));

  if (rule.freq === 'daily') {
    for (let d = start; !isAfter(d, until) && dates.length < REPEAT_MAX_OCCURRENCES; d = addDays(d, 1)) push(d);
  } else if (rule.freq === 'monthly') {
    // 시작일 기준으로 i개월씩 더해서 31일 → 30일처럼 짧은 달에 한 번 당겨져도 다음 달엔 다시 31일로 돌아옴
    for (let i = 0; dates.length < REPEAT_MAX_OCCURRENCES; i++) {
      const d = addMonths(start, i);
      if (isAfter(d, until)) break;
      push(d);
    }
  } else {
    const weekdays = rule.weekdays.length > 0 ? rule.weekdays : [start.getDay()];
    const step = rule.freq === 'biweekly' ? 2 : 1;
    for (let d = start; !isAfter(d, until) && dates.length < REPEAT_MAX_OCCURRENCES; d = addDays(d, 1)) {
      if (!weekdays.includes(d.getDay())) continue;
      // 격주: 시작일이 속한 주를 기준으로 짝수 번째 주만
      if (step === 2 && differenceInCalendarWeeks(d, start) % 2 !== 0) continue;
      push(d);
    }
  }
  return dates;
}

// 종료일 기본값: 매일은 한 달, 매주/격주는 석 달, 매월은 1년 뒤
export function defaultRepeatUntil(startDate: string, freq: RepeatFreq): string {
  const start = parseISO(startDate);
  const until = freq === 'daily' ? addMonths(start, 1)
    : freq === 'monthly' ? addMonths(start, 12)
    : addWeeks(start, 13);
  return format(until, 'yyyy-MM-dd');
}

export function newSeriesId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  // randomUUID가 없는 환경(구형 브라우저, http 접속)용 대체 UUID v4
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
