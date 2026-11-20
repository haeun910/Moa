import { useState } from 'react';
import type React from 'react';
import { GripVertical, Search, X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useApp } from '../context/AppContext';
import { placementLists } from '../lib/placement';
import type { PlanTab } from '../lib/placement';
import { groupTodosByCategory } from '../lib/todoGroups';
import type { Todo } from '../types';

interface Props {
  todayStr: string;
  tab: PlanTab;
  onTabChange: (tab: PlanTab) => void;
  pickedId: string | null;
  onPick: (todo: Todo) => void; // 누르면 고르기 (다시 누르면 풀기). 고른 다음 날짜 칸을 누르면 그 날로
  draggingId: string | null;
  onMouseDragStart: (e: React.PointerEvent, todo: Todo) => void;
  onTouchDragStart: (e: React.TouchEvent, todo: Todo) => void;
  consumeClick: () => boolean; // 끌어다 놓은 직후의 클릭은 고르기로 보지 않음
  onClose: () => void;
}

// 달력 오른쪽 "할 일 배치" 창: 저장소·밀린 할 일을 달력 날짜 칸으로 끌어다 놓거나, 누른 다음 날짜를 눌러 옮김.
// 컴퓨터·큰 태블릿(가로 1024px 이상)에서만 열림 (TodayPage)
export default function PlanPanel({
  todayStr, tab, onTabChange, pickedId, onPick, draggingId, onMouseDragStart, onTouchDragStart, consumeClick, onClose,
}: Props) {
  const { todos, categories, subcategories, settings } = useApp();
  const [query, setQuery] = useState('');
  const { storage, overdue, recurringOverdue } = placementLists(todos, todayStr, settings.hiddenCategoryIds);
  const source = tab === 'storage' ? storage : overdue;
  const q = query.trim().toLowerCase();
  const list = q ? source.filter(t => t.title.toLowerCase().includes(q)) : source;
  const groups = groupTodosByCategory(list, categories, subcategories);
  const picked = pickedId ? todos.find(t => t.id === pickedId) : undefined;

  function renderItem(todo: Todo) {
    const isPicked = todo.id === pickedId;
    const isDragging = todo.id === draggingId;
    return (
      <button
        key={todo.id}
        type="button"
        aria-pressed={isPicked}
        onClick={() => { if (!consumeClick()) onPick(todo); }}
        onPointerDown={e => onMouseDragStart(e, todo)}
        onTouchStart={e => onTouchDragStart(e, todo)}
        onContextMenu={e => e.preventDefault()}
        title="날짜 칸으로 끌어다 놓거나, 누른 다음 날짜를 누르세요"
        className={`group w-full flex items-center gap-1.5 pl-1 pr-2.5 py-2 rounded-lg text-left select-none [-webkit-touch-callout:none] cursor-grab transition-[box-shadow,background-color,opacity] ${
          isPicked
            ? 'bg-leaf-50 dark:bg-leaf-900/30 ring-2 ring-inset ring-leaf-500 dark:ring-leaf-400'
            : 'bg-white dark:bg-gray-900 ring-1 ring-inset ring-gray-200/80 dark:ring-gray-800 hover:ring-leaf-400 dark:hover:ring-leaf-600'
        } ${isDragging ? 'opacity-40' : ''}`}
      >
        <GripVertical size={14} className="flex-shrink-0 text-gray-300 dark:text-gray-600 group-hover:text-gray-400" aria-hidden="true" />
        <span className="flex-1 min-w-0 text-13px leading-snug text-gray-800 dark:text-gray-100 break-words">{todo.title}</span>
        {tab === 'overdue' && todo.date && (
          <span className="flex-shrink-0 text-11px tabular-nums text-amber-700 dark:text-amber-400" title="원래 날짜">
            {format(parseISO(todo.date), 'M/d (E)', { locale: ko })}
          </span>
        )}
        {todo.startTime && (
          <span className="flex-shrink-0 text-11px tabular-nums text-gray-400">{todo.startTime}</span>
        )}
      </button>
    );
  }

  const tabs: { value: PlanTab; label: string; count: number }[] = [
    { value: 'storage', label: '저장소', count: storage.length },
    { value: 'overdue', label: '밀린 할 일', count: overdue.length },
  ];

  return (
    <div role="region" className="flex-1 flex flex-col min-h-0" aria-label="할 일 배치">
      <div className="flex-shrink-0 px-6 pt-6 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">할 일 배치</h2>
            <p className="mt-1 text-12px leading-relaxed text-gray-500 dark:text-gray-400">
              날짜 칸으로 끌어다 놓거나, 할 일을 누른 다음 날짜를 누르세요
            </p>
          </div>
          <button onClick={onClose} aria-label="할 일 배치 닫기" title="닫기" className="btn-icon -mr-2 -mt-1">
            <X size={18} />
          </button>
        </div>

        <div className="mt-4 flex p-0.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-13px font-medium" role="tablist" aria-label="옮길 할 일">
          {tabs.map(({ value, label, count }) => (
            <button key={value} role="tab" aria-selected={tab === value} onClick={() => onTabChange(value)}
              className={`flex-1 h-8 rounded-md flex items-center justify-center gap-1.5 transition-all ${
                tab === value
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm font-semibold'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }`}>
              {label}
              <span className={`tabular-nums text-12px ${tab === value ? 'text-gray-500 dark:text-gray-300' : 'text-gray-400'}`}>{count}</span>
            </button>
          ))}
        </div>

        <label className="mt-2 flex items-center gap-2 h-8 px-2.5 rounded-lg bg-white dark:bg-gray-800/60 ring-1 ring-inset ring-gray-200 dark:ring-gray-700 focus-within:ring-2 focus-within:ring-leaf-500">
          <Search size={13} className="text-gray-400 flex-shrink-0" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="할 일 검색" aria-label="옮길 할 일 검색"
            className="flex-1 min-w-0 bg-transparent text-13px text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none" />
        </label>
      </div>

      {/* 고른 할 일: 이제 날짜를 누르면 됨 */}
      {picked && (
        <div className="flex-shrink-0 mx-6 mb-2 flex items-center gap-2 rounded-lg bg-leaf-600 dark:bg-leaf-500 text-white px-3 py-2 text-12px" role="status">
          <span className="flex-1 min-w-0"><span className="font-semibold">'{picked.title.length > 16 ? `${picked.title.slice(0, 16)}…` : picked.title}'</span> 놓을 날짜를 달력에서 누르세요</span>
          <button onClick={() => onPick(picked)} className="flex-shrink-0 font-semibold underline underline-offset-2">취소</button>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin px-6 pb-6">
        {list.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-13px text-gray-500 dark:text-gray-400">
              {q ? '찾는 할 일이 없어요' : tab === 'storage' ? '저장소가 비어 있어요' : '밀린 할 일이 없어요'}
            </p>
            {!q && tab === 'storage' && (
              <p className="mt-1 text-12px text-gray-400 dark:text-gray-500">날짜 없이 보관한 할 일이 여기에 보여요</p>
            )}
          </div>
        ) : (
          <div className="space-y-4 pt-1">
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
                    <p className="flex items-center gap-1.5 text-11.5px font-medium text-gray-500 dark:text-gray-400 mb-1 px-0.5">
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
        {tab === 'overdue' && recurringOverdue > 0 && (
          <p className="mt-4 text-11.5px leading-relaxed text-gray-400 dark:text-gray-500">
            반복 할 일 {recurringOverdue}개는 반복 규칙이 어긋나지 않게 여기서 옮기지 않아요. 위쪽 "밀린 일"에서 정리할 수 있어요.
          </p>
        )}
      </div>
    </div>
  );
}
