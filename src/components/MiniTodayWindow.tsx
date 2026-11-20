import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUp, Check, Minus } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useApp } from '../context/AppContext';
import { useNow } from '../hooks/useNow';
import { applyListDisplaySettings } from '../lib/listDisplay';
import { dayProgress, rate } from '../lib/homeStats';
import { isMultiDay, scheduleOnDate } from '../lib/scheduleDates';
import { timeRangeLabel } from '../lib/timeRange';
import { LIMITS } from '../lib/limits';
import { closeMiniWindow, subscribeMiniWindow } from '../lib/miniWindow';
import type { Todo } from '../types';
import ScheduleCheck from './ScheduleCheck';

// 할 일 추가 창(DayTodoComposer)과 같은 "마지막에 고른 카테고리" 기억을 같이 씀
const LAST_CATEGORY_KEY = 'day-composer-last-category';
const LAST_SUBCATEGORY_KEY = 'day-composer-last-subcategory';

function readLast(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function readLastSub(categoryId: string): string | null {
  try { return (JSON.parse(localStorage.getItem(LAST_SUBCATEGORY_KEY) ?? '{}') as Record<string, string | null>)[categoryId] ?? null; } catch { return null; }
}
function writeLast(categoryId: string | null, subcategoryId: string | null) {
  try {
    if (!categoryId) return;
    localStorage.setItem(LAST_CATEGORY_KEY, categoryId);
    const all = JSON.parse(localStorage.getItem(LAST_SUBCATEGORY_KEY) ?? '{}') as Record<string, string | null>;
    all[categoryId] = subcategoryId;
    localStorage.setItem(LAST_SUBCATEGORY_KEY, JSON.stringify(all));
  } catch { /* 기억 못 해도 추가는 됨 */ }
}

// 앱 어디서든 미니 창이 열리면 그 안에 오늘 할 일을 그려 줌 (Layout에 하나만 둠).
// 로그아웃 등으로 앱 화면이 사라지면 미니 창도 닫음
export default function MiniTodayHost() {
  const [win, setWin] = useState<Window | null>(null);
  useEffect(() => subscribeMiniWindow(setWin), []);
  useEffect(() => () => closeMiniWindow(), []);
  useEffect(() => {
    if (!win) return;
    win.document.body.className = 'bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 antialiased';
  }, [win]);
  if (!win) return null;
  return createPortal(<MiniToday />, win.document.body);
}

function MiniToday() {
  const { todos, schedules, categories, subcategories, settings, toggleTodo, addTodo } = useApp();
  const now = useNow(60_000); // 자정이 지나면 다음 날로 바뀌게
  const todayKey = format(now, 'yyyy-MM-dd');
  const progress = dayProgress(todos, todayKey); // 홈·사이드바와 같은 숫자
  const pct = rate(progress) ?? 0;
  const list = applyListDisplaySettings(todos.filter(t => t.date === todayKey), settings);
  const daySchedules = schedules
    .filter(s => scheduleOnDate(s, todayKey))
    .sort((a, b) => Number(a.completed) - Number(b.completed) || Number(isMultiDay(b)) - Number(isMultiDay(a)) || (a.startTime ?? '').localeCompare(b.startTime ?? ''));

  // 카테고리 순서대로 묶고, 분류 없는 할 일은 맨 아래
  const groups = [
    ...categories.map(cat => ({ key: cat.id, name: cat.name, color: cat.color as string | undefined, items: list.filter(t => t.categoryId === cat.id) })),
    { key: '__none__', name: '분류 없음', color: undefined, items: list.filter(t => !t.categoryId || !categories.some(c => c.id === t.categoryId)) },
  ].filter(g => g.items.length > 0);
  const subName = (t: Todo) => (t.subcategoryId ? subcategories.find(s => s.id === t.subcategoryId && s.categoryId === t.categoryId)?.name : undefined);

  return (
    <div className="h-screen flex flex-col font-sans">
      <header className="flex-shrink-0 px-4 pt-3.5 pb-3 border-b border-gray-200/70 dark:border-gray-800">
        <div className="flex items-baseline justify-between gap-2">
          <h1 className="text-14px font-bold text-gray-900 dark:text-white">{format(now, 'M월 d일 EEEE', { locale: ko })}</h1>
          <span className="text-12px tabular-nums text-gray-500 dark:text-gray-400">
            {progress.total > 0 ? <><b className="font-semibold text-gray-800 dark:text-gray-200">{progress.done}</b> / {progress.total}</> : '할 일 없음'}
          </span>
        </div>
        <div className="mt-2 h-1 rounded-full bg-gray-200/70 dark:bg-gray-800 overflow-hidden" aria-hidden="true">
          <div className="h-full rounded-full bg-leaf-500 transition-[width] duration-500" style={{ width: `${pct}%` }} />
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-4">
        {daySchedules.length > 0 && (
          <section aria-label="오늘 일정">
            <p className="px-1 mb-1 text-11px font-semibold text-gray-500 dark:text-gray-400">일정</p>
            <ul>
              {daySchedules.map(s => (
                <li key={s.id} className="flex items-center gap-2.5 px-1 py-1.5">
                  <ScheduleCheck schedule={s} size="sm" />
                  <span className={`flex-1 min-w-0 truncate text-13px ${s.completed ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-800 dark:text-gray-100'}`}>{s.title}</span>
                  <span className="flex-shrink-0 text-11px tabular-nums text-gray-400 dark:text-gray-500">
                    {isMultiDay(s) ? '여러 날' : s.startTime ? timeRangeLabel(s.startTime, s.endTime) : '하루 종일'}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {groups.map(g => (
          <section key={g.key} aria-label={g.name}>
            <p className="flex items-center gap-1.5 px-1 mb-0.5 text-11px font-semibold text-gray-500 dark:text-gray-400">
              {g.color && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: g.color }} />}
              {g.name}
            </p>
            <ul>
              {g.items.map(t => {
                const sub = subName(t);
                return (
                  <li key={t.id} className="flex items-start gap-2.5 px-1 py-1.5">
                    <button type="button" onClick={() => toggleTodo(t.id)}
                      aria-label={t.skipped ? `${t.title} 안 하기 취소` : t.completed ? `${t.title} 완료 취소` : `${t.title} 완료 처리`}
                      className={`flex-shrink-0 mt-px w-[17px] h-[17px] rounded-[5px] border-[1.5px] flex items-center justify-center transition-colors active:scale-90 ${
                        t.skipped
                          ? 'bg-gray-100 border-gray-300 dark:bg-gray-800 dark:border-gray-600'
                          : t.completed
                            ? 'bg-leaf-600 border-leaf-600 dark:bg-leaf-500 dark:border-leaf-500'
                            : 'border-gray-300 dark:border-gray-600 hover:border-leaf-500 hover:bg-leaf-50 dark:hover:bg-leaf-900/30'
                      }`}
                      style={!t.completed && !t.skipped && g.color ? { borderColor: `${g.color}99` } : undefined}>
                      {t.skipped ? <Minus size={11} className="text-gray-400" strokeWidth={3} /> : t.completed && <Check size={11} className="text-white" strokeWidth={3} />}
                    </button>
                    <span className={`flex-1 min-w-0 text-13px leading-[1.45] break-words ${t.completed || t.skipped ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-gray-100'}`}>
                      {t.title}
                      {/* inline-block: 끝낸 할 일의 취소선이 하위 카테고리 이름까지 번지지 않게 */}
                      {sub && <span className="inline-block ml-1.5 text-11px text-gray-400 dark:text-gray-500">{sub}</span>}
                    </span>
                    {t.startTime && <span className="flex-shrink-0 mt-0.5 text-11px tabular-nums text-gray-400 dark:text-gray-500">{t.startTime}</span>}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}

        {list.length === 0 && daySchedules.length === 0 && (
          <p className="px-1 py-6 text-center text-13px text-gray-400 dark:text-gray-500">오늘 할 일이 없어요.<br />아래에 적어 보세요.</p>
        )}
      </main>

      <QuickAdd date={todayKey} onAdd={addTodo} />
    </div>
  );
}

function QuickAdd({ date, onAdd }: { date: string; onAdd: ReturnType<typeof useApp>['addTodo'] }) {
  const { categories, subcategories } = useApp();
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [categoryId, setCategoryId] = useState<string | null>(() => {
    const last = readLast(LAST_CATEGORY_KEY);
    return last && categories.some(c => c.id === last) ? last : null;
  });
  const subs = categoryId ? subcategories.filter(s => s.categoryId === categoryId) : [];
  const [subcategoryId, setSubcategoryId] = useState<string | null>(() => (categoryId ? readLastSub(categoryId) : null));
  // 지워진 카테고리·하위 카테고리를 고른 채로 남지 않게
  const validCategory = categoryId && categories.some(c => c.id === categoryId) ? categoryId : null;
  const validSub = validCategory && subcategoryId && subs.some(s => s.id === subcategoryId) ? subcategoryId : null;

  async function submit() {
    const text = title.trim();
    if (!text || saving) return;
    setSaving(true);
    try {
      const created = await onAdd({ title: text, completed: false, categoryId: validCategory, subcategoryId: validSub, date, startTime: null, notes: '' });
      if (created) {
        setTitle('');
        writeLast(validCategory, validSub);
      }
    } finally {
      setSaving(false);
    }
  }

  const select = 'min-w-0 flex-1 h-7 px-1.5 rounded-md bg-white dark:bg-gray-900 ring-1 ring-gray-200 dark:ring-gray-700 text-12px text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-leaf-500';
  return (
    <footer className="flex-shrink-0 px-3 pt-2.5 pb-3 border-t border-gray-200/70 dark:border-gray-800 space-y-2">
      <div className="flex gap-1.5">
        <select aria-label="카테고리" value={validCategory ?? ''} className={select}
          onChange={e => { const id = e.target.value || null; setCategoryId(id); setSubcategoryId(id ? readLastSub(id) : null); }}>
          <option value="">분류 없음</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {subs.length > 0 && (
          <select aria-label="하위 카테고리" value={validSub ?? ''} className={select} onChange={e => setSubcategoryId(e.target.value || null)}>
            <option value="">하위 없음</option>
            {subs.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
      </div>
      <div className="flex items-center gap-1.5 bg-white dark:bg-gray-900 rounded-lg ring-1 ring-gray-200 dark:ring-gray-700 focus-within:ring-leaf-500 pl-2.5 pr-1 py-1">
        <input value={title} onChange={e => setTitle(e.target.value)} maxLength={LIMITS.title}
          onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); void submit(); } }}
          placeholder="오늘 할 일 추가" aria-label="오늘 할 일 추가"
          className="flex-1 min-w-0 bg-transparent text-13px text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none py-1" />
        <button type="button" onClick={() => void submit()} disabled={!title.trim() || saving} aria-label="추가"
          className="btn-primary flex-shrink-0 w-7 h-7 disabled:opacity-40">
          <ArrowUp size={14} strokeWidth={2.4} />
        </button>
      </div>
    </footer>
  );
}
