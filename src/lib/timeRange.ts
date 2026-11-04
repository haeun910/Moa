import { DAY_MINUTES, DEFAULT_BLOCK_MINUTES, parseMinutes } from './timebox';

// 할 일·일정의 시작~끝 시간 (HH:MM). 끝 시간이 없거나 시작보다 이르면 시작부터 1시간으로 봄

// 끝 시각(분). 시작이 없으면 null
export function timeRangeEnd(start: string | null | undefined, end: string | null | undefined): number | null {
  const s = start ? parseMinutes(start) : null;
  if (s === null) return null;
  const e = end ? parseMinutes(end) : null;
  return e !== null && e > s ? Math.min(e, DAY_MINUTES) : Math.min(s + DEFAULT_BLOCK_MINUTES, DAY_MINUTES);
}

// 끝 시간이 시작보다 늦은지 (둘 다 있을 때만 검사)
export function isValidTimeRange(start: string | null | undefined, end: string | null | undefined): boolean {
  if (!end) return true;
  if (!start) return false;
  const s = parseMinutes(start);
  const e = parseMinutes(end);
  return s !== null && e !== null && e > s;
}

// 화면에 보여줄 글자: "10:00" 또는 "10:00~11:30"
export function timeRangeLabel(start: string | null | undefined, end: string | null | undefined): string {
  if (!start) return '';
  return end && isValidTimeRange(start, end) ? `${start}~${end}` : start;
}
