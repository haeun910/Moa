// 달력 화면(월·주) 공통 표시 규칙

export const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

// 일요일·공휴일 빨강, 토요일 파랑 (달력 숫자, 요일 머리글 공통)
export function weekdayTone(dow: number) {
  if (dow === 0) return 'text-red-500 dark:text-red-400';
  if (dow === 6) return 'text-blue-500 dark:text-blue-400';
  return 'text-gray-800 dark:text-gray-100';
}
