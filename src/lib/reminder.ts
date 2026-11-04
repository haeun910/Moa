// 할 일·일정 미리 알림에서 고를 수 있는 값 (분 단위, DB의 remind_minutes)
// 시간이 있을 때: 시작 시각 기준 / 시간이 없을 때: 그날 오전 9시 기준 (0 = 당일 9시, 1440 = 전날 9시)
export const TIMED_REMIND_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: '없음' },
  { value: 0, label: '정시' },
  { value: 10, label: '10분 전' },
  { value: 30, label: '30분 전' },
  { value: 60, label: '1시간 전' },
  { value: 1440, label: '하루 전' },
];
export const ALL_DAY_REMIND_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: '없음' },
  { value: 0, label: '당일 오전 9시' },
  { value: 1440, label: '전날 오전 9시' },
];

// 시간을 지웠을 때처럼 지금 고를 수 없는 값이면 가장 가까운 값으로
export function normalizeRemind(value: number | null | undefined, hasTime: boolean): number | null {
  if (value === null || value === undefined) return null;
  if (hasTime) return TIMED_REMIND_OPTIONS.some(o => o.value === value) ? value : 10;
  return value >= 1440 ? 1440 : 0;
}
