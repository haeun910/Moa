import { useApp } from '../context/AppContext';
import { saveCalendarView } from '../lib/calendarView';
import type { CalendarView } from '../lib/calendarView';

// 월 · 주 · 타임박스 전환. 폰·태블릿은 하단 탭에 타임박스가 없어서 여기서 들어감
// (컴퓨터는 왼쪽 메뉴에 타임박스가 따로 있으므로 월·주만)
export default function CalendarViewTabs({ value, onChange }: { value: CalendarView; onChange?: (view: 'month' | 'week') => void }) {
  const { settings, setCurrentScreen } = useApp();
  const showTimebox = !settings.hiddenFeatures.includes('timebox');
  const views: { v: CalendarView; label: string; className?: string }[] = [
    { v: 'month', label: '월' },
    { v: 'week', label: '주' },
    ...(showTimebox ? [{ v: 'timebox' as const, label: '타임박스', className: 'lg:hidden' }] : []),
  ];

  function pick(v: CalendarView) {
    if (v === value) return;
    if (v === 'timebox') { setCurrentScreen('timebox'); return; }
    saveCalendarView(v);
    if (onChange) onChange(v);
    else setCurrentScreen('month');
  }

  return (
    <div className="flex p-0.5 rounded-lg bg-gray-200/60 dark:bg-gray-800 text-13px font-medium" role="tablist" aria-label="달력 보기">
      {views.map(({ v, label, className }) => (
        <button key={v} role="tab" aria-selected={value === v} onClick={() => pick(v)}
          className={`h-8 px-3 rounded-md transition-all ${className ?? ''} ${
            value === v
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm font-semibold'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
          }`}>
          {label}
        </button>
      ))}
    </div>
  );
}
