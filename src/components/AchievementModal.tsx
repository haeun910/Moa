import { useState } from 'react';
import { X, ChevronLeft, ChevronRight, TrendingUp, Target, CheckCircle2 } from 'lucide-react';
import { format, addMonths, subMonths, addDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useApp } from '../context/AppContext';

export default function AchievementModal({ onClose }: { onClose: () => void }) {
  const { todos, categories, monthlyGoals } = useApp();
  const [viewMonth, setViewMonth] = useState(new Date());

  const monthStr = format(viewMonth, 'yyyy-MM');
  const monthTodos = todos.filter(t => t.date?.startsWith(monthStr));
  const completedTodos = monthTodos.filter(t => t.completed);
  const total = monthTodos.length;
  const completed = completedTodos.length;
  const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Monthly goals
  const goals = monthlyGoals.filter(g => g.month === monthStr);
  const completedGoals = goals.filter(g => g.completed).length;
  const goalRate = goals.length > 0 ? Math.round((completedGoals / goals.length) * 100) : 0;

  // Category breakdown
  const catStats = categories
    .map(cat => {
      const ct = monthTodos.filter(t => t.categoryId === cat.id);
      return { cat, total: ct.length, completed: ct.filter(t => t.completed).length };
    })
    .filter(s => s.total > 0)
    .sort((a, b) => b.total - a.total);

  // Last 14 days daily completion
  const last14 = Array.from({ length: 14 }, (_, i) => {
    const d = addDays(new Date(), -(13 - i));
    const s = format(d, 'yyyy-MM-dd');
    const dt = todos.filter(t => t.date === s);
    return {
      label: format(d, 'M/d'),
      shortLabel: format(d, 'd'),
      total: dt.length,
      done: dt.filter(t => t.completed).length,
    };
  });
  const maxBar = Math.max(...last14.map(d => d.total), 1);

  // Streak: consecutive days with at least 1 completed todo
  let streak = 0;
  for (let i = 0; i < 30; i++) {
    const d = format(addDays(new Date(), -i), 'yyyy-MM-dd');
    const done = todos.filter(t => t.date === d && t.completed).length;
    if (done === 0) break;
    streak++;
  }

  const stats = [
    { label: '이번 달 할 일', value: total, unit: '개' },
    { label: '완료', value: completed, unit: '개' },
    { label: '달성률', value: rate, unit: '%' },
    { label: '연속 달성', value: streak, unit: '일' },
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel max-w-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 sm:px-7 pt-6 pb-5 flex-shrink-0 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold tracking-[-0.03em] text-gray-900 dark:text-white">성취 리포트</h2>
            <div className="flex items-center gap-0.5 mt-1 -ml-1.5">
              <button onClick={() => setViewMonth(m => subMonths(m, 1))} aria-label="이전 달" className="btn-icon w-7 h-7">
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm font-medium tabular-nums text-gray-600 dark:text-gray-300 min-w-[88px] text-center">
                {format(viewMonth, 'yyyy년 M월', { locale: ko })}
              </span>
              <button onClick={() => setViewMonth(m => addMonths(m, 1))} aria-label="다음 달" className="btn-icon w-7 h-7">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
          <button onClick={onClose} aria-label="닫기" className="btn-icon -mr-2">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 sm:px-7 pb-7 space-y-7">
          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px rounded-xl overflow-hidden bg-gray-200/80 dark:bg-gray-800 ring-1 ring-gray-200/80 dark:ring-gray-800">
            {stats.map(s => (
              <div key={s.label} className="px-4 py-4 bg-white dark:bg-gray-900">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{s.label}</p>
                <p className="mt-1.5 text-[28px] leading-none font-bold tracking-[-0.03em] tabular-nums text-gray-900 dark:text-white">
                  {s.value}<span className="text-sm font-semibold text-gray-400 ml-0.5">{s.unit}</span>
                </p>
              </div>
            ))}
          </div>

          {/* Progress */}
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-leaf-600 dark:text-leaf-400" />
                  <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">할 일 달성률</span>
                </div>
                <span className="text-sm font-semibold tabular-nums text-gray-900 dark:text-white">{rate}%</span>
              </div>
              <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-leaf-500 rounded-full transition-[width] duration-500" style={{ width: `${rate}%` }} />
              </div>
            </div>

            {goals.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Target size={15} className="text-leaf-600 dark:text-leaf-400" />
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                      {format(viewMonth, 'M월')} 목표 달성률
                    </span>
                    <span className="count-pill">{completedGoals}/{goals.length}</span>
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-gray-900 dark:text-white">{goalRate}%</span>
                </div>
                <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full bg-leaf-700 dark:bg-leaf-300 rounded-full transition-[width] duration-500" style={{ width: `${goalRate}%` }} />
                </div>
              </div>
            )}
          </div>

          {/* 14-day chart */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp size={15} className="text-leaf-600 dark:text-leaf-400" />
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">최근 14일</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-[3px] bg-leaf-100 dark:bg-leaf-900/50 block" />
                  <span className="text-[11px] text-gray-500 dark:text-gray-400">할 일</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-[3px] bg-leaf-500 block" />
                  <span className="text-[11px] text-gray-500 dark:text-gray-400">완료</span>
                </div>
              </div>
            </div>
            <div className="flex items-end gap-1.5">
              {last14.map((d, i) => {
                const isLast = i === last14.length - 1;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1.5" title={`${d.label} · ${d.done}/${d.total}`}>
                    <div className="w-full h-[96px] flex flex-col justify-end">
                      <div
                        className="w-full rounded-[4px] bg-leaf-100 dark:bg-leaf-900/50 flex flex-col justify-end overflow-hidden"
                        style={{ height: `${(d.total / maxBar) * 100}%`, minHeight: d.total ? 4 : 2, opacity: d.total ? 1 : 0.5 }}
                      >
                        {d.done > 0 && (
                          <div className="w-full bg-leaf-500" style={{ height: `${(d.done / d.total) * 100}%` }} />
                        )}
                      </div>
                    </div>
                    <span className={`text-[10px] tabular-nums ${isLast ? 'font-bold text-gray-900 dark:text-white' : 'text-gray-400'}`}>{d.shortLabel}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Category breakdown */}
          {catStats.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">카테고리별</p>
              <div className="space-y-3.5">
                {catStats.map(({ cat, total: ct, completed: cc }) => {
                  const pct = ct > 0 ? Math.round((cc / ct) * 100) : 0;
                  return (
                    <div key={cat.id}>
                      <div className="flex justify-between items-center text-[13px] mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                          <span className="font-medium text-gray-800 dark:text-gray-200">{cat.name}</span>
                        </div>
                        <div className="flex items-center gap-2.5 tabular-nums">
                          <span className="text-gray-400 text-xs">{cc}/{ct}</span>
                          <span className="font-semibold text-gray-900 dark:text-white w-9 text-right">{pct}%</span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, backgroundColor: cat.color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
