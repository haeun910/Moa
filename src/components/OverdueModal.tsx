import { useState } from 'react';
import { X, AlertCircle, CalendarCheck } from 'lucide-react';
import { format, parseISO, differenceInCalendarDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useApp } from '../context/AppContext';
import TodoList from './TodoList';
import type { Todo } from '../types';

interface Props {
  todos: Todo[]; // 지난 날짜에 잡혀 있는데 아직 완료하지 못한 할 일
  onEdit: (todo: Todo) => void;
  getActions: (todo: Todo) => React.ReactNode;
  onClose: () => void;
}

// 지난 날짜의 미완료 할 일을 날짜별로 모아서 보여주고, 오늘로 옮기거나 저장소로 돌려보낼 수 있게 함
export default function OverdueModal({ todos, onEdit, getActions, onClose }: Props) {
  const { updateTodo } = useApp();
  const [movingAll, setMovingAll] = useState(false);
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const dates = Array.from(new Set(todos.map(t => t.date as string))).sort();

  async function moveAllToToday() {
    if (movingAll) return;
    setMovingAll(true);
    try {
      for (const t of todos) await updateTodo(t.id, { date: todayStr });
    } finally {
      setMovingAll(false);
    }
  }

  function handleBackdrop(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div
      className="modal-overlay"
      onClick={handleBackdrop}
    >
      <div className="modal-panel max-w-lg">
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-gray-100 dark:border-gray-800">
          <div>
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="text-amber-500" />
              <h2 className="text-base font-bold text-gray-900 dark:text-white">미완료 할 일</h2>
              <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 dark:bg-amber-900/30 px-1.5 py-0.5 rounded-full">{todos.length}</span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">지난 날짜에 잡혀 있었지만 아직 끝내지 못한 할 일이에요</p>
          </div>
          <button onClick={onClose} aria-label="닫기"
            className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {todos.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-gray-400">밀린 할 일이 없어요</p>
              <p className="text-xs text-gray-300 dark:text-gray-600 mt-1">지난 날짜의 할 일을 모두 끝냈어요</p>
            </div>
          ) : dates.map(date => {
            const dateTodos = todos.filter(t => t.date === date);
            const daysAgo = differenceInCalendarDays(parseISO(todayStr), parseISO(date));
            return (
              <div key={date}>
                <div className="flex items-center gap-2 mb-1.5 px-1">
                  <span className="text-xs font-bold text-gray-600 dark:text-gray-300">
                    {format(parseISO(date), 'M월 d일 (EEE)', { locale: ko })}
                  </span>
                  <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">{daysAgo}일 지남</span>
                </div>
                <TodoList todos={dateTodos} onEdit={onEdit} getActions={getActions} />
              </div>
            );
          })}
        </div>

        {todos.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800">
            <button
              onClick={moveAllToToday}
              disabled={movingAll}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-leaf-600 hover:bg-leaf-700 disabled:opacity-40 text-white text-sm font-semibold transition-colors"
            >
              <CalendarCheck size={15} />
              {movingAll ? '옮기는 중...' : `모두 오늘로 옮기기 (${todos.length}개)`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
