// 화면 아래에 잠깐 뜨는 알림. 어느 파일에서든 showToast()로 띄우고, <Toaster />가 화면에 그림.
export type ToastKind = 'error' | 'success' | 'info';

export interface ToastAction {
  label: string; // 예) 되돌리기
  onClick: () => void;
}

export interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
  action?: ToastAction;
}

type Listener = (toasts: ToastItem[]) => void;

let toasts: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l(toasts);
}

export function subscribeToasts(listener: Listener): () => void {
  listeners.add(listener);
  listener(toasts);
  return () => { listeners.delete(listener); };
}

export function dismissToast(id: number) {
  toasts = toasts.filter(t => t.id !== id);
  emit();
}

export function showToast(message: string, kind: ToastKind = 'info', durationMs = 3500, action?: ToastAction) {
  // 같은 문구가 이미 떠 있으면 또 쌓지 않음 (저장 실패가 연달아 나는 경우 등)
  if (toasts.some(t => t.message === message)) return;
  const id = nextId++;
  toasts = [...toasts.slice(-2), { id, kind, message, action }];
  emit();
  setTimeout(() => dismissToast(id), durationMs);
}

// 추가(create) 실패는 입력 창이 닫히지 않도록 호출한 쪽으로 다시 던지는데, 알림은 이미 띄웠으므로
// 호출한 쪽에서 따로 처리하지 않아도 콘솔에 "처리 안 된 오류"로 또 찍히지 않게 표시해 둠
const HANDLED = Symbol.for('moa.saveErrorHandled');

export function markSaveErrorHandled(err: unknown): unknown {
  if (err && typeof err === 'object') (err as Record<symbol, boolean>)[HANDLED] = true;
  return err;
}

export function isSaveErrorHandled(err: unknown): boolean {
  return !!err && typeof err === 'object' && !!(err as Record<symbol, boolean>)[HANDLED];
}

// 저장(추가/수정/삭제) 실패 시 공통 문구
export function showSaveError() {
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  showToast(
    offline
      ? '인터넷에 연결되어 있지 않아 저장하지 못했어요. 연결 후 다시 시도해주세요.'
      : '저장하지 못했어요. 잠시 후 다시 시도해주세요.',
    'error',
    5000,
  );
}
