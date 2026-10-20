import { isMultiDay, scheduleOnDate } from '../lib/scheduleDates';
import { timeRangeLabel } from '../lib/timeRange';
import { useState } from 'react';
import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, Flag, Plus, Clock } from 'lucide-react';
import { format, addDays, subDays, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useApp } from '../context/AppContext';
import TodoModal from '../components/TodoModal';
import CategoryFilter from '../components/CategoryFilter';
import ScheduleModal from '../components/ScheduleModal';
import DDayModal from '../components/DDayModal';
import { todoDdays } from '../lib/agenda';
import type { DDay, ScheduleItem, Todo } from '../types';

const HOURS = Array.from({ length: 24 }, (_, i) => i);

function formatHour(h: number) {
  return `${String(h).padStart(2, '0')}:00`;
}

export default function CalendarPage() {
  const { todos, schedules, ddays, selectedDate, setSelectedDate, setCurrentScreen } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [editTodo, setEditTodo] = useState<Todo | undefined>();
  const [defaultTime, setDefaultTime] = useState<string | undefined>();
  const [activeCatId, setActiveCatId] = useState<string | null>(null);
  const [openSchedule, setOpenSchedule] = useState<ScheduleItem | null>(null);
  const [openDday, setOpenDday] = useState<DDay | null>(null);

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const dayTodos = todos.filter(t => t.date === selectedDate);
  const filtered = activeCatId ? dayTodos.filter(t => t.categoryId === activeCatId) : dayTodos;

  const allDayTodos = filtered.filter(t => !t.startTime);
  const timedTodos = filtered.filter(t => t.startTime).sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''));

  // 할 일뿐 아니라 그 날의 일정·D-Day도 같이 (카테고리 필터를 고르면 할 일만)
  const daySchedules = activeCatId ? [] : schedules.filter(sc => scheduleOnDate(sc, selectedDate))
    .sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''));
  const dayDdays = activeCatId ? [] : [...ddays, ...todoDdays(todos, todayStr)].filter(d => d.targetDate === selectedDate);
  // 여러 날에 걸친 일정은 하루 종일 칸에
  const allDaySchedules = daySchedules.filter(sc => !sc.startTime || isMultiDay(sc));
  const schedulesByHour: Record<number, ScheduleItem[]> = {};
  for (const sc of daySchedules) {
    if (!sc.startTime || isMultiDay(sc)) continue;
    const h = parseInt(sc.startTime.split(':')[0], 10);
    (schedulesByHour[h] ??= []).push(sc);
  }

  function openDdayItem(d: DDay) {
    const fromTodo = d.fromTodoId ? todos.find(t => t.id === d.fromTodoId) : undefined;
    if (fromTodo) openEdit(fromTodo);
    else setOpenDday(d);
  }

  // Group timed todos by hour
  const todosByHour: Record<number, Todo[]> = {};
  for (const t of timedTodos) {
    if (!t.startTime) continue;
    const h = parseInt(t.startTime.split(':')[0], 10);
    if (!todosByHour[h]) todosByHour[h] = [];
    todosByHour[h].push(t);
  }

  function openEdit(todo: Todo) { setEditTodo(todo); setShowModal(true); }
  function closeModal() { setShowModal(false); setEditTodo(undefined); setDefaultTime(undefined); }

  function openNewAtTime(hour: number) {
    setEditTodo(undefined);
    setDefaultTime(formatHour(hour));
    setShowModal(true);
  }

  const dateObj = parseISO(selectedDate);

  return (
    <div className="flex flex-col h-screen pb-[62px] lg:pb-0 max-w-3xl mx-auto w-full">
      {/* Date nav */}
      <div className="flex-shrink-0 px-4 lg:px-8 pt-6 sm:pt-8 pb-4 border-b border-gray-200/80 dark:border-gray-800">
        <div className="flex items-center gap-1 mb-1 -ml-1.5">
          <button onClick={() => setCurrentScreen('month')} aria-label="달력으로 돌아가기"
            className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <ArrowLeft size={17} />
          </button>
          <span className="text-[13px] font-medium text-gray-500 dark:text-gray-400">시간표</span>
        </div>
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => setSelectedDate(format(subDays(dateObj, 1), 'yyyy-MM-dd'))} aria-label="전날"
            className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <ChevronLeft size={18} />
          </button>

          <div className="text-center">
            <p className="text-xl font-bold tracking-[-0.03em] tabular-nums text-gray-900 dark:text-white">
              {format(dateObj, 'M월 d일', { locale: ko })}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {format(dateObj, 'EEEE', { locale: ko })}
              {selectedDate === todayStr && <span className="ml-1.5 text-leaf-600 dark:text-leaf-400 font-semibold">오늘</span>}
            </p>
          </div>

          <button onClick={() => setSelectedDate(format(addDays(dateObj, 1), 'yyyy-MM-dd'))} aria-label="다음날"
            className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <ChevronRight size={18} />
          </button>
        </div>

        {selectedDate !== todayStr && (
          <div className="flex justify-center">
            <button
              onClick={() => setSelectedDate(todayStr)}
              className="btn-secondary h-7 px-3 text-xs"
            >
              오늘로 이동
            </button>
          </div>
        )}

        {/* Category filter */}
        <div className="mt-2">
          <CategoryFilter activeCatId={activeCatId} onChange={setActiveCatId} />
        </div>
      </div>

      {/* Schedule body */}
      <div className="flex-1 overflow-y-auto">
        {/* All-day section */}
        {(allDayTodos.length > 0 || allDaySchedules.length > 0 || dayDdays.length > 0) && (
          <div className="border-b border-gray-200/80 dark:border-gray-800 px-4 lg:px-8 py-3">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">하루 종일</p>
            <div className="space-y-1.5">
              {dayDdays.map(d => (
                <button key={`dday-${d.id}`} onClick={() => openDdayItem(d)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left bg-rose-50 dark:bg-rose-900/25 text-rose-700 dark:text-rose-300">
                  <Flag size={13} className="flex-shrink-0" />
                  <span className="text-sm flex-1 truncate">{d.title}</span>
                  <span className="text-[11px] font-semibold">D-Day</span>
                </button>
              ))}
              {allDaySchedules.map(sc => (
                <ScheduleChip key={sc.id} schedule={sc} onOpen={setOpenSchedule} />
              ))}
              {allDayTodos.map(todo => (
                <AllDayTodoChip key={todo.id} todo={todo} onEdit={openEdit} />
              ))}
            </div>
          </div>
        )}

        {/* Hourly rows */}
        <div className="relative">
          {HOURS.map(h => (
            <div key={h} className="flex border-b border-gray-200/60 dark:border-gray-800 min-h-[56px] group lg:px-4">
              {/* Time label */}
              <div className="w-14 flex-shrink-0 pt-1 pr-2 text-right">
                <span className="text-[11px] text-gray-400 dark:text-gray-500 tabular-nums">
                  {formatHour(h)}
                </span>
              </div>

              {/* Slot */}
              <div
                className="flex-1 pl-2 pt-1 pb-1 relative cursor-pointer hover:bg-leaf-50/50 dark:hover:bg-leaf-900/10 transition-colors"
                onClick={() => openNewAtTime(h)}
              >
                {(schedulesByHour[h] ?? []).map(sc => (
                  <div key={sc.id} className="mb-1" onClick={e => e.stopPropagation()}>
                    <ScheduleChip schedule={sc} onOpen={setOpenSchedule} />
                  </div>
                ))}
                {(todosByHour[h] ?? []).map(todo => (
                  <TimeSlotTodo key={todo.id} todo={todo} onEdit={e => { e.stopPropagation(); openEdit(todo); }} />
                ))}
                {/* Add hint */}
                {!(todosByHour[h]?.length) && !(schedulesByHour[h]?.length) && (
                  <span className="absolute inset-0 flex items-center pl-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Plus size={12} className="text-leaf-600 mr-1" />
                    <span className="text-[11px] font-medium text-leaf-600">추가</span>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* FAB */}
      <button
        onClick={() => { setEditTodo(undefined); setDefaultTime(undefined); setShowModal(true); }}
        aria-label="할 일 추가"
        className="fixed bottom-20 lg:bottom-8 right-6 lg:right-8 w-14 h-14 rounded-2xl btn-primary shadow-lg shadow-leaf-900/20"
      >
        <Plus size={24} />
      </button>

      {openSchedule && <ScheduleModal schedule={openSchedule} onClose={() => setOpenSchedule(null)} />}
      {openDday && <DDayModal dday={openDday} onClose={() => setOpenDday(null)} />}
      {showModal && (
        <TodoModal
          todo={editTodo}
          defaultDate={selectedDate}
          defaultTime={defaultTime}
          onClose={closeModal}
        />
      )}
    </div>
  );
}

function AllDayTodoChip({ todo, onEdit }: { todo: Todo; onEdit: (t: Todo) => void }) {
  const { toggleTodo, categories } = useApp();
  const cat = categories.find(c => c.id === todo.categoryId);
  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all ${
        todo.completed
          ? 'bg-gray-50 dark:bg-gray-900 border-gray-100 dark:border-gray-800'
          : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 shadow-sm hover:border-gray-300 dark:hover:border-gray-600'
      }`}
      onClick={() => onEdit(todo)}
    >
      <button
        onClick={e => { e.stopPropagation(); toggleTodo(todo.id); }}
        className={`flex-shrink-0 w-4 h-4 rounded-[5px] border-[1.5px] flex items-center justify-center transition-all ${
          todo.completed ? 'bg-leaf-600 border-leaf-600' : 'border-gray-300 dark:border-gray-600'
        }`}
      >
        {todo.completed && (
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
            <path d="M1 4l2 2 4-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
      {cat && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />}
      <span className={`text-sm flex-1 ${todo.completed ? 'line-through text-gray-400' : 'text-gray-800 dark:text-gray-100'}`}>
        {todo.title}
      </span>
    </div>
  );
}

function TimeSlotTodo({ todo, onEdit }: { todo: Todo; onEdit: (e: React.MouseEvent) => void }) {
  const { toggleTodo, categories } = useApp();
  const cat = categories.find(c => c.id === todo.categoryId);
  const color = cat?.color ?? '#86A03F';
  return (
    <div
      className="flex items-center gap-2 mb-1 px-2 py-1.5 rounded-lg cursor-pointer transition-all hover:opacity-80"
      style={{ backgroundColor: color + '18', borderLeft: `3px solid ${color}` }}
      onClick={onEdit}
    >
      <button
        onClick={e => { e.stopPropagation(); toggleTodo(todo.id); }}
        className={`flex-shrink-0 w-4 h-4 rounded-[5px] border-[1.5px] flex items-center justify-center transition-all ${
          todo.completed ? 'bg-leaf-600 border-leaf-600' : 'border-gray-400'
        }`}
        style={!todo.completed ? { borderColor: color } : {}}
      >
        {todo.completed && (
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
            <path d="M1 4l2 2 4-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-medium truncate ${todo.completed ? 'line-through text-gray-400' : 'text-gray-800 dark:text-gray-100'}`}>
          {todo.title}
        </p>
        {todo.startTime && (
          <p className="flex items-center gap-0.5 text-[10px] text-gray-500 dark:text-gray-400">
            <Clock size={9} />
            {timeRangeLabel(todo.startTime, todo.endTime)}
          </p>
        )}
      </div>
    </div>
  );
}

function ScheduleChip({ schedule, onOpen }: { schedule: ScheduleItem; onOpen: (s: ScheduleItem) => void }) {
  return (
    <button onClick={() => onOpen(schedule)}
      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left bg-blue-50 dark:bg-blue-900/25 border-l-[3px] border-blue-500">
      <CalendarDays size={13} className="flex-shrink-0 text-blue-600 dark:text-blue-300" />
      <span className="text-xs font-medium flex-1 truncate text-gray-800 dark:text-gray-100">{schedule.title}</span>
      {schedule.startTime && !isMultiDay(schedule) && <span className="text-[10px] tabular-nums text-gray-500 dark:text-gray-400">{timeRangeLabel(schedule.startTime, schedule.endTime)}</span>}
    </button>
  );
}
