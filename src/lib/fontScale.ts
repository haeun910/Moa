import type { Settings } from '../types';

// 설정 > 글자 크기: 앱 전체 글자에 곱하는 배율 (tailwind.config.js의 --fs)
export const FONT_SCALE: Record<Settings['calendarTextSize'], number> = { small: 0.9, medium: 1, large: 1.15 };
const STORAGE_KEY = 'moa-text-size';

export function applyFontScale(size: Settings['calendarTextSize']) {
  document.documentElement.style.setProperty('--fs', String(FONT_SCALE[size] ?? 1));
  // 다음에 앱을 열 때 설정을 불러오기 전에도 같은 크기로 그리도록 기억해 둠
  try { localStorage.setItem(STORAGE_KEY, size); } catch { /* 저장 못 해도 지금 화면에는 적용됨 */ }
}

// 앱이 뜨자마자(설정을 서버에서 받기 전) 지난번 글자 크기로 시작
export function applySavedFontScale() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && saved in FONT_SCALE) document.documentElement.style.setProperty('--fs', String(FONT_SCALE[saved as Settings['calendarTextSize']]));
  } catch { /* 기본 크기로 시작 */ }
}
