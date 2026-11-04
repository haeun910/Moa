import { useEffect, useRef } from 'react';

// 팝업 창을 Esc로 닫기. 창이 여러 겹 떠 있으면 맨 위 창 하나만 닫힘.
// 창 안의 입력칸이 Esc를 따로 쓰는 경우(예: 이름 고치기 취소)에는 그 입력칸에서
// e.preventDefault()를 부르면 창은 닫히지 않음. 한글 조합 중 Esc(조합 취소)도 무시함.
const stack: { current: () => void }[] = [];
let listening = false;

function onKeyDown(e: KeyboardEvent) {
  if (e.key !== 'Escape' || e.defaultPrevented || e.isComposing) return;
  const top = stack[stack.length - 1];
  if (!top) return;
  e.preventDefault();
  top.current();
}

export function useEscapeKey(onClose: () => void, enabled = true) {
  const ref = useRef(onClose);
  ref.current = onClose;
  useEffect(() => {
    if (!enabled) return;
    const entry = { current: () => ref.current() };
    stack.push(entry);
    if (!listening) {
      document.addEventListener('keydown', onKeyDown);
      listening = true;
    }
    return () => {
      const i = stack.lastIndexOf(entry);
      if (i >= 0) stack.splice(i, 1);
    };
  }, [enabled]);
}
