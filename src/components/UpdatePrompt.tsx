import { useEffect, useRef } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X } from 'lucide-react';

// 태블릿 등 설치된 PWA는 완전히 새로고침되지 않고 백그라운드에서 그대로 재개되는 경우가
// 많아서, 새 서비스워커 감지가 일어날 기회(탐색/새로고침)가 거의 없다. 그래서 주기적으로 +
// 화면이 다시 보일 때마다 직접 업데이트 여부를 확인해준다.
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1시간

export default function UpdatePrompt() {
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      registrationRef.current = registration ?? null;
    },
  });

  useEffect(() => {
    function checkForUpdate() {
      registrationRef.current?.update().catch(() => {});
    }

    const intervalId = window.setInterval(checkForUpdate, CHECK_INTERVAL_MS);

    function handleVisible() {
      if (document.visibilityState === 'visible') checkForUpdate();
    }
    document.addEventListener('visibilitychange', handleVisible);
    window.addEventListener('focus', checkForUpdate);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisible);
      window.removeEventListener('focus', checkForUpdate);
    };
  }, []);

  // "새로고침" 버튼: 새 서비스워커를 활성화하고, 화면 제어가 넘어오는 순간 직접 새로고침.
  // (vite-plugin-pwa는 자기가 처음 찾은 업데이트일 때만 자동 새로고침하고, 위의 registration.update()로
  //  찾은 업데이트는 "외부" 업데이트로 취급해 새로고침을 건너뜀 → 버튼을 눌러도 화면이 그대로였음)
  function applyUpdate() {
    let reloaded = false;
    const reload = () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    };
    const waiting = registrationRef.current?.waiting;
    if (!waiting) {
      // 이미 활성화까지 끝났으면 새로고침만 하면 최신 버전
      reload();
      return;
    }
    navigator.serviceWorker.addEventListener('controllerchange', reload, { once: true });
    waiting.postMessage({ type: 'SKIP_WAITING' });
    updateServiceWorker(true).catch(() => {});
    // 혹시 제어 전환 신호를 못 받아도 잠시 뒤에는 새로고침 (새 버전은 이미 활성화된 상태)
    window.setTimeout(reload, 4000);
  }

  if (!needRefresh) return null;

  return (
    <div className="fixed bottom-20 lg:bottom-6 left-4 right-4 lg:left-auto lg:right-6 max-w-sm mx-auto lg:mx-0 lg:w-[360px] bg-gray-900 dark:bg-gray-800 text-white rounded-xl shadow-2xl ring-1 ring-white/10 p-3.5 flex items-center gap-3 z-50 animate-slide-in-bottom motion-reduce:animate-none">
      <div className="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0">
        <RefreshCw size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm">새 버전이 있어요</p>
        <p className="text-xs text-gray-400 mt-0.5">새로고침하면 최신 버전으로 업데이트돼요</p>
      </div>
      <button onClick={applyUpdate}
        className="bg-leaf-500 hover:bg-leaf-400 text-leaf-950 text-xs font-bold px-3 py-1.5 rounded-md transition-colors flex-shrink-0">
        새로고침
      </button>
      <button onClick={() => setNeedRefresh(false)} aria-label="닫기"
        className="text-white/50 hover:text-white flex-shrink-0">
        <X size={16} />
      </button>
    </div>
  );
}
