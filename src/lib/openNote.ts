// 다른 화면(홈)에서 메모를 눌렀을 때 메모 화면이 그 메모를 바로 열 수 있게 id를 잠깐 맡겨 둠
const KEY = 'moa-open-note';

// 메모 화면이 이미 떠 있을 때(검색에서 메모를 고른 경우 등)는 이 알림을 듣고 바로 엶
export const OPEN_NOTE_EVENT = 'moa-open-note';

export function requestOpenNote(id: string) {
  try { sessionStorage.setItem(KEY, id); } catch { /* 못 맡겨도 메모 화면은 열림 */ }
  window.dispatchEvent(new CustomEvent<string>(OPEN_NOTE_EVENT, { detail: id }));
}

export function peekRequestedNote(): string | null {
  try { return sessionStorage.getItem(KEY); } catch { return null; }
}

export function clearRequestedNote() {
  try { sessionStorage.removeItem(KEY); } catch { /* 무시 */ }
}
