import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, WifiOff, X } from 'lucide-react';
import { subscribeToasts, dismissToast } from '../lib/toast';
import type { ToastItem } from '../lib/toast';

const STYLES: Record<ToastItem['kind'], { box: string; Icon: typeof Info }> = {
  error: { box: 'bg-red-600 text-white', Icon: AlertCircle },
  success: { box: 'bg-leaf-600 text-white', Icon: CheckCircle2 },
  info: { box: 'bg-gray-900 text-white dark:bg-white dark:text-gray-900', Icon: Info },
};

// 화면 아래(하단 탭 위)에 알림을 띄우고, 인터넷이 끊기면 위쪽에 안내 띠를 보여줌
export default function Toaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [offline, setOffline] = useState(() => typeof navigator !== 'undefined' && navigator.onLine === false);

  useEffect(() => subscribeToasts(setToasts), []);
  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  return (
    <>
      {offline && (
        <div role="status" className="fixed top-0 left-0 right-0 z-[70] flex items-center justify-center gap-1.5 px-4 py-1.5 bg-amber-500 text-white text-xs font-semibold">
          <WifiOff size={13} />
          인터넷 연결이 끊겼어요. 다시 연결되면 자동으로 최신 내용을 불러와요.
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
