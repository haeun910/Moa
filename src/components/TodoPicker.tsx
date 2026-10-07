import { useMemo, useState } from 'react';
import type React from 'react';
import { Search, Clock } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useApp } from '../context/AppContext';
import { getBlockSpan, formatMinutes } from '../lib/timebox';
import type { Todo } from '../types';

interface Props {
  // 첫 번째 탭에 보여줄 날짜 범위 (YYYY-MM-DD, 양 끝 포함) 와 그 탭 이름 ("이번 주", "이 날" 등)
  rangeFrom: string;
  rangeTo: string;
  rangeLabel: string;
  onPick: (todo: Todo) => void;
  // 데스크톱 패널에서 할 일을 마우스로 끌어 타임라인에 놓을 때
  onDragStart?: (e: React.PointerEvent, todo: Todo) => void;
  compact?: boolean;
}

// 타임박스에 넣을 할 일 고르기: 기간 안의 할 일 / 저장소(날짜 없는 할 일). 완료한 건 숨김
export default function TodoPicker({ rangeFrom, rangeTo, rangeLabel, onPick, onDragStart, compact }: Props) {
  const { todos, categories, subcategories, timeblocks } = useApp();
  const [tab, setTab] = useState<'range' | 'storage'>('range');
  const [query, setQuery] = useState('');

  // 이미 블록에 들어간 할 일은 시간 뱃지로 표시 (나눠서 여러 블록에 넣는 것도 가능하니 숨기지는 않음)
  const placedTimes = useMemo(() => {
    const map = new Map<string, string>();
    for (const b of timeblocks) {
      if (!b.todoId) continue;
      const span = getBlockSpan(b);
      if (span.dateKey < rangeFrom || span.dateKey > rangeTo) continue;
      if (!map.has(b.todoId)) map.set(b.todoId, formatMinutes(span.startMin));
    }
    return map;
  }, [timeblocks, rangeFrom, rangeTo]);

  const q = query.trim().toLowerCase();
  const list = todos
    .filter(t => !t.completed)
    .filter(t => tab === 'storage' ? !t.date : Boolean(t.date && t.date >= rangeFrom && t.date <= rangeTo))
    .filter(t => !q || t.title.toLowerCase().includes(q))
    .sort((a, b) => tab === 'range' ? (a.date ?? '').localeCompare(b.date ?? '') : 0);

  // 홈·저장소 목록처럼 카테고리 → 하위카테고리별로 묶어서 보여줌 (카테고리 순서대로, 분류 없음은 맨 뒤)
  const groups = [...categories, null]
    .map(cat => {
      const inCat = list.filter(t => (t.categoryId ?? null) === (cat?.id ?? null));
      const subGroups = cat
        ? subcategories
            .filter(sc => sc.categoryId === cat.id)
            .map(subcat => ({ subcat, items: inCat.filter(t => t.subcategoryId === subcat.id) }))
            .filter(g => g.items.length > 0)
        : [];
      const grouped = new Set(subGroups.flatMap(g => g.items.map(t => t.id)));
      return { cat, bare: inCat.filter(t => !grouped.has(t.id)), subGroups, count: inCat.length };
    })
    .filter(g => g.count > 0);
  // 지워진 카테고리를 가리키는 할 일은 "분류 없음"에 모음
  const knownCats = new Set(categories.map(c => c.id));
  const orphans = list.filter(t => t.categoryId && !knownCats.has(t.categoryId));
  if (orphans.length) {
    const none = groups.find(g => !g.cat);
    if (none) { none.bare.push(...orphans); none.count += orphans.length; }
    else groups.push({ cat: null, bare: orphans, subGroups: [], count: orphans.length });
  }

  function renderItem(todo: Todo) {
    const placed = placedTimes.get(todo.id);
    const showDate = tab === 'range' && todo.date && rangeFrom !== rangeTo;
    return (
      <button
        key={todo.id}
        type="button"
        onClick={() => onPick(todo)}
        onPointerDown={onDragStart ? e => onDragStart(e, todo) : undefined}
        title={onDragStart ? '눌러서 시간 정하기 · 타임라인으로 끌어다 놓기' : undefined}
        className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left bg-white dark:bg-gray-900 ring-1 ring-inset ring-gray-200/80 dark:ring-gray-800 hover:ring-leaf-400 dark:hover:ring-leaf-600 transition-shadow select-none ${
          onDragStart ? 'cursor-grab active:cursor-grabbing' : ''
        }`}
      >
        <span className="flex-1 min-w-0 text-[13px] text-gray-800 dark:text-gray-100 truncate">{todo.title}</span>
        {showDate && (
          <span className="flex-shrink-0 text-[10.5px] tabular-nums text-gray-400">
            {format(parseISO(todo.date!), 'E d', { locale: ko })}
          </span>
        )}
        {placed && (
          <span className="flex-shrink-0 flex items-center gap-0.5 text-[10.5px] font-semibold tabular-nums text-leaf-700 dark:text-leaf-300 bg-leaf-50 dark:bg-leaf-900/30 px-1.5 py-px rounded">
            <Clock size={9} strokeWidth={2.6} />{placed}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className="flex-shrink-0 flex p-0.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-[13px] font-medium" role="tablist">
        {([['range', rangeLabel], ['storage', '저장소']] as const).map(([value, label]) => (
          <button key={value} role="tab" aria-selected={tab === value} onClick={() => setTab(value)}
            className={`flex-1 h-7 rounded-md transition-all ${
              tab === value
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm font-semibold'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
            }`}>
            {label}
          </button>
        ))}
      </div>

      <label className="flex-shrink-0 mt-2 flex items-center gap-2 h-8 px-2.5 rounded-lg bg-white dark:bg-gray-800/60 ring-1 ring-inset ring-gray-200 dark:ring-gray-700 focus-within:ring-2 focus-within:ring-leaf-500">
        <Search size={13} className="text-gray-400 flex-shrink-0" />
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="할 일 검색"
          className="flex-1 min-w-0 bg-transparent text-[13px] text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none" />
      </label>

      <div className={`mt-2 flex-1 min-h-0 overflow-y-auto scrollbar-thin -mx-1 px-1 ${compact ? 'max-h-56' : ''}`}>
        {list.length === 0 ? (
          <p className="text-[13px] text-gray-400 dark:text-gray-500 text-center py-6">
            {q ? '찾는 할 일이 없어요' : tab === 'storage' ? '저장소가 비어 있어요' : `${rangeLabel} 남은 할 일이 없어요`}
          </p>
        ) : (
          <div className="space-y-3.5 pb-1">
            {groups.map(({ cat, bare, subGroups, count }) => (
              <section key={cat?.id ?? '__none__'}>
                <div className="flex items-center gap-1.5 mb-1.5 px-0.5">
                  {cat ? (
                    <>
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                      <span className="text-xs font-semibold text-gray-700 dark:text-gray-200 truncate">{cat.name}</span>
                    </>
                  ) : (
                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">분류 없음</span>
                  )}
                  <span className="count-pill">{count}</span>
                </div>
                {bare.length > 0 && <div className="space-y-1">{bare.map(renderItem)}</div>}
                {subGroups.map(({ subcat, items }) => (
                  <div key={subcat.id} className={`${bare.length ? 'mt-2' : ''} pl-2.5 border-l-2 border-gray-200/80 dark:border-gray-800`}>
                    <p className="flex items-center gap-1.5 text-[11.5px] font-medium text-gray-500 dark:text-gray-400 mb-1 px-0.5">
                      <span className="truncate">{subcat.name}</span>
                      <span className="count-pill">{items.length}</span>
                    </p>
                    <div className="space-y-1">{items.map(renderItem)}</div>
                  </div>
                ))}
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
