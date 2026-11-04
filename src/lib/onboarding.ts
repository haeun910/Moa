// 첫 사용 안내를 이미 봤는지 (기기별로 기억. 저장이 막힌 환경이면 "봤다"로 취급해 매번 뜨지 않게 함)
const key = (userId: string) => `onboarding-done-${userId}`;

export function hasSeenOnboarding(userId: string): boolean {
  try { return localStorage.getItem(key(userId)) === '1'; } catch { return true; }
}

export function markOnboardingSeen(userId: string) {
  try { localStorage.setItem(key(userId), '1'); } catch { /* 무시 */ }
}
