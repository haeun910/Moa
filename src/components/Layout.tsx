import type React from 'react';
import { Home, Archive, NotebookPen, Settings } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useApp } from '../context/AppContext';
import type { Screen } from '../types';
import Logo from './Logo';

const NAV_ITEMS: { screen: Screen; label: string; Icon: React.FC<{ size?: number; strokeWidth?: number; className?: string }> }[] = [
  { screen: 'today', label: '홈', Icon: Home },
  { screen: 'all', label: '저장소', Icon: Archive },
  { screen: 'notes', label: '메모', Icon: NotebookPen },
  { screen: 'settings', label: '설정', Icon: Settings },
];

// 하위 화면(카테고리 관리, 약관 등)에 있을 때도 어느 메뉴 아래인지 표시되도록 묶어줌
function navOwner(screen: Screen): Screen {
  if (screen === 'categories' || screen === 'terms' || screen === 'privacy') return 'settings';
  if (screen === 'project') return 'all';
  if (screen === 'calendar') return 'today';
  return screen;
}

// 사이드바 맨 위: 오늘 날짜와 오늘 할 일 진행 상황
function TodaySummary() {
  const { todos } = useApp();
  const now = new Date();
  const todayStr = format(now, 'yyyy-MM-dd');
  const todayTodos = todos.filter(t => t.date === todayStr);
  const done = todayTodos.filter(t => t.completed).length;
  const pct = todayTodos.length ? Math.round((done / todayTodos.length) * 100) : 0;

  return (
    <div className="hidden wide:block mx-3 mb-6 rounded-xl bg-white dark:bg-gray-900 shadow-card p-3.5">
      <p className="text-[13px] font-semibold text-gray-900 dark:text-white">
        {format(now, 'M월 d일 EEEE', { locale: ko })}
      </p>
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
  const { currentScreen, setCurrentScreen } = useApp();
  const owner = navOwner(currentScreen);

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* ── 데스크톱 사이드바 (lg: 아이콘만, wide: 이름까지) ── */}
      <aside className="hidden lg:flex flex-col flex-shrink-0 sticky top-0 h-screen w-[76px] wide:w-[232px] border-r border-gray-200/70 dark:border-gray-800/80">
        <div className="flex items-center gap-2.5 h-16 px-[22px] wide:px-5 mb-2">
          <Logo size={30} />
          <span className="hidden wide:inline text-[17px] font-bold tracking-[-0.03em] text-gray-900 dark:text-white">모아</span>
        </div>

        <TodaySummary />

        <nav className="flex-1 flex flex-col gap-0.5 px-3" aria-label="주요 메뉴">
          {NAV_ITEMS.map(({ screen, label, Icon }) => {
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
      </aside>

      <main className="flex-1 min-w-0 overflow-hidden">
        {children}
      </main>

      {/* ── 모바일/태블릿 하단 탭 ── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/85 dark:bg-gray-950/85 backdrop-blur-xl border-t border-gray-200/70 dark:border-gray-800 pb-[env(safe-area-inset-bottom)]" aria-label="주요 메뉴">
        <div className="flex items-stretch justify-around h-[62px] max-w-lg mx-auto px-2">
          {NAV_ITEMS.map(({ screen, label, Icon }) => {
            const active = owner === screen;
            return (
              <button
                key={screen}
                onClick={() => setCurrentScreen(screen)}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-col items-center justify-center gap-1 flex-1 transition-colors ${
                  active ? 'text-leaf-600 dark:text-leaf-400' : 'text-gray-400 dark:text-gray-500 active:text-gray-600'
                }`}
              >
                <span className={`flex items-center justify-center w-12 h-7 rounded-full transition-colors ${active ? 'bg-leaf-100 dark:bg-leaf-900/40' : ''}`}>
                  <Icon size={19} strokeWidth={active ? 2.2 : 1.8} />
                </span>
                <span className={`text-[10.5px] leading-none ${active ? 'font-semibold' : 'font-medium'}`}>{label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
