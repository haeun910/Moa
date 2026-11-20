import { createContext, useContext, useEffect, useRef } from 'react';

// 팝업 창을 Esc로 닫기. 창이 여러 겹 떠 있으면 맨 위 창 하나만 닫힘.
// 창 안의 입력칸이 Esc를 따로 쓰는 경우(예: 이름 고치기 취소)에는 그 입력칸에서
// e.preventDefault()를 부르면 창은 닫히지 않음. 한글 조합 중 Esc(조합 취소)도 무시함.
// 미니 창(다른 문서)에 뜬 팝업은 그 창에서 누른 Esc로만 닫힘: 팝업마다 그려진 문서를 기억해 두고,
// Esc를 누른 문서의 맨 위 팝업만 닫음 (본 창의 편집 창이 미니 창 Esc로 닫혀 쓰던 내용이 사라지지 않게)
const stack: { current: () => void; doc: Document | null }[] = [];
let listening = false;

// 팝업이 그려지는 문서. 기본(null)은 본 창이고, 미니 창(MiniTodayHost)은 자기 문서를 넣어 줌
export const EscapeScope = createContext<Document | null>(null);

// 미니 창 문서의 keydown에 붙이는 처리 (MiniTodayHost)
export function handleEscapeKey(e: KeyboardEvent) {
  onKeyDown(e);
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key !== 'Escape' || e.defaultPrevented || e.isComposing) return;
  const pressedIn = (e.currentTarget as Document | null) ?? document;
  for (let i = stack.length - 1; i >= 0; i--) {
    if ((stack[i].doc ?? document) !== pressedIn) continue;
    e.preventDefault();
    stack[i].current();
    return;
  }
}

export function useEscapeKey(onClose: () => void, enabled = true) {
  const doc = useContext(EscapeScope);
  const ref = useRef(onClose);
  ref.current = onClose;
  useEffect(() => {
    if (!enabled) return;
    const entry = { current: () => ref.current(), doc };
    stack.push(entry);
    if (!listening) {
      document.addEventListener('keydown', onKeyDown);
      listening = true;
    }
    return () => {
      const i = stack.lastIndexOf(entry);
      if (i >= 0) stack.splice(i, 1);
    };
  }, [enabled, doc]);
}
