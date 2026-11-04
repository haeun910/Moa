import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, WifiOff, X, RefreshCw } from 'lucide-react';
import { drainOutbox, getOutboxState, subscribeOutbox } from '../lib/outbox';
import type { OutboxState } from '../lib/outbox';
import { subscribeToasts, dismissToast } from '../lib/toast';
import type { ToastItem } from '../lib/toast';

const STYLES: Record<ToastItem['kind'], { box: string; Icon: typeof Info }> = {
  error: { box: 'bg-red-600 text-white', Icon: AlertCircle },
  success: { box: 'bg-leaf-600 text-white', Icon: CheckCircle2 },
  info: { box: 'bg-gray-900 text-white dark:bg-white dark:text-gray-900', Icon: Info },
};

// 화면 아래(하단 탭 위)에 알림을 띄우고, 인터넷이 끊겼거나 아직 보내지 못한 변경이 있으면 위쪽에 안내 띠를 보여줌
export default function Toaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [net, setNet] = useState<OutboxState>(getOutboxState);

  useEffect(() => subscribeToasts(setToasts), []);
  useEffect(() => subscribeOutbox(setNet), []);

  const strip = !net.online ? 'offline' : net.pending > 0 ? 'pending' : null;
  const stripRef = useRef<HTMLDivElement>(null);

  // 위쪽 안내 띠가 화면 맨 위 버튼을 가리지 않게, 띠 높이만큼 화면 전체를 아래로 내림 (--strip-h: tailwind h-screen·index.css에서 사용)
  useLayoutEffect(() => {
    const root = document.documentElement;
    const el = stripRef.current;
    if (!el) { root.style.removeProperty('--strip-h'); return; }
    const apply = () => root.style.setProperty('--strip-h', `${el.offsetHeight}px`);
    apply();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(apply);
    observer?.observe(el);
    return () => { observer?.disconnect(); root.style.removeProperty('--strip-h'); };
  }, [strip]);

  return (
    <>
      {strip && (
        <div ref={stripRef} role="status"
          className={`fixed top-0 left-0 right-0 z-[70] flex items-center justify-center gap-2 px-4 pt-[calc(env(safe-area-inset-top)+4px)] pb-1 text-white text-xs font-semibold ${strip === 'offline' ? 'bg-amber-500' : 'bg-gray-900'}`}>
          {strip === 'offline' ? (
            <>
              <WifiOff size={13} className="flex-shrink-0" />
              <span className="truncate">
                <span className="sm:hidden">오프라인 · 바꾼 내용은 연결되면 저장돼요</span>
                <span className="hidden sm:inline">인터넷 연결이 끊겼어요. 바꾼 내용은 이 기기에 보관했다가 다시 연결되면 저장해요.</span>
                {net.pending > 0 && ` (${net.pending}개 대기)`}
              </span>
            </>
          ) : (
            <>
              <RefreshCw size={13} className={`flex-shrink-0 ${net.syncing ? 'animate-spin motion-reduce:animate-none' : ''}`} />
              <span className="truncate">{net.syncing ? `저장하지 못한 변경 ${net.pending}개를 보내는 중…` : `저장 대기 중인 변경 ${net.pending}개`}</span>
              {!net.syncing && (
                <button onClick={() => void drainOutbox()} className="flex-shrink-0 underline underline-offset-2">다시 보내기</button>
              )}
            </>
          )}
        </div>
      )}
      <div className="fixed left-0 right-0 bottom-[74px] z-[70] flex flex-col items-center gap-2 px-4 pointer-events-none" aria-live="polite">
        {toasts.map(t => {
          const { box, Icon } = STYLES[t.kind];
          return (
            <div key={t.id} role={t.kind === 'error' ? 'alert' : 'status'}
              className={`pointer-events-auto w-full max-w-sm flex items-start gap-2 px-3.5 py-2.5 rounded-lg shadow-lg text-sm animate-slide-up motion-reduce:animate-none ${box}`}>
              <Icon size={16} className="flex-shrink-0 mt-0.5" />
              <p className="flex-1 leading-snug break-keep">{t.message}</p>
              {t.action && (
                <button onClick={() => { t.action?.onClick(); dismissToast(t.id); }}
                  className="flex-shrink-0 -my-0.5 px-1.5 py-0.5 rounded font-semibold underline underline-offset-2">
                  {t.action.label}
                </button>
              )}
              <button onClick={() => dismissToast(t.id)} aria-label="닫기" className="flex-shrink-0 opacity-70 hover:opacity-100">
                <X size={15} />
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}
