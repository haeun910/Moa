import { useState } from 'react';
import type React from 'react';
import { Home, CalendarDays, Archive, NotebookPen, Settings, Timer, LogIn, Search, PictureInPicture2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import GuestLoginModal from './GuestLoginModal';
import UpgradeAccountModal from './UpgradeAccountModal';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useApp } from '../context/AppContext';
import type { Screen } from '../types';
import Logo from './Logo';
import GuestBanner from './GuestBanner';
import { categoriesOrigin } from '../lib/navBack';
import { planTarget } from '../lib/planNav';
import SearchHost from './SearchModal';
import { openSearch } from '../lib/searchStore';
import { miniWindowSupported, openMiniWindow } from '../lib/miniWindow';
import MiniTodayHost from './MiniTodayWindow';
import { showToast } from '../lib/toast';

// 미니 창(다른 창 위에 떠 있는 오늘 할 일)은 크롬·엣지 컴퓨터에서만 돼서, 안 되는 브라우저에선 버튼을 숨김
const MINI_WINDOW = miniWindowSupported();
const MINI_WINDOW_TITLE = '미니 창: 오늘 할 일을 다른 창 위에 작게 띄워요 (모아 탭은 열어 둬야 해요)';
async function launchMiniWindow() {
  const result = await openMiniWindow();
  if (result === 'failed') showToast('미니 창을 열지 못했어요. 잠시 뒤 다시 눌러 주세요.', 'error');
}

const SHORTCUT = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl K';

const NAV_ITEMS: { screen: Screen; label: string; Icon: React.FC<{ size?: number; strokeWidth?: number; className?: string }> }[] = [
  { screen: 'today', label: '홈', Icon: Home },
  { screen: 'month', label: '달력', Icon: CalendarDays },
  { screen: 'timebox', label: '타임박스', Icon: Timer },
  { screen: 'all', label: '저장소', Icon: Archive },
  { screen: 'notes', label: '메모', Icon: NotebookPen },
  { screen: 'settings', label: '설정', Icon: Settings },
];

// 폰·태블릿 하단 탭은 4칸만 (6칸은 너무 빽빽함): 타임박스는 달력 화면 위 "월·주·타임박스" 전환으로,
// 저장소는 홈 화면 위 버튼으로 들어감
const MOBILE_TABS: Screen[] = ['today', 'month', 'notes', 'settings'];
function mobileOwner(screen: Screen): Screen {
  if (screen === 'timebox') return 'month';
  const owner = navOwner(screen);
  return owner === 'all' ? 'today' : owner;
}

// 하위 화면(카테고리 관리, 약관 등)에 있을 때도 어느 메뉴 아래인지 표시되도록 묶어줌.
// 카테고리 관리는 저장소의 바로가기로 열었으면 저장소 아래, 설정에서 열었으면 설정 아래
function navOwner(screen: Screen): Screen {
  if (screen === 'categories') return categoriesOrigin() === 'all' ? 'all' : 'settings';
  if (screen === 'terms' || screen === 'privacy') return 'settings';
  if (screen === 'project') return navOwner(planTarget().origin); // 로드맵은 열었던 화면(설정·홈·달력) 아래로 표시
  if (screen === 'calendar') return 'month';
  return screen;
}

// 사이드바 맨 위: 오늘 날짜와 오늘 할 일 진행 상황
function TodaySummary() {
  const { todos } = useApp();
  const now = new Date();
  const todayStr = format(now, 'yyyy-MM-dd');
  const todayTodos = todos.filter(t => t.date === todayStr && !t.skipped);
  const done = todayTodos.filter(t => t.completed).length;
  const pct = todayTodos.length ? Math.round((done / todayTodos.length) * 100) : 0;

  return (
    <div className="hidden wide:block mx-3 mb-6 rounded-xl bg-white dark:bg-gray-900 shadow-card p-3.5">
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-13px font-semibold text-gray-900 dark:text-white">
          {format(now, 'M월 d일 EEEE', { locale: ko })}
        </p>
        {MINI_WINDOW && (
          <button onClick={launchMiniWindow} title={MINI_WINDOW_TITLE} aria-label="미니 창 띄우기"
            className="flex-shrink-0 whitespace-nowrap -my-1 -mr-1.5 flex items-center gap-1 h-6 px-1.5 rounded-md text-11px font-medium text-gray-500 dark:text-gray-400 hover:text-leaf-700 dark:hover:text-leaf-300 hover:bg-leaf-50 dark:hover:bg-leaf-900/30 transition-colors">
            <PictureInPicture2 size={13} strokeWidth={2} />
            미니 창
          </button>
        )}
      </div>
      <div className="flex items-baseline justify-between mt-2.5 mb-1.5">
        <span className="text-xs text-gray-500 dark:text-gray-400">오늘 할 일</span>
        <span className="text-xs font-semibold tabular-nums text-gray-700 dark:text-gray-300">
          {done}<span className="text-gray-400 dark:text-gray-500 font-normal"> / {todayTodos.length}</span>
        </span>
      </div>
      <div className="h-1 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
        <div className="h-full rounded-full bg-leaf-500 transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const { currentScreen, setCurrentScreen, settings } = useApp();
  const { isGuest } = useAuth();
  const [guestModal, setGuestModal] = useState<'login' | 'upgrade' | null>(null);
  // 설정에서 끈 기능은 메뉴에서 뺌 (저장소를 꺼도 설정에서 여는 프로젝트 로드맵은 설정 아래로 표시)
  const navItems = NAV_ITEMS.filter(({ screen }) => !(settings.hiddenFeatures as Screen[]).includes(screen));
  const rawOwner = navOwner(currentScreen);
  const owner = navItems.some(n => n.screen === rawOwner) ? rawOwner : 'settings';
  const mobileItems = navItems.filter(n => MOBILE_TABS.includes(n.screen));
  const rawMobileOwner = mobileOwner(currentScreen);
  const mobileActive = mobileItems.some(n => n.screen === rawMobileOwner) ? rawMobileOwner : 'settings';

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* ── 데스크톱 사이드바 (lg: 아이콘만, wide: 이름까지) ── */}
      <aside className="hidden lg:flex flex-col flex-shrink-0 sticky top-0 h-screen w-[76px] wide:w-[232px] border-r border-gray-200/70 dark:border-gray-800/80">
        <div className="flex items-center gap-2.5 h-16 px-[22px] wide:px-5 mb-2">
          <Logo size={30} />
          <span className="hidden wide:inline text-17px font-bold tracking-[-0.03em] text-gray-900 dark:text-white">모아</span>
        </div>

        <TodaySummary />

        <div className="px-3 mb-3">
          <button onClick={openSearch} title={`검색 (${SHORTCUT})`} aria-label="검색"
            className="w-full flex items-center justify-center wide:justify-start gap-3 h-10 px-3 rounded-lg text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white wide:bg-white wide:dark:bg-gray-900 wide:ring-1 wide:ring-gray-200 wide:dark:ring-gray-800 hover:bg-gray-100 dark:hover:bg-gray-900/60 transition-colors">
            <Search size={18} strokeWidth={1.8} />
            <span className="hidden wide:inline flex-1 text-left">검색</span>
            <kbd className="hidden wide:inline font-sans text-10.5px font-semibold text-gray-400 dark:text-gray-500">{SHORTCUT}</kbd>
          </button>
          {/* 사이드바가 아이콘만 보일 때 (넓으면 위 날짜 칸에 "미니 창" 버튼이 있음) */}
          {MINI_WINDOW && (
            <button onClick={launchMiniWindow} title={MINI_WINDOW_TITLE} aria-label="미니 창 띄우기"
              className="wide:hidden mt-0.5 w-full flex items-center justify-center h-10 px-3 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-900/60 transition-colors">
              <PictureInPicture2 size={18} strokeWidth={1.8} />
            </button>
          )}
        </div>

        <nav className="flex-1 flex flex-col gap-0.5 px-3" aria-label="주요 메뉴">
          {navItems.map(({ screen, label, Icon }) => {
            const active = owner === screen;
            return (
              <button
                key={screen}
                onClick={() => setCurrentScreen(screen)}
                aria-current={active ? 'page' : undefined}
                title={label}
                className={`group flex items-center justify-center wide:justify-start gap-3 h-10 px-3 rounded-lg text-sm transition-colors ${
                  screen === 'settings' ? 'mt-auto mb-4' : ''
                } ${
                  active
                    ? 'bg-white dark:bg-gray-900 shadow-card text-gray-900 dark:text-white font-semibold'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-900/60 font-medium'
                }`}
              >
                <Icon size={18} strokeWidth={active ? 2.2 : 1.8} className={active ? 'text-leaf-600 dark:text-leaf-400' : ''} />
                <span className="hidden wide:inline">{label}</span>
              </button>
            );
          })}
        </nav>

        {/* 체험 중: 아래 안내를 닫아도 언제든 기존 계정으로 로그인할 수 있게 */}
        {isGuest && (
          <div className="px-3 pb-4 -mt-2">
            <button onClick={() => setGuestModal('login')} title="기존 계정으로 로그인"
              className="w-full flex items-center justify-center wide:justify-start gap-3 h-10 px-3 rounded-lg text-sm font-semibold text-leaf-700 dark:text-leaf-400 hover:bg-leaf-50 dark:hover:bg-leaf-900/30 transition-colors">
              <LogIn size={18} strokeWidth={2} />
              <span className="hidden wide:inline">로그인</span>
            </button>
          </div>
        )}
      </aside>
      <MiniTodayHost />

      {/* overflow-clip: 넘친 내용은 자르되 스크롤 상자를 만들지 않음 → 폰처럼 화면 전체가 스크롤될 때도
          안쪽의 sticky(달력 요일 줄 등)가 화면 위에 붙을 수 있음. clip을 모르는 옛 브라우저는 예전처럼 hidden */}
      <main className="flex-1 min-w-0 overflow-hidden supports-[overflow:clip]:overflow-clip">
        {children}
      </main>

      <GuestBanner />
      <SearchHost />
      {guestModal === 'login' && <GuestLoginModal onClose={() => setGuestModal(null)} onUpgrade={() => setGuestModal('upgrade')} />}
      {guestModal === 'upgrade' && <UpgradeAccountModal onClose={() => setGuestModal(null)} onLogin={() => setGuestModal('login')} />}

      {/* ── 모바일/태블릿 하단 탭 ── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/85 dark:bg-gray-950/85 backdrop-blur-xl border-t border-gray-200/70 dark:border-gray-800 pb-[env(safe-area-inset-bottom)]" aria-label="주요 메뉴">
        <div className="flex items-stretch justify-around h-[62px] max-w-lg mx-auto px-2">
          {mobileItems.map(({ screen, label, Icon }) => {
            const active = mobileActive === screen;
            return (
              <button
                key={screen}
                onClick={() => setCurrentScreen(screen)}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-col items-center justify-center gap-1 flex-1 transition-colors ${
                  active ? 'text-leaf-600 dark:text-leaf-400' : 'text-gray-400 dark:text-gray-500 active:text-gray-600'
                }`}
              >
                <span className={`flex items-center justify-center w-14 h-7 rounded-full transition-colors ${active ? 'bg-leaf-100 dark:bg-leaf-900/40' : ''}`}>
                  <Icon size={20} strokeWidth={active ? 2.2 : 1.8} />
                </span>
                <span className={`text-11px leading-none ${active ? 'font-semibold' : 'font-medium'}`}>{label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
