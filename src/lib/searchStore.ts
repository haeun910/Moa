// 검색 창 열기: 어느 화면의 버튼에서든 openSearch()를 부르면 Layout의 검색 창이 뜸
type Listener = (open: boolean) => void;

let isOpen = false;
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l(isOpen);
}

export function openSearch() {
  if (isOpen) return;
  isOpen = true;
  emit();
}

export function closeSearch() {
  if (!isOpen) return;
  isOpen = false;
  emit();
}

export function subscribeSearch(listener: Listener): () => void {
  listeners.add(listener);
  listener(isOpen);
  return () => { listeners.delete(listener); };
}
