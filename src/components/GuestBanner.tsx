import { useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import UpgradeAccountModal from './UpgradeAccountModal';
import GuestLoginModal from './GuestLoginModal';

const DISMISS_KEY = 'guest-banner-dismissed';

// 체험(게스트) 중이라는 안내 + 계정 만들기. 데스크톱은 오른쪽 아래, 휴대폰은 하단 탭 위 왼쪽 (오른쪽의 + 버튼을 가리지 않게)
export default function GuestBanner() {
  const { isGuest } = useAuth();
  const [open, setOpen] = useState<'upgrade' | 'login' | null>(null);
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
  });
  if (!isGuest) return null;

  function dismiss() {
    setDismissed(true);
    try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch { /* 저장 못 해도 이번 화면에서는 닫힘 */ }
  }

  return (
    <>
      {!dismissed && (
        <div role="status"
          className="fixed z-40 left-3 right-[84px] bottom-[calc(70px+env(safe-area-inset-bottom))] lg:left-auto lg:right-6 lg:bottom-6 lg:w-[340px] flex items-center gap-2.5 pl-3.5 pr-1.5 py-2 rounded-xl bg-gray-900/95 dark:bg-gray-800/95 text-white shadow-xl backdrop-blur">
          <Sparkles size={15} className="hidden sm:block flex-shrink-0 text-white/70" />
          <p className="flex-1 min-w-0 text-12.5px leading-snug">
            <span className="sm:hidden">체험 중</span>
            <span className="hidden sm:inline">체험 중이에요. 계정을 만들면 적은 내용이 그대로 남아요.</span>
          </p>
          {/* 이미 계정이 있는 사람은 여기서 바로 로그인 (예전엔 설정 > 체험 끝내기를 찾아야 했음) */}
          <button onClick={() => setOpen('login')} className="flex-shrink-0 h-8 px-2.5 rounded-lg text-12.5px font-semibold text-white/90 hover:bg-white/10">
            로그인
          </button>
          <button onClick={() => setOpen('upgrade')} className="flex-shrink-0 h-8 px-3 rounded-lg bg-white hover:bg-gray-100 text-gray-900 text-12.5px font-semibold">
            계정 만들기
          </button>
          <button onClick={dismiss} aria-label="안내 닫기" className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-white/70 hover:bg-white/10">
            <X size={15} />
          </button>
        </div>
      )}
      {open === 'upgrade' && <UpgradeAccountModal onClose={() => setOpen(null)} onLogin={() => setOpen('login')} />}
      {open === 'login' && <GuestLoginModal onClose={() => setOpen(null)} onUpgrade={() => setOpen('upgrade')} />}
    </>
  );
}
