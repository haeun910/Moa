import { useState } from 'react';
import { X, ChevronLeft, ChevronRight, Check, Plus, Send } from 'lucide-react';
import {
  format, startOfWeek, endOfWeek, eachDayOfInterval,
  addWeeks, subWeeks, isToday as dateFnsIsToday,
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { useApp } from '../context/AppContext';
import { LIMITS } from '../lib/limits';

export default function WeeklyModal({ onClose }: { onClose: () => void }) {
  const { todos, toggleTodo, addTodo } = useApp();
  const [weekRef, setWeekRef] = useState(new Date());
  const [addingDate, setAddingDate] = useState<string | null>(null);
  const [addTitle, setAddTitle] = useState('');

  const start = startOfWeek(weekRef, { weekStartsOn: 0 });
  const end = endOfWeek(weekRef, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start, end });

  const DAY_EN = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  const weekLabel = `${format(start, 'yy.MM.dd(EEE)', { locale: ko })} - ${format(end, 'yy.MM.dd(EEE)', { locale: ko })}`;

  async function handleAdd(dateStr: string) {
    const title = addTitle.trim();
    if (!title) { setAddingDate(null); return; }
    await addTodo({ title, completed: false, categoryId: null, subcategoryId: null, date: dateStr, startTime: null, notes: '' });
    setAddTitle('');
    setAddingDate(null);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-panel max-w-5xl"
        style={{ maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-7 pt-6 pb-4 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold tracking-[-0.03em] text-gray-900 dark:text-white">주간 기록</h2>
            <div className="flex items-center gap-2 mt-1">
              <button onClick={() => setWeekRef(w => subWeeks(w, 1))} aria-label="이전 주"
                className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-700">
                <ChevronLeft size={15} />
              </button>
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{weekLabel}</span>
              <button onClick={() => setWeekRef(w => addWeeks(w, 1))} aria-label="다음 주"
                className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-700">
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
          <button onClick={onClose} aria-label="닫기"
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
            <X size={18} />
          </button>
        </div>

        {/* Weekly grid */}
        <div className="flex-1 overflow-auto px-7 py-5">
          <div className="grid grid-cols-7 gap-3 min-h-[400px]">
            {days.map(day => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const dayTodos = todos.filter(t => t.date === dateStr);
              const completed = dayTodos.filter(t => t.completed).length;
              const dow = day.getDay();
              const isToday = dateFnsIsToday(day);

              return (
                <div key={dateStr}
                  className={`flex flex-col rounded-xl p-3 ${
                    isToday
                      ? 'bg-leaf-50 dark:bg-leaf-900/20 ring-2 ring-leaf-400'
                      : 'bg-gray-50 dark:bg-gray-800/40'
                  }`}
                >
                  {/* Day header */}
                  <div className="text-center mb-3 flex-shrink-0">
                    <p className={`text-[10px] font-bold tracking-wide ${
                      dow === 0 ? 'text-red-500' : dow === 6 ? 'text-leaf-500' : 'text-gray-400 dark:text-gray-500'
                    }`}>{DAY_EN[dow]}</p>
                    <p className={`text-xl font-bold leading-tight ${
                      isToday ? 'text-leaf-600'
                      : dow === 0 ? 'text-red-500'
                      : dow === 6 ? 'text-leaf-500'
                      : 'text-gray-800 dark:text-gray-100'
                    }`}>{format(day, 'd')}</p>
                    {dayTodos.length > 0 && (
                      <p className="text-[10px] text-gray-400 mt-0.5">{completed}/{dayTodos.length}</p>
                    )}
                  </div>

                  {/* Todos */}
                  <div className="flex-1 space-y-1.5 overflow-y-auto">
                    {dayTodos.map(todo => (
                      <div key={todo.id}
                        className="flex items-start gap-1.5 cursor-pointer group"
                        onClick={() => toggleTodo(todo.id)}
                      >
                        <div className={`flex-shrink-0 mt-0.5 w-3.5 h-3.5 rounded border-2 flex items-center justify-center transition-colors ${
                          todo.completed ? 'bg-leaf-600 border-leaf-600' : 'border-gray-300 dark:border-gray-600 group-hover:border-leaf-400'
                        }`}>
                          {todo.completed && <Check size={7} className="text-white" strokeWidth={3} />}
                        </div>
                        <span className={`text-[11px] leading-snug break-words ${
                          todo.completed ? 'line-through text-gray-300 dark:text-gray-600' : 'text-gray-700 dark:text-gray-300'
                        }`}>{todo.title}</span>
                      </div>
                    ))}
                  </div>

                  {/* Add button */}
                  {addingDate === dateStr ? (
                    <div className="mt-2 flex items-center gap-1 flex-shrink-0">
                      <input maxLength={LIMITS.title}
                        autoFocus
                        value={addTitle}
                        onChange={e => setAddTitle(e.target.value)}
                        placeholder="할 일..."
                        className="flex-1 text-[11px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-leaf-400"
                        onKeyDown={e => { if (e.key === 'Enter') handleAdd(dateStr); if (e.key === 'Escape') { setAddingDate(null); setAddTitle(''); } }}
                        onBlur={() => { if (!addTitle.trim()) setAddingDate(null); }}
                      />
                      <button onClick={() => handleAdd(dateStr)} aria-label="추가"
                        className="w-6 h-6 rounded-md bg-leaf-600 flex items-center justify-center text-white flex-shrink-0">
                        <Send size={9} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setAddingDate(dateStr); setAddTitle(''); }}
                      className="mt-2 w-full flex items-center justify-center gap-1 text-[10px] text-gray-300 dark:text-gray-600 hover:text-leaf-500 dark:hover:text-leaf-400 transition-colors flex-shrink-0 py-1"
                    >
                      <Plus size={11} />
                      추가
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
