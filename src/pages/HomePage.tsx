import { useState } from 'react';
import type React from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  CalendarDays, CalendarClock, CalendarCheck, Flame, TrendingUp, TrendingDown, AlertCircle, Flag, Target, ChevronRight, Clock, Megaphone, BarChart3,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useNow } from '../hooks/useNow';
import { applyListDisplaySettings } from '../lib/listDisplay';
import { todoDdays } from '../lib/agenda';
import { blockDone, durationLabel } from '../lib/timebox';
import {
  completionStreak, dayProgress, daysUntil, dueSoonTodos, nextSchedule, overdueTodos, rate, timeboxMinutes, weekComparison,
} from '../lib/homeStats';
import TodayTimeline from '../components/TodayTimeline';
import TodoList from '../components/TodoList';
import TodoModal from '../components/TodoModal';
import DayTodoComposer from '../components/DayTodoComposer';
import ScheduleModal from '../components/ScheduleModal';
import DDayModal from '../components/DDayModal';
import OverdueModal from '../components/OverdueModal';
import AchievementModal from '../components/AchievementModal';
import NoticeModal from '../components/NoticeModal';
import type { DDay, ScheduleItem, Todo } from '../types';

function greeting(hour: number): string {
  if (hour >= 5 && hour < 11) return '좋은 아침이에요';
  if (hour >= 11 && hour < 17) return '좋은 오후예요';
  if (hour >= 17 && hour < 22) return '좋은 저녁이에요';
  return '오늘도 수고했어요';
}

function ddayLabel(diff: number): string {
  if (diff === 0) return 'D-Day';
  return diff > 0 ? `D-${diff}` : `D+${-diff}`;
}

// 동그란 진행 링 (오늘 진행률)
function ProgressRing({ pct, size = 44 }: { pct: number; size?: number }) {
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} className="-rotate-90 flex-shrink-0" aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-gray-100 dark:stroke-gray-800" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)}
        className="stroke-leaf-500 transition-[stroke-dashoffset] duration-700" />
    </svg>
  );
}

// 위쪽 숫자 카드 한 칸
function StatCard({ label, value, unit, sub, icon, onClick, tone = 'default' }: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  sub?: React.ReactNode;
  icon: React.ReactNode;
  onClick?: () => void;
  tone?: 'default' | 'warn';
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag onClick={onClick}
      className={`surface rounded-2xl p-4 flex items-center justify-between gap-3 text-left min-w-0 ${onClick ? 'hover:ring-1 hover:ring-leaf-200 dark:hover:ring-leaf-800 transition-shadow' : ''}`}>
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
        <p className={`mt-1 text-[26px] leading-none font-bold tracking-[-0.03em] tabular-nums ${tone === 'warn' ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-white'}`}>
          {value}{unit && <span className="ml-0.5 text-sm font-semibold text-gray-400 dark:text-gray-500">{unit}</span>}
        </p>
        {sub && <p className="mt-1.5 text-[11.5px] leading-snug text-gray-500 dark:text-gray-400 line-clamp-2">{sub}</p>}
      </div>
      {/* 폰에서는 두 칸씩 좁아서 아이콘은 빼고 숫자·설명에 자리를 줌 */}
      <span className="hidden sm:flex">{icon}</span>
    </Tag>
  );
}

// 카드 묶음 머리글
function SectionHeader({ icon, title, meta, actionLabel, onAction }: {
  icon: React.ReactNode; title: string; meta?: React.ReactNode; actionLabel?: string; onAction?: () => void;
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-[14px] font-semibold text-gray-900 dark:text-white">{title}</h2>
        {meta}
      </div>
      {onAction && (
        <button onClick={onAction} className="flex items-center text-xs font-medium text-gray-500 hover:text-leaf-700 dark:text-gray-400 dark:hover:text-leaf-300 transition-colors">
          {actionLabel}<ChevronRight size={14} />
        </button>
      )}
    </div>
  );
}

// 새 홈: 창을 열자마자 오늘 하루가 한눈에 (오늘 할 일·일정·타임박스 + 요약 숫자).
// 예전 홈(월 달력)은 "달력" 메뉴로 옮김
export default function HomePage() {
  const {
    todos, schedules, ddays, timeblocks, monthlyGoals, notices, settings,
    updateTodo, toggleMonthlyGoal, setCurrentScreen, setSelectedDate,
  } = useApp();
  const now = useNow(60_000);
  const todayKey = format(now, 'yyyy-MM-dd');
  const monthKey = format(now, 'yyyy-MM');

  const [todoModal, setTodoModal] = useState<{ todo?: Todo; categoryId?: string | null; subcategoryId?: string | null; title?: string } | null>(null);
  const [scheduleModal, setScheduleModal] = useState<{ schedule?: ScheduleItem } | null>(null);
  const [ddayModal, setDdayModal] = useState<DDay | null>(null);
  const [showOverdue, setShowOverdue] = useState(false);
  const [showAchievement, setShowAchievement] = useState(false);
  const [showNotice, setShowNotice] = useState(false);
  const [lastSeenNotice, setLastSeenNotice] = useState(() => {
    try { return localStorage.getItem('notice-last-seen') ?? ''; } catch { return ''; }
  });
  const hasUnreadNotice = notices.length > 0 && notices[0].createdAt !== lastSeenNotice;

  function openNotice() {
    setShowNotice(true);
    if (notices[0]) {
      try { localStorage.setItem('notice-last-seen', notices[0].createdAt); } catch { /* 저장 못 해도 공지는 보여줌 */ }
      setLastSeenNotice(notices[0].createdAt);
    }
  }

  // ── 요약 숫자 ──
  const today = dayProgress(todos, todayKey);
  const todayRate = rate(today) ?? 0;
  const streak = completionStreak(todos, now);
  const { thisWeek, lastWeek } = weekComparison(todos, now);
  const weekRate = rate(thisWeek);
  const lastWeekRate = rate(lastWeek);
  const weekDiff = weekRate !== null && lastWeekRate !== null ? weekRate - lastWeekRate : null;
  const overdue = overdueTodos(todos, todayKey);
  const dueSoon = dueSoonTodos(todos, now);
  const todosById = new Map(todos.map(t => [t.id, t]));
  const box = timeboxMinutes(timeblocks, todayKey, b => blockDone(b, todosById));

  // ── 오늘 목록 ──
  const todayTodos = applyListDisplaySettings(todos.filter(t => t.date === todayKey), settings);
  const todaySchedules = schedules
    .filter(s => s.date === todayKey)
    .sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''));
  const upcoming = nextSchedule(schedules, now);
  const upcomingDdays = [...ddays, ...todoDdays(todos, todayKey)]
    .filter(d => d.targetDate >= todayKey)
    .sort((a, b) => a.targetDate.localeCompare(b.targetDate))
    .slice(0, 4);
  const goals = monthlyGoals.filter(g => g.month === monthKey);
  const goalsDone = goals.filter(g => g.completed).length;

  function openDday(d: DDay) {
    if (d.fromTodoId) {
      const todo = todosById.get(d.fromTodoId);
      if (todo) setTodoModal({ todo });
    } else setDdayModal(d);
  }

  function goCalendar(dateKey?: string) {
    if (dateKey) setSelectedDate(dateKey);
    setCurrentScreen('month');
  }

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const isPast = (s: ScheduleItem) => {
    if (!s.startTime) return false;
    const [h, m] = s.startTime.split(':').map(Number);
    return h * 60 + m < nowMinutes;
  };

  return (
    <div className="h-screen overflow-y-auto pb-[62px] lg:pb-0">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 xl:px-8 pt-6 sm:pt-8 pb-10">

        {/* ── 인사 + 날짜 ── */}
        <header className="flex items-start justify-between gap-3 mb-5">
          <div>
            <p className="text-[13px] font-medium text-leaf-700 dark:text-leaf-400">{greeting(now.getHours())}</p>
            <h1 className="page-title mt-0.5">{format(now, 'M월 d일 EEEE', { locale: ko })}</h1>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button onClick={openNotice} aria-label="공지사항" title="공지사항" className="btn-secondary relative w-8 h-8">
              <Megaphone size={15} />
              {hasUnreadNotice && <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-gray-50 dark:ring-gray-950" />}
            </button>
            <button onClick={() => setShowAchievement(true)} className="btn-secondary h-8 px-3 text-[13px]">
              <BarChart3 size={15} className="text-leaf-600 dark:text-leaf-400" />
              <span className="hidden sm:inline">성취 리포트</span>
            </button>
          </div>
        </header>

        {/* ── 요약 숫자 4칸 ── */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4" aria-label="오늘 요약">
          <StatCard
            label="오늘 진행률"
            value={today.total ? todayRate : '–'}
            unit={today.total ? '%' : undefined}
            sub={today.total ? `할 일 ${today.total}개 중 ${today.done}개 완료` : '오늘 할 일이 아직 없어요'}
            icon={<ProgressRing pct={todayRate} />}
          />
          <StatCard
            label="연속 달성"
            value={streak}
            unit="일"
            sub={streak > 0 ? '하루 1개 이상 완료한 날' : '오늘 하나 끝내면 시작돼요'}
            icon={<span className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${streak > 0 ? 'bg-orange-50 dark:bg-orange-900/30 text-orange-500' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}><Flame size={20} /></span>}
            onClick={() => setShowAchievement(true)}
          />
          <StatCard
            label="이번 주 달성률"
            value={weekRate ?? '–'}
            unit={weekRate !== null ? '%' : undefined}
            sub={weekDiff === null
              ? (weekRate === null ? '이번 주 할 일이 아직 없어요' : '지난주 같은 때와 비교할 기록이 없어요')
              : weekDiff === 0 ? '지난주 이맘때와 같아요'
                : <span className={weekDiff > 0 ? 'text-leaf-700 dark:text-leaf-400' : 'text-amber-700 dark:text-amber-400'}>지난주보다 {Math.abs(weekDiff)}%p {weekDiff > 0 ? '높아요' : '낮아요'}</span>}
            icon={<span className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 bg-leaf-50 dark:bg-leaf-900/30 text-leaf-600 dark:text-leaf-400">
              {weekDiff !== null && weekDiff < 0 ? <TrendingDown size={20} /> : <TrendingUp size={20} />}
            </span>}
            onClick={() => setShowAchievement(true)}
          />
          <StatCard
            label="밀린 할 일"
            value={overdue.length}
            unit="개"
            tone={overdue.length > 0 ? 'warn' : 'default'}
            sub={dueSoon.length > 0 ? `3일 안에 마감 ${dueSoon.length}개` : overdue.length > 0 ? '눌러서 오늘로 옮기기' : '밀린 일 없이 깔끔해요'}
            icon={<span className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${overdue.length > 0 ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-500' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}><AlertCircle size={20} /></span>}
            onClick={overdue.length > 0 ? () => setShowOverdue(true) : undefined}
          />
        </section>

        {/* ── 오늘 타임박스 ── */}
        <div className="mb-1">
          <TodayTimeline />
        </div>
        {box.planned > 0 && (
          <p className="text-[11.5px] text-gray-500 dark:text-gray-400 mb-4 px-1">
            오늘 타임박스 {durationLabel(box.planned)} 중 <span className="font-semibold text-gray-700 dark:text-gray-300">{durationLabel(box.done)}</span> 완료
          </p>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-5 lg:items-start gap-4 mt-3">
          {/* ── 오늘 할 일 ── */}
          <section className="lg:col-span-3 surface rounded-2xl p-4">
            <SectionHeader
              icon={<CalendarCheck size={15} className="text-leaf-600 dark:text-leaf-400" />}
              title="오늘 할 일"
              meta={today.total > 0 && <span className="count-pill">{today.done}/{today.total}</span>}
              actionLabel="달력에서 보기"
              onAction={() => goCalendar(todayKey)}
            />
            {todayTodos.length === 0 && (
              <p className="text-[13px] text-gray-400 dark:text-gray-500 py-2">오늘 할 일을 아래에 적어보세요</p>
            )}
            <TodoList todos={todayTodos} onEdit={todo => setTodoModal({ todo })} />
            <div className="mt-2">
              <DayTodoComposer date={todayKey} onOpenDetail={(categoryId, subcategoryId, title) => setTodoModal({ categoryId, subcategoryId, title })} />
            </div>

            {dueSoon.length > 0 && (
              <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">곧 마감</p>
                <ul className="space-y-1">
                  {dueSoon.slice(0, 5).map(t => {
                    const diff = daysUntil(t.dueDate as string, now);
                    return (
                      <li key={t.id}>
                        <button onClick={() => setTodoModal({ todo: t })} className="w-full flex items-center gap-2 text-left py-1 text-[13px] text-gray-700 dark:text-gray-200 hover:text-leaf-700 dark:hover:text-leaf-300">
                          <span className={`flex-shrink-0 text-[11px] font-semibold tabular-nums px-1.5 py-px rounded-md ${diff === 0 ? 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                            {diff === 0 ? '오늘' : `${diff}일 뒤`}
                          </span>
                          <span className="truncate">{t.title}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </section>

          <div className="lg:col-span-2 flex flex-col gap-4">
            {/* ── 오늘 일정 ── */}
            <section className="surface rounded-2xl p-4">
              <SectionHeader
                icon={<CalendarClock size={15} className="text-[#4F73A8]" />}
                title="오늘 일정"
                meta={todaySchedules.length > 0 && <span className="count-pill">{todaySchedules.length}</span>}
                actionLabel="추가"
                onAction={() => setScheduleModal({})}
              />
              {todaySchedules.length === 0 ? (
                <p className="text-[13px] text-gray-400 dark:text-gray-500">
                  오늘은 정해진 일정이 없어요
                  {upcoming && <><br /><span className="text-gray-500 dark:text-gray-400">다음 일정: {format(new Date(upcoming.date + 'T00:00'), 'M/d(EEE)', { locale: ko })} {upcoming.startTime ?? ''} {upcoming.title}</span></>}
                </p>
              ) : (
                <ul className="space-y-1">
                  {todaySchedules.map(s => (
                    <li key={s.id}>
                      <button onClick={() => setScheduleModal({ schedule: s })}
                        className={`w-full flex items-center gap-2.5 text-left px-2 py-1.5 -mx-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/60 ${isPast(s) ? 'opacity-50' : ''}`}>
                        <span className="w-1 self-stretch rounded-full bg-[#4F73A8] flex-shrink-0" />
                        <span className="w-11 flex-shrink-0 text-[12px] tabular-nums font-medium text-gray-500 dark:text-gray-400">{s.startTime ?? '종일'}</span>
                        <span className="text-[13px] text-gray-800 dark:text-gray-100 truncate">{s.title}</span>
                        {upcoming?.id === s.id && <span className="ml-auto flex-shrink-0 text-[10.5px] font-semibold text-[#4F73A8] flex items-center gap-0.5"><Clock size={10} />다음</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* ── 다가오는 D-Day ── */}
            <section className="surface rounded-2xl p-4">
              <SectionHeader
                icon={<Flag size={15} className="text-rose-500" />}
                title="다가오는 D-Day"
                actionLabel="달력"
                onAction={() => goCalendar()}
              />
              {upcomingDdays.length === 0 ? (
                <p className="text-[13px] text-gray-400 dark:text-gray-500">다가오는 D-Day가 없어요</p>
              ) : (
                <ul className="space-y-1">
                  {upcomingDdays.map(d => {
                    const diff = daysUntil(d.targetDate, now);
                    return (
                      <li key={d.id}>
                        <button onClick={() => openDday(d)} className="w-full flex items-center gap-2.5 text-left py-1 hover:text-leaf-700 dark:hover:text-leaf-300">
                          <span className={`w-14 flex-shrink-0 whitespace-nowrap text-[12px] font-bold tabular-nums ${diff <= 3 ? 'text-rose-500' : 'text-gray-500 dark:text-gray-400'}`}>{ddayLabel(diff)}</span>
                          <span className="text-[13px] text-gray-800 dark:text-gray-100 truncate">{d.title}</span>
                          <span className="ml-auto flex-shrink-0 text-[11px] text-gray-400 tabular-nums">{format(new Date(d.targetDate + 'T00:00'), 'M/d')}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* ── 이번 달 목표 ── */}
            <section className="surface rounded-2xl p-4">
              <SectionHeader
                icon={<Target size={15} className="text-leaf-600 dark:text-leaf-400" />}
                title={`${format(now, 'M월')} 목표`}
                meta={goals.length > 0 && <span className="count-pill">{goalsDone}/{goals.length}</span>}
                actionLabel="달력"
                onAction={() => goCalendar()}
              />
              {goals.length === 0 ? (
                <p className="text-[13px] text-gray-400 dark:text-gray-500">달력 화면에서 이번 달 목표를 세워보세요</p>
              ) : (
                <>
                  <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden mb-2.5">
                    <div className="h-full rounded-full bg-leaf-500 transition-[width] duration-500" style={{ width: `${Math.round((goalsDone / goals.length) * 100)}%` }} />
                  </div>
                  <ul className="space-y-1">
                    {goals.map(g => (
                      <li key={g.id}>
                        <button onClick={() => toggleMonthlyGoal(g.id)} className="w-full flex items-center gap-2 text-left py-0.5">
                          <span className={`flex-shrink-0 w-4 h-4 rounded-full border-[1.5px] flex items-center justify-center ${g.completed ? 'bg-leaf-600 border-leaf-600' : 'border-gray-300 dark:border-gray-600'}`}>
                            {g.completed && <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1 4l2 2 4-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                          </span>
                          <span className={`text-[13px] truncate ${g.completed ? 'line-through text-gray-400' : 'text-gray-800 dark:text-gray-100'}`}>{g.title}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>

            <button onClick={() => goCalendar()} className="btn-secondary h-10 text-[13px] justify-center">
              <CalendarDays size={15} />
              월 달력 열기
            </button>
          </div>
        </div>
      </div>

      {todoModal && (
        <TodoModal
          todo={todoModal.todo}
          defaultDate={todayKey}
          defaultCategoryId={todoModal.categoryId}
          defaultSubcategoryId={todoModal.subcategoryId}
          defaultTitle={todoModal.title}
          onClose={() => setTodoModal(null)}
        />
      )}
      {scheduleModal && <ScheduleModal schedule={scheduleModal.schedule} defaultDate={todayKey} onClose={() => setScheduleModal(null)} />}
      {ddayModal && <DDayModal dday={ddayModal} onClose={() => setDdayModal(null)} />}
      {showOverdue && (
        <OverdueModal
          todos={overdue}
          onEdit={todo => setTodoModal({ todo })}
          getActions={todo => (
            <button
              onClick={e => { e.stopPropagation(); updateTodo(todo.id, { date: todayKey }); }}
              className="row-action !bg-leaf-50 !text-leaf-700 hover:!bg-leaf-100 dark:!bg-leaf-900/30 dark:!text-leaf-300 dark:hover:!bg-leaf-900/60"
              title="오늘 할 일로 옮기기"
            >
              <CalendarCheck size={11} />
              오늘로
            </button>
          )}
          onClose={() => setShowOverdue(false)}
        />
      )}
      {showAchievement && <AchievementModal onClose={() => setShowAchievement(false)} />}
      {showNotice && <NoticeModal onClose={() => setShowNotice(false)} />}
    </div>
  );
}
