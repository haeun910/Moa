// 다른 화면(홈)에서 메모를 눌렀을 때 메모 화면이 그 메모를 바로 열 수 있게 id를 잠깐 맡겨 둠
const KEY = 'moa-open-note';

export function requestOpenNote(id: string) {
  try { sessionStorage.setItem(KEY, id); } catch { /* 못 맡겨도 메모 화면은 열림 */ }
}

export function peekRequestedNote(): string | null {
  try { return sessionStorage.getItem(KEY); } catch { return null; }
}

export function clearRequestedNote() {
  try { sessionStorage.removeItem(KEY); } catch { /* 무시 */ }
}
