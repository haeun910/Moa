import { useState } from 'react';
import type React from 'react';
import { Plus, ChevronLeft, ChevronRight, X, Check, Flag, Trash2, BarChart3, Clock10, Megaphone, Undo2, CalendarDays, CalendarClock, Link2, Target, AlertCircle, CalendarCheck, Repeat } from 'lucide-react';
import AchievementModal from '../components/AchievementModal';
import NoticeModal from '../components/NoticeModal';
import GoalModal from '../components/GoalModal';
import DDayModal from '../components/DDayModal';
import DDayListModal from '../components/DDayListModal';
import ScheduleModal from '../components/ScheduleModal';
import OverdueModal from '../components/OverdueModal';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  startOfWeek, endOfWeek, isSameMonth, addMonths, subMonths, parseISO,
  differenceInCalendarDays, addWeeks, subWeeks, isToday as dateFnsIsToday,
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { useApp } from '../context/AppContext';
import { applyListDisplaySettings } from '../lib/listDisplay';
import TodoList from '../components/TodoList';
import TodoModal from '../components/TodoModal';
import DayTodoComposer from '../components/DayTodoComposer';
import type { Todo, DDay, ScheduleItem, Settings, MonthlyGoal } from '../types';

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

// 설정 > 달력 표시에서 고른 글자 크기에 맞춰 달력 칸의 일정 칩 스타일을 정함.
// 글자가 커질수록 칸 하나에 다 들어가는 칩 개수는 줄이고 칸 높이를 늘림.
const CALENDAR_CHIP_STYLES: Record<Settings['calendarTextSize'], { chip: string; cellMinH: string; maxChips: number; icon: number }> = {
  small: { chip: 'text-[9px] md:text-[9px]', cellMinH: 'min-h-[82px]', maxChips: 4, icon: 7 },
  medium: { chip: 'text-[11px] md:text-[10.5px]', cellMinH: 'min-h-[96px]', maxChips: 3, icon: 8 },
  large: { chip: 'text-[13px] md:text-[12px]', cellMinH: 'min-h-[112px]', maxChips: 2, icon: 9 },
};

// 일요일/토요일 글자색 (달력 숫자, 요일 머리글 공통)
function weekdayTone(dow: number) {
  if (dow === 0) return 'text-red-500 dark:text-red-400';
  if (dow === 6) return 'text-blue-500 dark:text-blue-400';
  return 'text-gray-700 dark:text-gray-200';
}

// 특정 날짜로 옮기는 작은 팝오버 버튼 (저장소로 보내기와 짝을 이루는, 홈 화면 전용 액션)
function MoveToDateButton({ todo, onMove }: { todo: Todo; onMove: (date: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative" onClick={e => e.stopPropagation()}>
      <button onClick={() => setOpen(v => !v)} className="row-action" title="다른 날짜로 옮기기">
        <CalendarDays size={11} />
        날짜 변경
      </button>
      {open && (
        <input
          type="date"
          autoFocus
          defaultValue={todo.date ?? ''}
          className="absolute left-0 top-full mt-1 z-20 text-xs px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 shadow-lg focus:outline-none focus:ring-2 focus:ring-leaf-500/25 focus:border-leaf-500"
          onChange={e => { if (e.target.value) onMove(e.target.value); setOpen(false); }}
          onBlur={() => setOpen(false)}
        />
      )}
    </div>
  );
}

// 상단 요약 띠의 한 칸 (목표 / D-Day / 일정)
function OverviewColumn({
  icon, title, onTitleClick, titleHint, meta, onAdd, addLabel, emptyText, isEmpty, children,
}: {
  icon: React.ReactNode;
  title: string;
  onTitleClick?: () => void;
  titleHint?: string;
  meta?: React.ReactNode;
  onAdd: () => void;
  addLabel: string;
  emptyText: string;
  isEmpty: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-w-0 px-4 pt-3.5 pb-3 md:h-[156px]">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          {icon}
          {onTitleClick ? (
            <button onClick={onTitleClick} title={titleHint}
              className="text-[13px] font-semibold text-gray-900 dark:text-white hover:text-leaf-700 dark:hover:text-leaf-300 transition-colors">
              {title}
            </button>
          ) : (
            <span className="text-[13px] font-semibold text-gray-900 dark:text-white">{title}</span>
          )}
          {meta}
        </div>
        <button onClick={onAdd} aria-label={addLabel} title={addLabel} className="btn-icon w-7 h-7 -mr-1.5">
          <Plus size={15} />
        </button>
      </div>
      <div className="flex-1 space-y-1 overflow-y-auto scrollbar-thin -mx-1 px-1">
        {isEmpty ? (
          <button onClick={onAdd} className="w-full text-left text-[13px] text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 py-1 transition-colors">
            {emptyText}
          </button>
        ) : children}
      </div>
    </div>
  );
}

export default function TodayPage() {
  const {
    todos, categories, subcategories, settings, addTodo, updateTodo, toggleTodo, selectedDate, setSelectedDate,
    monthlyGoals, toggleMonthlyGoal, deleteMonthlyGoal,
    ddays, deleteDDay, schedules, deleteSchedule, notices, setCurrentScreen,
  } = useApp();

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const [viewMonth, setViewMonth] = useState(new Date());

  // 달력 월 기준 목표 / 일정
  const currentMonth = format(viewMonth, 'yyyy-MM');
  const monthGoals = monthlyGoals.filter(g => g.month === currentMonth);
  const completedGoals = monthGoals.filter(g => g.completed).length;
  const monthSchedules = schedules.filter(s => s.date.startsWith(currentMonth));

  const [showModal, setShowModal] = useState(false);
  const [editTodo, setEditTodo] = useState<Todo | undefined>();
  const [panelOpen, setPanelOpen] = useState(false);
  // 날짜 패널 입력창에서 상세 옵션으로 넘어갈 때 고른 카테고리/하위카테고리를 모달 기본값으로 전달
  const [newTodoDefaults, setNewTodoDefaults] = useState<{ categoryId: string | null; subcategoryId: string | null; title: string }>({ categoryId: null, subcategoryId: null, title: '' });

  const [goalModalState, setGoalModalState] = useState<{ goal?: MonthlyGoal } | null>(null);
  const [ddayModalState, setDdayModalState] = useState<{ dday?: DDay } | null>(null);
  const [showDdayListModal, setShowDdayListModal] = useState(false);
  const [scheduleModalState, setScheduleModalState] = useState<{ schedule?: ScheduleItem; defaultDate?: string } | null>(null);
  const [calView, setCalView] = useState<'month' | 'week'>('month');
  const [weekRef, setWeekRef] = useState(new Date());
  const [weekAddDate, setWeekAddDate] = useState<string | null>(null);
  const [weekAddTitle, setWeekAddTitle] = useState('');
  const [showAchievement, setShowAchievement] = useState(false);
  const [showNotice, setShowNotice] = useState(false);
  const [showOverdue, setShowOverdue] = useState(false);
  const [lastSeenNotice, setLastSeenNotice] = useState(() => localStorage.getItem('notice-last-seen') ?? '');
  const hasUnreadNotice = notices.length > 0 && notices[0].createdAt !== lastSeenNotice;

  function openNotice() {
    setShowNotice(true);
    if (notices[0]) {
      localStorage.setItem('notice-last-seen', notices[0].createdAt);
      setLastSeenNotice(notices[0].createdAt);
    }
  }

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(viewMonth)),
    end: endOfWeek(endOfMonth(viewMonth)),
  });
  const weekCount = Math.ceil(days.length / 7);
  const chipStyle = CALENDAR_CHIP_STYLES[settings.calendarTextSize];

  // 달력 칸/D-Day 계산은 전체 todos를 그대로 쓰고, 아래 목록(패널)에만 설정의
  // "목록 표시" 옵션(정렬/완료 숨기기/카테고리 표시 여부)을 적용
  const selectedTodos = applyListDisplaySettings(todos.filter(t => t.date === selectedDate), settings);
  const selectedDoneCount = selectedTodos.filter(t => t.completed).length;

  // 선택한 날의 할 일을 카테고리별로 묶어서 목록 사이에 카테고리 이름이 끼어들도록 함
  const dayGroups = [
    ...categories.map(cat => ({ cat, groupTodos: selectedTodos.filter(t => t.categoryId === cat.id) })),
    { cat: null, groupTodos: selectedTodos.filter(t => !t.categoryId) },
  ].filter(g => g.groupTodos.length > 0);
  const selectedSchedules = schedules.filter(s => s.date === selectedDate);
  // 지난 날짜에 잡혀 있는데 아직 완료하지 못한 할 일 (미완료 모아보기)
  const overdueTodos = todos.filter(t => t.date && t.date < todayStr && !t.completed);

  function handleDayClick(dateStr: string) {
    if (selectedDate === dateStr && panelOpen) setPanelOpen(false);
    else { setSelectedDate(dateStr); setPanelOpen(true); }
  }

  function openEdit(todo: Todo) { setEditTodo(todo); setShowModal(true); }
  function closeModal() { setShowModal(false); setEditTodo(undefined); }
  function openNewTodoDetail(categoryId: string | null, subcategoryId: string | null, title: string) {
    setNewTodoDefaults({ categoryId, subcategoryId, title });
    setEditTodo(undefined);
    setShowModal(true);
  }

  function ddayLabel(targetDate: string): string {
    const diff = differenceInCalendarDays(parseISO(targetDate), new Date());
    if (diff === 0) return 'D-Day';
    if (diff > 0) return `D-${diff}`;
    return `D+${Math.abs(diff)}`;
  }

  // 할 일에 "D-Day로 표시" 체크를 하면 여기서 가상 D-Day로 합쳐져서 항상 자동으로 동기화됨
  // (마감일이 있으면 마감일, 없으면 작업 날짜를 기준일로 사용)
  const todoDdays: DDay[] = todos
    .filter(t => t.isDday && (t.dueDate || t.date))
    .map(t => ({ id: `todo-${t.id}`, title: t.title, targetDate: (t.dueDate || t.date) as string, fromTodoId: t.id }));
  const allDdays = [...ddays, ...todoDdays].sort((a, b) => a.targetDate.localeCompare(b.targetDate));
  // 위쪽 위젯에는 지나간 D-Day는 숨기고, "D-Day" 제목을 누르면 지나간 것까지 전체를 보여줌
  const upcomingDdays = allDdays.filter(d => differenceInCalendarDays(parseISO(d.targetDate), new Date()) >= 0);
  // 선택한 날이 기준일인 D-Day (날짜 패널의 할 일 목록 맨 위에 일정과 함께 보여줌)
  const selectedDdays = allDdays.filter(d => d.targetDate === selectedDate);

  // 할 일에서 연동된 D-Day는 원래 할 일 편집 화면으로, 직접 만든 D-Day는 D-Day 수정 화면으로
  function openDday(d: DDay) {
    if (d.fromTodoId) {
      const todo = todos.find(t => t.id === d.fromTodoId);
      if (todo) openEdit(todo);
    } else {
      setDdayModalState({ dday: d });
    }
  }

  async function removeDday(d: DDay) {
    if (d.fromTodoId) await updateTodo(d.fromTodoId, { isDday: false });
    else await deleteDDay(d.id);
  }

  // 홈 화면에서: 저장소로 다시 보내거나 다른 날짜로 옮기기
  function getTodoActions(todo: Todo) {
    return (
      <>
        <button
          onClick={e => { e.stopPropagation(); updateTodo(todo.id, { date: null }); }}
          className="row-action"
          title="저장소로 다시 보내기 (날짜 없이 보관)"
        >
          <Undo2 size={11} />
          저장소로
        </button>
        <MoveToDateButton todo={todo} onMove={date => updateTodo(todo.id, { date })} />
      </>
    );
  }

  // 미완료 모아보기에서는 "오늘로" 버튼을 맨 앞에 추가
  function getOverdueActions(todo: Todo) {
    return (
      <>
        <button
          onClick={e => { e.stopPropagation(); updateTodo(todo.id, { date: todayStr }); }}
          className="row-action !bg-leaf-50 !text-leaf-700 hover:!bg-leaf-100 dark:!bg-leaf-900/30 dark:!text-leaf-300 dark:hover:!bg-leaf-900/60"
          title="오늘 할 일로 옮기기"
        >
          <CalendarCheck size={11} />
          오늘로
        </button>
        {getTodoActions(todo)}
      </>
    );
  }

  // 선택한 날의 할 일을 카테고리별로 나눠서 보여줌 (카테고리 이름이 목록 사이에 끼워짐)
  function renderDayGroups() {
    if (selectedTodos.length === 0 && selectedSchedules.length === 0 && selectedDdays.length === 0) {
      return (
        <div className="flex flex-col items-center text-center pt-14">
          <div className="w-11 h-11 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
            <Check size={20} className="text-gray-400" />
          </div>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-300">이 날은 비어 있어요</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">아래 입력창에 할 일을 적고 Enter를 누르세요</p>
        </div>
      );
    }
    return (
      <div className="space-y-5">
        {selectedDdays.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-2 px-0.5">
              <Flag size={13} className="text-leaf-600 dark:text-leaf-400 flex-shrink-0" />
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">D-Day</span>
              <span className="count-pill">{selectedDdays.length}</span>
            </div>
            <div className="rounded-xl surface divide-y divide-gray-100 dark:divide-gray-800/80">
              {selectedDdays.map(d => (
                <div
                  key={d.id}
                  onClick={() => openDday(d)}
                  className="flex items-center gap-3 px-3 py-2.5 cursor-pointer group first:rounded-t-xl last:rounded-b-xl hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors"
                >
                  <span className="w-1 self-stretch rounded-full bg-leaf-500 flex-shrink-0" />
                  <span className="flex-shrink-0 min-w-[44px] text-xs font-bold tabular-nums text-leaf-700 dark:text-leaf-300">{ddayLabel(d.targetDate)}</span>
                  <span className="flex-1 min-w-0 text-sm text-gray-900 dark:text-gray-100 truncate">{d.title}</span>
                  {d.fromTodoId && (
                    <span title="할 일에서 연동됨" className="flex-shrink-0 text-gray-300 dark:text-gray-600">
                      <Link2 size={12} />
                    </span>
                  )}
                  <button
                    onClick={e => { e.stopPropagation(); removeDday(d); }}
                    aria-label="D-Day 삭제"
                    className="flex-shrink-0 opacity-60 md:opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600 transition-all"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}
        {selectedSchedules.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-2 px-0.5">
              <CalendarClock size={13} className="text-blue-500 flex-shrink-0" />
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">일정</span>
              <span className="count-pill">{selectedSchedules.length}</span>
            </div>
            <div className="rounded-xl surface divide-y divide-gray-100 dark:divide-gray-800/80">
              {selectedSchedules.map(s => (
                <div
                  key={s.id}
                  onClick={() => setScheduleModalState({ schedule: s })}
                  className="flex items-center gap-3 px-3 py-2.5 cursor-pointer group first:rounded-t-xl last:rounded-b-xl hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors"
                >
                  <span className="w-1 self-stretch rounded-full bg-blue-400 flex-shrink-0" />
                  <span className="flex-shrink-0 w-11 text-xs font-semibold tabular-nums text-blue-600 dark:text-blue-300">{s.startTime ?? '종일'}</span>
                  <span className="flex-1 min-w-0 text-sm text-gray-900 dark:text-gray-100 truncate">{s.title}</span>
                  {s.seriesId && <Repeat size={12} className="flex-shrink-0 text-blue-300 dark:text-blue-700" aria-label="반복 일정" />}
                  <button
                    onClick={e => { e.stopPropagation(); deleteSchedule(s.id); }}
                    aria-label="일정 삭제"
                    className="flex-shrink-0 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600 transition-all"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}
        {dayGroups.map(({ cat, groupTodos }) => {
          // 카테고리 안에서 다시 하위카테고리별로 나눔 (저장소에서 완료 체크해 오늘로 넘어온
          // 항목도 하위카테고리가 그대로 보이도록). 하위카테고리가 없는 항목은 그대로 위에 나열.
          const bareTodos = cat ? groupTodos.filter(t => !t.subcategoryId) : groupTodos;
          const subGroups = cat
            ? subcategories
                .filter(sc => sc.categoryId === cat.id)
                .map(sc => ({ subcat: sc, subTodos: groupTodos.filter(t => t.subcategoryId === sc.id) }))
                .filter(g => g.subTodos.length > 0)
            : [];
          return (
            <section key={cat?.id ?? '__none__'}>
              <div className="flex items-center gap-2 mb-2 px-0.5">
                {cat ? (
                  <>
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">{cat.name}</span>
                  </>
                ) : (
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">분류 없음</span>
                )}
                <span className="count-pill">{groupTodos.length}</span>
              </div>
              <TodoList todos={bareTodos} onEdit={openEdit} getActions={getTodoActions} />
              {subGroups.map(({ subcat, subTodos }) => (
                <div key={subcat.id} className={`${bareTodos.length ? 'mt-3' : ''} pl-3 border-l-2 border-gray-200/80 dark:border-gray-800`}>
                  <p className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 px-0.5">
                    {subcat.name}
                    <span className="count-pill">{subTodos.length}</span>
                  </p>
                  <TodoList todos={subTodos} onEdit={openEdit} getActions={getTodoActions} />
                </div>
              ))}
            </section>
          );
        })}
      </div>
    );
  }

  // 선택한 날 패널의 머리글 (데스크톱/모바일 공통)
  function renderPanelHeader(compact: boolean) {
    const pct = selectedTodos.length ? Math.round((selectedDoneCount / selectedTodos.length) * 100) : 0;
    const isTodaySelected = selectedDate === todayStr;
    return (
      <div className={compact ? 'px-4 pt-4 pb-3 flex-shrink-0' : 'px-6 pt-6 pb-4 flex-shrink-0'}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
              {format(parseISO(selectedDate), 'EEEE', { locale: ko })}
              {isTodaySelected && <span className="ml-1.5 text-leaf-600 dark:text-leaf-400 font-semibold">오늘</span>}
            </p>
            <h2 className={`${compact ? 'text-lg' : 'text-[22px]'} font-bold tracking-[-0.03em] text-gray-900 dark:text-white tabular-nums mt-0.5`}>
              {format(parseISO(selectedDate), 'M월 d일', { locale: ko })}
            </h2>
          </div>
          <div className="flex items-center gap-0.5 -mr-1.5">
            <button onClick={() => setScheduleModalState({ defaultDate: selectedDate })} aria-label="일정 추가" title="일정 추가" className="btn-icon">
              <CalendarClock size={16} />
            </button>
            <button onClick={() => setCurrentScreen('calendar')} aria-label="시간표 보기" title="시간표 보기" className="btn-icon">
              <Clock10 size={16} />
            </button>
            <button onClick={() => setPanelOpen(false)} aria-label="닫기" title="닫기" className="btn-icon">
              <X size={17} />
            </button>
          </div>
        </div>
        {selectedTodos.length > 0 && (
          <div className="flex items-center gap-3 mt-3">
            <div className="flex-1 h-1 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
              <div className="h-full rounded-full bg-leaf-500 transition-[width] duration-500" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400">
              <span className="font-semibold text-gray-800 dark:text-gray-200">{selectedDoneCount}</span> / {selectedTodos.length} 완료
            </span>
          </div>
        )}
      </div>
    );
  }

  function renderQuickAdd() {
    return <DayTodoComposer date={selectedDate} onOpenDetail={openNewTodoDetail} />;
  }

  const navBtn = 'btn-icon w-8 h-8';

  return (
    <div className="min-h-screen h-auto overflow-y-auto md:h-screen md:overflow-hidden pb-[62px] lg:pb-0 flex flex-col lg:flex-row">

      {/* ── 달력 + 요약 영역 (모바일은 화면에 억지로 끼워 맞추지 않고 자연스럽게 스크롤) ── */}
      {/* 노트북처럼 화면 세로 길이가 짧을 때 목표/D-Day 카드 + 달력의 최소 높이 합이 화면을 넘으면
          예전엔 md:overflow-hidden 때문에 달력 아래쪽이 그냥 잘려서 안 보였음.
          내용이 넘칠 때는 이 영역 자체가 스크롤되도록 해서 "잘려 보이는" 대신 스크롤로 다 볼 수 있게 함 */}
      <div className={`flex flex-col min-w-0 overflow-y-auto md:overflow-x-hidden transition-all duration-300 ease-in-out ${panelOpen ? 'md:h-1/2 lg:h-auto lg:flex-1' : 'flex-1'}`}>

        <div className="flex-1 flex flex-col px-4 sm:px-6 xl:px-8 pt-5 sm:pt-7 pb-4 md:min-h-0">

          {/* ── 머리글: 월 이동 + 보기 전환 + 공지/리포트 ── */}
          <header className="flex-shrink-0 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 mb-5">
            <div className="flex items-center gap-2">
              {calView === 'month' ? (
                <h1 className="page-title tabular-nums min-w-[136px] sm:min-w-[150px]">
                  {format(viewMonth, 'yyyy년 M월', { locale: ko })}
                </h1>
              ) : (
                <h1 className="page-title tabular-nums min-w-[136px] sm:min-w-[150px]">
                  {format(startOfWeek(weekRef, { weekStartsOn: 0 }), 'M.d')} – {format(endOfWeek(weekRef, { weekStartsOn: 0 }), 'M.d')}
                </h1>
              )}
              <div className="flex items-center">
                <button
                  onClick={() => calView === 'month' ? setViewMonth(m => subMonths(m, 1)) : setWeekRef(w => subWeeks(w, 1))}
                  aria-label={calView === 'month' ? '이전 달' : '이전 주'} className={navBtn}>
                  <ChevronLeft size={18} />
                </button>
                <button
                  onClick={() => calView === 'month' ? setViewMonth(m => addMonths(m, 1)) : setWeekRef(w => addWeeks(w, 1))}
                  aria-label={calView === 'month' ? '다음 달' : '다음 주'} className={navBtn}>
                  <ChevronRight size={18} />
                </button>
              </div>
              <button onClick={() => { setViewMonth(new Date()); setWeekRef(new Date()); setSelectedDate(todayStr); setPanelOpen(true); }}
                className="btn-secondary h-8 px-3 text-[13px]">
                오늘
              </button>
            </div>

            <div className="flex items-center gap-2">
              {/* 월/주 전환 */}
              <div className="flex p-0.5 rounded-lg bg-gray-200/60 dark:bg-gray-800 text-[13px] font-medium" role="tablist" aria-label="달력 보기">
                {(['month', 'week'] as const).map(v => (
                  <button key={v} role="tab" aria-selected={calView === v} onClick={() => setCalView(v)}
                    className={`h-7 px-3 rounded-md transition-all ${
                      calView === v
                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm font-semibold'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                    }`}>
                    {v === 'month' ? '월' : '주'}
                  </button>
                ))}
              </div>
              <button onClick={() => setShowOverdue(true)} aria-label="미완료 할 일" title="지난 날짜의 미완료 할 일 모아보기"
                className={`btn-secondary relative h-8 w-8 sm:w-auto sm:px-3 text-[13px] ${
                  overdueTodos.length > 0 ? '!text-amber-700 dark:!text-amber-400 !ring-amber-200 dark:!ring-amber-800/70' : ''
                }`}>
                <AlertCircle size={15} />
                <span className="hidden sm:inline">미완료</span>
                {overdueTodos.length > 0 && <span className="hidden sm:inline tabular-nums font-semibold">{overdueTodos.length}</span>}
                {/* 모바일은 아이콘만: 개수는 모서리 배지로 */}
                {overdueTodos.length > 0 && (
                  <span className="sm:hidden absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-amber-500 text-white text-[9px] leading-4 font-bold text-center tabular-nums ring-2 ring-gray-50 dark:ring-gray-950">
                    {overdueTodos.length > 99 ? '99+' : overdueTodos.length}
                  </span>
                )}
              </button>
              <button onClick={openNotice} aria-label="공지사항" title="공지사항" className="btn-secondary relative w-8 h-8">
                <Megaphone size={15} />
                {hasUnreadNotice && (
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-gray-50 dark:ring-gray-950" />
                )}
              </button>
              <button onClick={() => setShowAchievement(true)} className="btn-secondary h-8 px-3 text-[13px]">
                <BarChart3 size={15} className="text-leaf-600 dark:text-leaf-400" />
                <span className="hidden sm:inline">성취 리포트</span>
              </button>
            </div>
          </header>

          {/* ── 이번 달 요약: 목표 / D-Day / 일정 (한 장의 면을 세 칸으로 나눔) ── */}
          <section className="flex-shrink-0 grid grid-cols-1 md:grid-cols-3 rounded-2xl surface divide-y md:divide-y-0 md:divide-x divide-gray-100 dark:divide-gray-800 mb-4">

            {/* 이번달 목표 */}
            <OverviewColumn
              icon={<Target size={15} className="text-leaf-600 dark:text-leaf-400 flex-shrink-0" />}
              title={`${format(viewMonth, 'M월')} 목표`}
              meta={monthGoals.length > 0 && <span className="count-pill">{completedGoals}/{monthGoals.length}</span>}
              onAdd={() => setGoalModalState({})}
              addLabel="목표 추가"
              emptyText="이번 달에 이루고 싶은 것을 적어보세요"
              isEmpty={monthGoals.length === 0}
            >
              {monthGoals.map(g => (
                <div key={g.id} className="flex items-center gap-2.5 group py-0.5">
                  <button onClick={() => toggleMonthlyGoal(g.id)}
                    aria-label={g.completed ? '완료 취소' : '완료 처리'}
                    className={`flex-shrink-0 w-4 h-4 rounded-full border-[1.5px] flex items-center justify-center transition-colors ${
                      g.completed ? 'bg-leaf-600 border-leaf-600 dark:bg-leaf-500 dark:border-leaf-500' : 'border-gray-300 dark:border-gray-600 hover:border-leaf-500'
                    }`}>
                    {g.completed && <Check size={10} className="text-white" strokeWidth={3.2} />}
                  </button>
                  <button
                    onClick={() => setGoalModalState({ goal: g })}
                    title="눌러서 수정"
                    className={`flex-1 min-w-0 truncate text-left text-[13px] hover:text-leaf-700 dark:hover:text-leaf-300 transition-colors ${g.completed ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-800 dark:text-gray-200'}`}
                  >
                    {g.title}
                  </button>
                  <button onClick={() => deleteMonthlyGoal(g.id)} aria-label="목표 삭제"
                    className="opacity-60 md:opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600 transition-all">
                    <X size={13} />
                  </button>
                </div>
              ))}
            </OverviewColumn>

            {/* D-Day */}
            <OverviewColumn
              icon={<Flag size={14} className="text-leaf-600 dark:text-leaf-400 flex-shrink-0" />}
              title="D-Day"
              onTitleClick={() => setShowDdayListModal(true)}
              titleHint="지난 D-Day까지 전체 보기"
              onAdd={() => setDdayModalState({})}
              addLabel="D-Day 추가"
              emptyText="다가오는 날을 등록해 카운트다운하세요"
              isEmpty={upcomingDdays.length === 0}
            >
              {upcomingDdays.map(d => (
                <div key={d.id} className="flex items-center gap-2.5 group py-0.5">
                  <span className={`flex-shrink-0 text-[11px] font-bold tabular-nums px-1.5 py-0.5 rounded-md min-w-[46px] text-center ${
                    ddayLabel(d.targetDate) === 'D-Day'
                      ? 'bg-leaf-600 text-white'
                      : 'bg-leaf-50 dark:bg-leaf-900/30 text-leaf-700 dark:text-leaf-300'
                  }`}>
                    {ddayLabel(d.targetDate)}
                  </span>
                  <span className="flex-1 min-w-0 text-[13px] text-gray-800 dark:text-gray-200 truncate">{d.title}</span>
                  {d.fromTodoId && (
                    <span title="할 일에서 연동됨" className="flex-shrink-0 text-gray-300 dark:text-gray-600">
                      <Link2 size={11} />
                    </span>
                  )}
                  <span className="flex-shrink-0 text-[11px] tabular-nums text-gray-400 hidden sm:inline">{format(parseISO(d.targetDate), 'M/d')}</span>
                  <button onClick={() => removeDday(d)} aria-label="D-Day 삭제"
                    className="opacity-60 md:opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600 transition-all">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </OverviewColumn>

            {/* 일정 (날짜/시간이 정해진 이벤트 - 할 일과 별개로 관리) */}
            <OverviewColumn
              icon={<CalendarClock size={14} className="text-blue-500 flex-shrink-0" />}
              title={`${format(viewMonth, 'M월')} 일정`}
              meta={monthSchedules.length > 0 && <span className="count-pill">{monthSchedules.length}</span>}
              onAdd={() => setScheduleModalState({ defaultDate: format(new Date(), 'yyyy-MM-dd') })}
              addLabel="일정 추가"
              emptyText="약속이나 회의처럼 시간이 정해진 일을 추가하세요"
              isEmpty={monthSchedules.length === 0}
            >
              {monthSchedules.map(s => (
                <div key={s.id} className="flex items-center gap-2.5 group cursor-pointer py-0.5" onClick={() => setScheduleModalState({ schedule: s })}>
                  <span className="flex-shrink-0 text-[11px] font-semibold tabular-nums px-1.5 py-0.5 rounded-md min-w-[40px] text-center bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                    {format(parseISO(s.date), 'M/d')}
                  </span>
                  <span className="flex-1 min-w-0 text-[13px] text-gray-800 dark:text-gray-200 truncate group-hover:text-gray-950 dark:group-hover:text-white">{s.title}</span>
                  {s.seriesId && <Repeat size={11} className="flex-shrink-0 text-blue-300 dark:text-blue-700" aria-label="반복 일정" />}
                  {s.startTime && (
                    <span className="flex-shrink-0 text-[11px] tabular-nums text-gray-400">{s.startTime}</span>
                  )}
                  <button onClick={e => { e.stopPropagation(); deleteSchedule(s.id); }} aria-label="일정 삭제"
                    className="opacity-60 md:opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600 transition-all">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </OverviewColumn>
          </section>

          {/* ── 달력 / 주간 카드 ── */}
          {calView === 'month' ? (
            <div className={`rounded-2xl surface overflow-hidden flex flex-col transition-all duration-300 ease-in-out ${
              panelOpen ? 'md:flex-1 md:h-auto md:min-h-[200px]' : 'flex-1 md:min-h-0'
            }`}>
              <div className="flex-shrink-0 grid grid-cols-7 border-b border-gray-100 dark:border-gray-800">
                {DAY_LABELS.map((d, i) => (
                  <div key={d} className={`py-2 px-2 text-[11px] font-semibold ${
                    i === 0 ? 'text-red-500/80 dark:text-red-400/80' : i === 6 ? 'text-blue-500/80 dark:text-blue-400/80' : 'text-gray-400 dark:text-gray-500'
                  }`}>{d}</div>
                ))}
              </div>
              <div className="flex-1 grid grid-cols-7" style={{ gridTemplateRows: `repeat(${weekCount}, 1fr)` }}>
                {days.map((day, idx) => {
                  const dateStr = format(day, 'yyyy-MM-dd');
                  const isToday = dateStr === todayStr;
                  const isSelected = dateStr === selectedDate && panelOpen;
                  const inMonth = isSameMonth(day, viewMonth);
                  const dayTodos = todos.filter(t => t.date === dateStr);
                  const dayDdays = allDdays.filter(d => d.targetDate === dateStr);
                  const daySchedules = schedules.filter(s => s.date === dateStr);
                  const dow = day.getDay();
                  const isLastRow = idx >= days.length - 7;

                  // 달력 칸에는 디데이/일정(날짜·시간이 정해진 것)만 제목이 보이는 칩으로 미리 보여주고,
                  // 할 일(날짜만 있고 시간표는 아닌 것)은 예전처럼 카테고리별 색깔 점으로만 표시.
                  // 칩이 좁아 최대 몇 개만 보여주고 나머지는 "+N개"로 요약(자세히 보려면 칸을 눌러 확인)
                  const chips = [
                    ...dayDdays.map(d => ({ key: `dday-${d.id}`, title: d.title, isDday: true })),
                    ...daySchedules.map(s => ({ key: `sch-${s.id}`, title: s.title, isDday: false })),
                  ];
                  const visibleChips = chips.slice(0, chipStyle.maxChips);
                  const overflowCount = chips.length - visibleChips.length;
                  const todoDots = Array.from(new Set(dayTodos.map(t => t.categoryId))).slice(0, 8);
                  const allDone = dayTodos.length > 0 && dayTodos.every(t => t.completed);

                  return (
                    <button key={dateStr} onClick={() => handleDayClick(dateStr)}
                      aria-label={format(day, 'M월 d일 EEEE', { locale: ko })}
                      aria-pressed={isSelected}
                      className={`relative flex flex-col items-start ${chipStyle.cellMinH} md:min-h-0 overflow-hidden p-1.5 text-left transition-colors ${
                        dow !== 6 ? 'border-r border-gray-100 dark:border-gray-800' : ''
                      } ${!isLastRow ? 'border-b border-gray-100 dark:border-gray-800' : ''} ${
                        isSelected
                          ? 'bg-leaf-50/80 dark:bg-leaf-900/20 shadow-[inset_0_0_0_1.5px_theme(colors.leaf.500)]'
                          : inMonth ? 'hover:bg-gray-50 dark:hover:bg-gray-800/40' : 'bg-gray-50/50 dark:bg-gray-950/30 hover:bg-gray-100/60 dark:hover:bg-gray-800/40'
                      }`}
                    >
                      <span className={`flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-[12px] tabular-nums mb-1 ${
                        isToday
                          ? 'bg-leaf-600 dark:bg-leaf-500 text-white font-bold'
                          : !inMonth
                            ? 'text-gray-300 dark:text-gray-600 font-medium'
                            : `${weekdayTone(dow)} font-semibold`
                      }`}>
                        {format(day, 'd')}
                      </span>
                      <div className={`w-full space-y-[3px] overflow-hidden ${inMonth ? '' : 'opacity-40'}`}>
                        {visibleChips.map(chip => (
                          <div
                            key={chip.key}
                            title={chip.title}
                            className={`w-full flex items-center gap-1 ${chipStyle.chip} leading-[1.35] px-1.5 py-px rounded-[4px] font-medium ${
                              chip.isDday
                                ? 'bg-leaf-100 text-leaf-800 dark:bg-leaf-900/50 dark:text-leaf-200'
                                : 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200'
                            }`}
                          >
                            {chip.isDday && <Flag size={chipStyle.icon} className="flex-shrink-0" strokeWidth={2.8} />}
                            <span className={`truncate ${chip.isDday ? 'font-semibold' : ''}`}>{chip.title}</span>
                          </div>
                        ))}
                        {overflowCount > 0 && (
                          <p className={`${chipStyle.chip} leading-tight px-1.5 text-gray-400 dark:text-gray-500 font-medium`}>
                            +{overflowCount}개 더
                          </p>
                        )}
                      </div>
                      {/* 할 일은 제목 대신 카테고리 색깔 점으로만 요약 (자세한 목록은 칸을 눌러 확인) */}
                      {todoDots.length > 0 && (
                        <div className={`w-full flex flex-wrap items-center gap-[3px] mt-auto pt-1 pl-0.5 ${inMonth ? '' : 'opacity-40'}`}>
                          {allDone ? (
                            <Check size={11} className="text-leaf-500" strokeWidth={3} aria-label="모두 완료" />
                          ) : todoDots.map(catId => {
                            const cat = categories.find(c => c.id === catId);
                            return (
                              <span
                                key={catId ?? '__none__'}
                                className="w-[5px] h-[5px] rounded-full flex-shrink-0"
                                style={{ backgroundColor: cat?.color ?? '#9DA397' }}
                              />
                            );
                          })}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* ── 주간 뷰 (인라인) ── */
            <div className={`rounded-2xl surface overflow-hidden flex flex-col transition-all duration-300 ease-in-out ${
              panelOpen ? 'md:flex-1 md:h-auto md:min-h-[200px]' : 'flex-1 md:min-h-0'
            }`}>
              <div className="flex-1 overflow-auto p-2">
                <div className="grid grid-cols-7 gap-1.5 h-full" style={{ minHeight: '260px' }}>
                  {eachDayOfInterval({
                    start: startOfWeek(weekRef, { weekStartsOn: 0 }),
                    end: endOfWeek(weekRef, { weekStartsOn: 0 }),
                  }).map(day => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const dayTodos = todos.filter(t => t.date === dateStr);
                    const completedCount = dayTodos.filter(t => t.completed).length;
                    const dow = day.getDay();
                    const isToday = dateFnsIsToday(day);
                    return (
                      <div key={dateStr}
                        className={`flex flex-col rounded-xl p-2 ${
                          isToday
                            ? 'bg-leaf-50 dark:bg-leaf-900/20 ring-1 ring-leaf-400/70'
                            : 'bg-gray-50 dark:bg-gray-800/40'
                        }`}
                      >
                        <div className="mb-2 flex-shrink-0 px-0.5">
                          <p className={`text-[10px] font-semibold ${dow === 0 ? 'text-red-500/80' : dow === 6 ? 'text-blue-500/80' : 'text-gray-400'}`}>{DAY_LABELS[dow]}</p>
                          <div className="flex items-baseline justify-between">
                            <p className={`text-lg font-bold tabular-nums leading-tight ${isToday ? 'text-leaf-700 dark:text-leaf-300' : weekdayTone(dow)}`}>{format(day, 'd')}</p>
                            {dayTodos.length > 0 && (
                              <p className="text-[10px] tabular-nums text-gray-400">{completedCount}/{dayTodos.length}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex-1 space-y-1 overflow-y-auto scrollbar-thin">
                          {dayTodos.map(todo => (
                            <div key={todo.id}
                              className="flex items-start gap-1.5 cursor-pointer group"
                              onClick={() => toggleTodo(todo.id)}
                            >
                              <div className={`flex-shrink-0 mt-[2px] w-3 h-3 rounded-[4px] border-[1.5px] flex items-center justify-center transition-colors ${
                                todo.completed ? 'bg-leaf-600 border-leaf-600' : 'border-gray-300 dark:border-gray-600 group-hover:border-leaf-500'
                              }`}>
                                {todo.completed && <Check size={7} className="text-white" strokeWidth={3.5} />}
                              </div>
                              <span className={`text-[11px] leading-snug break-words ${
                                todo.completed ? 'line-through text-gray-400' : 'text-gray-700 dark:text-gray-300'
                              }`}>{todo.title}</span>
                            </div>
                          ))}
                        </div>
                        {weekAddDate === dateStr ? (
                          <div className="mt-1 flex items-center gap-1 flex-shrink-0">
                            <input
                              autoFocus
                              value={weekAddTitle}
                              onChange={e => setWeekAddTitle(e.target.value)}
                              placeholder="추가..."
                              className="flex-1 min-w-0 text-[11px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-leaf-500"
                              onKeyDown={async e => {
                                if (e.key === 'Enter') {
                                  const t = weekAddTitle.trim();
                                  if (t) await addTodo({ title: t, completed: false, categoryId: null, subcategoryId: null, date: dateStr, startTime: null, notes: '' });
                                  setWeekAddTitle(''); setWeekAddDate(null);
                                }
                                if (e.key === 'Escape') { setWeekAddDate(null); setWeekAddTitle(''); }
                              }}
                              onBlur={() => { if (!weekAddTitle.trim()) setWeekAddDate(null); }}
                            />
                          </div>
                        ) : (
                          <button
                            onClick={() => { setWeekAddDate(dateStr); setWeekAddTitle(''); }}
                            aria-label="이 날에 할 일 추가"
                            className="mt-1 w-full flex items-center justify-center rounded-md text-gray-300 dark:text-gray-600 hover:text-leaf-600 hover:bg-white dark:hover:bg-gray-800 transition-colors flex-shrink-0 py-1"
                          >
                            <Plus size={12} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ── 오른쪽 패널 (데스크톱) ── */}
      <div className={`hidden lg:flex flex-col flex-shrink-0 bg-white dark:bg-gray-900 border-l border-gray-200/70 dark:border-gray-800 overflow-hidden transition-all duration-300 ease-in-out relative ${
        panelOpen ? 'w-[360px] wide:w-[400px] opacity-100' : 'w-0 opacity-0'
      }`}>
        {panelOpen && (
          <>
            {renderPanelHeader(false)}
            <div className="flex-1 overflow-y-auto scrollbar-thin px-6 pt-1 pb-48">
              {renderDayGroups()}
            </div>
            <div className="absolute bottom-0 left-0 right-0 px-6 pb-5 pt-6 bg-gradient-to-t from-white via-white/90 to-transparent dark:from-gray-900 dark:via-gray-900/90">
              {renderQuickAdd()}
            </div>
          </>
        )}
      </div>

      {/* ── 모바일: 하단 패널 ── */}
      <div className={`lg:hidden flex-shrink-0 flex flex-col bg-white dark:bg-gray-900 border-t border-gray-200/70 dark:border-gray-800 rounded-t-3xl shadow-[0_-8px_24px_-12px_rgb(27_30_25/0.15)] overflow-hidden transition-all duration-300 ease-in-out relative ${
        panelOpen ? 'h-[50%] opacity-100' : 'h-0 opacity-0'
      }`}>
        <div className="mx-auto mt-2 w-9 h-1 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0" />
        {renderPanelHeader(true)}
        <div className="flex-1 overflow-y-auto px-4 pt-1 pb-44">
          {renderDayGroups()}
        </div>
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-3 pt-6 bg-gradient-to-t from-white via-white/90 to-transparent dark:from-gray-900 dark:via-gray-900/90">
          {renderQuickAdd()}
        </div>
      </div>

      {showOverdue && (
        <OverdueModal todos={overdueTodos} onEdit={openEdit} getActions={getOverdueActions} onClose={() => setShowOverdue(false)} />
      )}
      {showModal && (
        <TodoModal
          todo={editTodo}
          defaultDate={selectedDate}
          defaultCategoryId={newTodoDefaults.categoryId}
          defaultSubcategoryId={newTodoDefaults.subcategoryId}
          defaultTitle={newTodoDefaults.title}
          onClose={closeModal}
        />
      )}
      {showAchievement && <AchievementModal onClose={() => setShowAchievement(false)} />}
      {showNotice && <NoticeModal onClose={() => setShowNotice(false)} />}
      {goalModalState && (
        <GoalModal month={currentMonth} goal={goalModalState.goal} onClose={() => setGoalModalState(null)} />
      )}
      {ddayModalState && <DDayModal dday={ddayModalState.dday} onClose={() => setDdayModalState(null)} />}
      {showDdayListModal && (
        <DDayListModal ddays={allDdays} onDelete={removeDday} onClose={() => setShowDdayListModal(false)} />
      )}
      {scheduleModalState && (
        <ScheduleModal
          schedule={scheduleModalState.schedule}
          defaultDate={scheduleModalState.defaultDate}
          onClose={() => setScheduleModalState(null)}
        />
      )}
    </div>
  );
}
