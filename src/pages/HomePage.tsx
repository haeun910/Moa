import { useState } from 'react';
import type React from 'react';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  Archive, Search, ChevronDown, CalendarDays, CalendarClock, CalendarCheck, Flame, TrendingUp, TrendingDown, AlertCircle, Flag, Target, ChevronRight, Clock, Megaphone, BarChart3, StickyNote, Pin,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useNow } from '../hooks/useNow';
import { applyListDisplaySettings } from '../lib/listDisplay';
import { todoDdays } from '../lib/agenda';
import { blockDone, durationLabel } from '../lib/timebox';
import {
  completionStreak, dayProgress, daysUntil, dueSoonTodos, nextSchedule, overdueTodos, rate, splitOverdue, timeboxMinutes, weekComparison,
} from '../lib/homeStats';
import { LIMITS } from '../lib/limits';
import { isMultiDay, scheduleEndDate, scheduleOnDate } from '../lib/scheduleDates';
import { holidayLabel, useHolidays } from '../hooks/useHolidays';
import { isValidTimeRange, timeRangeEnd, timeRangeLabel } from '../lib/timeRange';
import { requestOpenNote } from '../lib/openNote';
import { openSearch } from '../lib/searchStore';
import { noteHeading, notePreview } from '../lib/markdown';
import TodayTimeline from '../components/TodayTimeline';
import ScheduleCheck from '../components/ScheduleCheck';
import { useCollapsed } from '../hooks/useCollapsed';
import HelpTip from '../components/HelpTip';
import { GUIDES } from '../data/guides';
import CategoryTodoGroups from '../components/CategoryTodoGroups';
import TodoModal from '../components/TodoModal';
import DayTodoComposer from '../components/DayTodoComposer';
import ScheduleModal from '../components/ScheduleModal';
import DDayModal from '../components/DDayModal';
import OverdueModal from '../components/OverdueModal';
import AchievementModal from '../components/AchievementModal';
import NoticeModal from '../components/NoticeModal';
import type { DDay, Note, ScheduleItem, Todo } from '../types';

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
function StatCard({ label, shortLabel, value, unit, sub, icon, onClick, tone = 'default' }: {
  label: string;
  shortLabel: string; // 폰·태블릿의 작은 칸에 들어가는 짧은 이름
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
      className={`surface rounded-xl px-2.5 py-2.5 lg:p-4 flex items-center justify-between gap-3 text-left min-w-0 ${onClick ? 'hover:ring-1 hover:ring-leaf-200 dark:hover:ring-leaf-800 transition-shadow' : ''}`}>
      <div className="min-w-0">
        <p className="text-11px lg:text-xs font-medium text-gray-500 dark:text-gray-400 truncate">
          <span className="lg:hidden">{shortLabel}</span>
          <span className="hidden lg:inline">{label}</span>
        </p>
        <p className={`mt-1 text-lg lg:text-26px leading-none font-bold tracking-[-0.03em] tabular-nums whitespace-nowrap ${tone === 'warn' ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-white'}`}>
          {value}{unit && <span className="ml-0.5 text-11px lg:text-sm font-semibold text-gray-400 dark:text-gray-500">{unit}</span>}
        </p>
        {/* 폰·태블릿은 숫자만 한 줄로 (홈 첫 화면에서 할 일이 바로 보이도록) */}
        {sub && <p className="hidden lg:block mt-1.5 text-11.5px leading-snug text-gray-500 dark:text-gray-400 line-clamp-2">{sub}</p>}
      </div>
      <span className="hidden lg:flex">{icon}</span>
    </Tag>
  );
}

// 일정 시간 칸: 시작 시간(끝 시간이 있으면 아래 작게), 시간이 없으면 종일, 여러 날이면 기간
function ScheduleTime({ s }: { s: ScheduleItem }) {
  const multi = isMultiDay(s);
  return (
    <span className="w-11 flex-shrink-0 text-12px leading-tight tabular-nums font-medium text-gray-500 dark:text-gray-400">
      {multi ? '기간' : s.startTime ?? '종일'}
      {!multi && s.startTime && s.endTime && isValidTimeRange(s.startTime, s.endTime) && (
        <span className="block text-10.5px font-normal text-gray-400">~{s.endTime}</span>
      )}
    </span>
  );
}

// 카드 묶음 머리글
// collapsed/onToggle을 주면 제목을 눌러 내용을 접고 펼 수 있음 (접으면 제목과 개수만)
function SectionHeader({ icon, title, help, meta, actionLabel, onAction, collapsed, onToggle }: {
  icon: React.ReactNode; title: string; help?: string; meta?: React.ReactNode; actionLabel?: string; onAction?: () => void;
  collapsed?: boolean; onToggle?: () => void;
}) {
  return (
    <div className={`flex items-center justify-between gap-2 ${collapsed ? '' : 'mb-3'}`}>
      <div className="flex items-center gap-2 min-w-0">
        {onToggle ? (
          <button onClick={onToggle} aria-expanded={!collapsed} className="flex items-center gap-2 min-w-0 -my-1 py-1">
            {icon}
            <h2 className="text-14px font-semibold text-gray-900 dark:text-white whitespace-nowrap">{title}</h2>
          </button>
        ) : (
          <>
            {icon}
            <h2 className="text-14px font-semibold text-gray-900 dark:text-white">{title}</h2>
          </>
        )}
        {help && <HelpTip text={help} label={title} />}
        {meta}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        {onAction && !collapsed && (
          <button onClick={onAction} className="flex items-center text-xs font-medium text-gray-500 hover:text-leaf-700 dark:text-gray-400 dark:hover:text-leaf-300 transition-colors py-1">
            {actionLabel}<ChevronRight size={14} />
          </button>
        )}
        {onToggle && (
          <button onClick={onToggle} aria-label={collapsed ? `${title} 펼치기` : `${title} 접기`} aria-expanded={!collapsed}
            title={collapsed ? '펼치기' : '접기'} className="btn-icon w-7 h-7 -mr-1.5">
            <ChevronDown size={16} className={`transition-transform ${collapsed ? '-rotate-90' : ''}`} />
          </button>
        )}
      </div>
    </div>
  );
}

// 홈의 빠른 메모: 떠오른 생각을 바로 적고, 최근 메모 몇 개를 눌러 이어 쓰기
function MemoSection() {
  const { notes, addNote, setCurrentScreen } = useApp();
  const [collapsed, toggleCollapsed] = useCollapsed('home-memo');
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const recent = [...notes]
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 3);

  async function save() {
    const body = text.trim();
    if (!body || saving) return;
    // 첫 줄은 제목, 나머지는 본문 (메모 화면과 같은 모양으로 저장).
    // 첫 줄이 제목 길이 제한보다 길면 잘라 버리지 않고 전체를 본문에 그대로 둠
    const [first, ...rest] = body.split('\n');
    const title = first.trim();
    const fits = title.length <= LIMITS.title;
    setSaving(true);
    setError(false);
    try {
      await addNote(fits ? title : title.slice(0, LIMITS.title), fits ? rest.join('\n').trim() : body);
      setText('');
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  function open(n: Note) {
    requestOpenNote(n.id);
    setCurrentScreen('notes');
  }

  return (
    <section className="surface rounded-xl p-4">
      <SectionHeader
        icon={<StickyNote size={15} className="text-amber-500" />}
        title="메모"
        help={GUIDES.memo}
        meta={notes.length > 0 && <span className="count-pill">{notes.length}</span>}
        actionLabel="전체"
        onAction={() => setCurrentScreen('notes')}
        collapsed={collapsed}
        onToggle={toggleCollapsed}
      />
      {!collapsed && <>
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 focus-within:border-leaf-400 dark:focus-within:border-leaf-600 transition-colors">
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !e.nativeEvent.isComposing) { e.preventDefault(); save(); } }}
          maxLength={LIMITS.noteContent}
          rows={2}
          placeholder="떠오른 생각을 바로 적어 보세요"
          aria-label="빠른 메모"
          className="block w-full resize-none bg-transparent px-3 pt-2.5 text-13px text-gray-800 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none"
        />
        <div className="flex items-center justify-between gap-2 px-3 pb-2">
          <span className={`text-11px ${error ? 'text-red-600' : 'text-gray-400'}`}>
            {error ? '저장하지 못했어요. 다시 눌러 주세요.' : '첫 줄이 제목이 돼요'}
          </span>
          <button onClick={save} disabled={!text.trim() || saving}
            className="h-7 px-3 rounded-lg bg-leaf-600 hover:bg-leaf-700 disabled:opacity-40 disabled:hover:bg-leaf-600 text-white text-12px font-medium transition-colors">
            {saving ? '저장 중' : '저장'}
          </button>
        </div>
      </div>
      {recent.length > 0 && (
        <ul className="mt-2.5 space-y-0.5">
          {recent.map(n => {
            const preview = notePreview(n);
            return (
              <li key={n.id}>
                <button onClick={() => open(n)} className="w-full flex items-center gap-2 text-left py-1 group">
                  {n.pinned
                    ? <Pin size={12} className="flex-shrink-0 text-amber-500" />
                    : <span className="w-1.5 h-1.5 mx-[3px] flex-shrink-0 rounded-full bg-gray-300 dark:bg-gray-600" />}
                  <span className="min-w-0 flex-1 truncate text-13px">
                    <span className="text-gray-800 dark:text-gray-100 group-hover:text-leaf-700 dark:group-hover:text-leaf-300">{noteHeading(n)}</span>
                    {preview && <span className="ml-1.5 text-gray-400 dark:text-gray-500">{preview}</span>}
                  </span>
                  <span className="flex-shrink-0 text-11px text-gray-400 tabular-nums">{format(new Date(n.updatedAt), 'M/d')}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      </>}
    </section>
  );
}

// 새 홈: 창을 열자마자 오늘 하루가 한눈에 (오늘 할 일·일정·타임박스 + 요약 숫자).
// 예전 홈(월 달력)은 "달력" 메뉴로 옮김
export default function HomePage() {
  const {
    todos, schedules, ddays, timeblocks, monthlyGoals, notices, settings,
    toggleMonthlyGoal, setCurrentScreen, setSelectedDate,
  } = useApp();
  const now = useNow(60_000);
  const todayKey = format(now, 'yyyy-MM-dd');
  const monthKey = format(now, 'yyyy-MM');
  const holidays = useHolidays(todayKey, todayKey);

  // 홈 카드는 제목(또는 오른쪽 화살표)을 눌러 접어 둘 수 있음. 기기에 기억됨
  const [todoCollapsed, toggleTodoCollapsed] = useCollapsed('home-todo');
  const [scheduleCollapsed, toggleScheduleCollapsed] = useCollapsed('home-schedule');
  const [ddayCollapsed, toggleDdayCollapsed] = useCollapsed('home-dday');
  const [goalCollapsed, toggleGoalCollapsed] = useCollapsed('home-goal');
  const [showDoneSchedules, setShowDoneSchedules] = useState(false);
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
  // 2주 넘은 밀린 일은 "오래된 할 일"로 접어 두고 숫자에는 안 셈 (한동안 안 쓰다 와도 숫자에 겁먹지 않게)
  const { recent: overdue, old: oldOverdue } = splitOverdue(overdueTodos(todos, todayKey), todayKey);
  const dueSoon = dueSoonTodos(todos, now);
  const todosById = new Map(todos.map(t => [t.id, t]));
  const box = timeboxMinutes(timeblocks, todayKey, b => blockDone(b, todosById));

  // ── 오늘 목록 ──
  const todayTodos = applyListDisplaySettings(todos.filter(t => t.date === todayKey), settings);
  const todayAllSchedules = schedules
    .filter(s => scheduleOnDate(s, todayKey))
    .sort((a, b) => Number(isMultiDay(b)) - Number(isMultiDay(a)) || (a.startTime ?? '').localeCompare(b.startTime ?? ''));
  // 완료한 일정은 목록에서 빠짐 ("완료 n개"를 누르면 다시 보여서 체크를 풀 수 있음)
  const todaySchedules = todayAllSchedules.filter(s => !s.completed);
  const todayDoneSchedules = todayAllSchedules.filter(s => s.completed);
  const upcoming = nextSchedule(schedules, now);
  const upcomingDdays = [...ddays, ...todoDdays(todos, todayKey)]
    .filter(d => d.targetDate >= todayKey)
    .sort((a, b) => a.targetDate.localeCompare(b.targetDate))
    .slice(0, 4);
  const goals = monthlyGoals.filter(g => g.month === monthKey);
  const hidden = new Set(settings.hiddenFeatures);
  const todayHoliday = holidayLabel(holidays, todayKey);
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
  // 끝난 일정은 흐리게 (끝 시간이 없으면 시작부터 1시간, 여러 날 일정은 마지막 날이 아니면 아직 진행 중)
  const isPast = (s: ScheduleItem) => {
    if (!s.startTime || scheduleEndDate(s) !== todayKey || (isMultiDay(s) && !s.endTime)) return false;
    const end = timeRangeEnd(isMultiDay(s) ? '00:00' : s.startTime, s.endTime);
    return end !== null && end <= nowMinutes;
  };

  return (
    <div className="h-screen overflow-y-auto pb-[62px] lg:pb-0">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 xl:px-8 pt-6 sm:pt-8 pb-10">

        {/* ── 인사 + 날짜 ── */}
        <header className="flex items-start justify-between gap-3 mb-5">
          <div>
            <p className="text-13px font-medium text-leaf-700 dark:text-leaf-400">{greeting(now.getHours())}</p>
            <h1 className="page-title mt-0.5">
              {format(now, 'M월 d일 EEEE', { locale: ko })}
              {todayHoliday && <span className="ml-2 align-middle inline-flex items-center h-6 px-2 rounded-full bg-red-50 dark:bg-red-900/30 text-12px font-semibold text-red-600 dark:text-red-300">{todayHoliday}</span>}
            </h1>
          </div>
          <div className="flex items-center gap-2 pt-1">
            {/* 폰·태블릿 검색 (PC는 왼쪽 메뉴의 검색이나 Ctrl/⌘+K) */}
            <button onClick={openSearch} aria-label="검색" title="검색" className="lg:hidden btn-secondary w-8 h-8">
              <Search size={15} />
            </button>
            {/* 폰·태블릿은 하단 탭에 저장소가 없어서 여기서 들어감 */}
            {!hidden.has('all') && (
              <button onClick={() => setCurrentScreen('all')} className="lg:hidden btn-secondary h-8 px-3 text-13px">
                <Archive size={15} className="text-gray-500 dark:text-gray-400" />
                저장소
              </button>
            )}
            <button onClick={openNotice} aria-label="공지사항" title="공지사항" className="btn-secondary relative w-8 h-8">
              <Megaphone size={15} />
              {hasUnreadNotice && <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-gray-50 dark:ring-gray-950" />}
            </button>
            <button onClick={() => setShowAchievement(true)} className="btn-secondary h-8 px-3 text-13px">
              <BarChart3 size={15} className="text-leaf-600 dark:text-leaf-400" />
              <span className="hidden sm:inline">성취 리포트</span>
            </button>
          </div>
        </header>

        {/* ── 요약 숫자 4칸 ── */}
        <section className="grid grid-cols-4 gap-2 lg:gap-3 mb-4" aria-label="오늘 요약">
          <StatCard
            label="오늘 진행률"
            shortLabel="오늘"
            value={today.total ? todayRate : '–'}
            unit={today.total ? '%' : undefined}
            sub={today.total ? `할 일 ${today.total}개 중 ${today.done}개 완료` : '오늘 할 일이 아직 없어요'}
            icon={<ProgressRing pct={todayRate} />}
          />
          <StatCard
            label="연속 달성"
            shortLabel="연속"
            value={streak}
            unit="일"
            sub={streak > 0 ? '하루 1개 이상 완료한 날' : '오늘 하나 끝내면 시작돼요'}
            icon={<span className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${streak > 0 ? 'bg-orange-50 dark:bg-orange-900/30 text-orange-500' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}><Flame size={20} /></span>}
            onClick={() => setShowAchievement(true)}
          />
          <StatCard
            label="이번 주 달성률"
            shortLabel="이번 주"
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
            shortLabel="밀린 일"
            value={overdue.length}
            unit="개"
            tone={overdue.length > 0 ? 'warn' : 'default'}
            sub={dueSoon.length > 0 ? `3일 안에 마감 ${dueSoon.length}개`
              : overdue.length > 0 ? '눌러서 오늘로 옮기거나 정리하기'
                : oldOverdue.length > 0 ? `2주 넘은 할 일 ${oldOverdue.length}개는 접어 뒀어요` : '밀린 일 없이 깔끔해요'}
            icon={<span className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${overdue.length > 0 ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-600' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}><AlertCircle size={20} /></span>}
            onClick={overdue.length > 0 || oldOverdue.length > 0 ? () => setShowOverdue(true) : undefined}
          />
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-5 lg:items-start gap-4">
          <div className="lg:col-span-3 flex flex-col gap-4">
            {/* ── 오늘 할 일 ── */}
            <section className="surface rounded-xl p-4">
              <SectionHeader
                icon={<CalendarCheck size={15} className="text-leaf-600 dark:text-leaf-400" />}
                title="오늘 할 일"
                help={GUIDES.todo}
                meta={today.total > 0 && <span className="count-pill">{today.done}/{today.total}</span>}
                actionLabel="달력에서 보기"
                onAction={() => goCalendar(todayKey)}
                collapsed={todoCollapsed}
                onToggle={toggleTodoCollapsed}
              />
              {!todoCollapsed && <>
              {todayTodos.length === 0 && (
                <p className="text-13px text-gray-400 dark:text-gray-500 py-2">오늘 할 일을 아래에 적어보세요</p>
              )}
              <CategoryTodoGroups todos={todayTodos} onEdit={todo => setTodoModal({ todo })} className="space-y-4" />
              <div className="mt-3">
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
                          <button onClick={() => setTodoModal({ todo: t })} className="w-full flex items-center gap-2 text-left py-1 text-13px text-gray-700 dark:text-gray-200 hover:text-leaf-700 dark:hover:text-leaf-300">
                            <span className={`flex-shrink-0 text-11px font-semibold tabular-nums px-1.5 py-px rounded-md ${diff === 0 ? 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
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
              </>}
            </section>

          </div>

          <div className="lg:col-span-2 flex flex-col gap-4">
            {/* ── 오늘 타임박스 (오늘 하루만 세로로) ── */}
            {!hidden.has('timebox') && <div>
              <TodayTimeline />
              {box.planned > 0 && (
                <p className="text-11.5px text-gray-500 dark:text-gray-400 mt-1.5 px-1">
                  오늘 타임박스 {durationLabel(box.planned)} 중 <span className="font-semibold text-gray-700 dark:text-gray-300">{durationLabel(box.done)}</span> 완료
                </p>
              )}
            </div>}
            {/* ── 오늘 일정 ── */}
            <section className="surface rounded-xl p-4">
              <SectionHeader
                icon={<CalendarClock size={15} className="text-blue-500" />}
                title="오늘 일정"
                help={GUIDES.schedule}
                meta={todaySchedules.length > 0 && <span className="count-pill">{todaySchedules.length}</span>}
                actionLabel="추가"
                onAction={() => setScheduleModal({})}
                collapsed={scheduleCollapsed}
                onToggle={toggleScheduleCollapsed}
              />
              {!scheduleCollapsed && <>
              {todaySchedules.length === 0 ? (
                <p className="text-13px text-gray-400 dark:text-gray-500">
                  {todayDoneSchedules.length > 0 ? '오늘 일정을 모두 끝냈어요' : '오늘은 정해진 일정이 없어요'}
                  {upcoming && <><br /><span className="text-gray-500 dark:text-gray-400">다음 일정: {format(new Date(upcoming.date + 'T00:00'), 'M/d(EEE)', { locale: ko })} {timeRangeLabel(upcoming.startTime, upcoming.endTime)} {upcoming.title}</span></>}
                </p>
              ) : (
                <ul className="space-y-1">
                  {todaySchedules.map(s => (
                    <li key={s.id} className={`flex items-center gap-2.5 px-2 -mx-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/60 ${isPast(s) ? 'opacity-50' : ''}`}>
                      <ScheduleCheck schedule={s} />
                      <button onClick={() => setScheduleModal({ schedule: s })}
                        className="flex-1 min-w-0 flex items-center gap-2.5 text-left py-1.5">
                        <ScheduleTime s={s} />
                        <span className="text-13px text-gray-800 dark:text-gray-100 truncate">{s.title}</span>
                        {isMultiDay(s) && <span className="flex-shrink-0 text-11px tabular-nums text-gray-400">~{format(parseISO(scheduleEndDate(s)), 'M/d')}</span>}
                        {upcoming?.id === s.id && <span className="ml-auto flex-shrink-0 text-10.5px font-semibold text-blue-500 dark:text-blue-400 flex items-center gap-0.5"><Clock size={10} />다음</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {todayDoneSchedules.length > 0 && (
                <div className="mt-2">
                  <button onClick={() => setShowDoneSchedules(v => !v)} aria-expanded={showDoneSchedules}
                    className="flex items-center gap-1 text-12px font-medium text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 py-1">
                    완료한 일정 {todayDoneSchedules.length}개
                    <ChevronDown size={13} className={`transition-transform ${showDoneSchedules ? 'rotate-180' : ''}`} />
                  </button>
                  {showDoneSchedules && (
                    <ul className="space-y-1">
                      {todayDoneSchedules.map(s => (
                        <li key={s.id} className="flex items-center gap-2.5 px-2 -mx-2 rounded-lg opacity-60">
                          <ScheduleCheck schedule={s} />
                          <button onClick={() => setScheduleModal({ schedule: s })} className="flex-1 min-w-0 flex items-center gap-2.5 text-left py-1.5">
                            <ScheduleTime s={s} />
                            <span className="text-13px text-gray-500 line-through truncate">{s.title}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              </>}
            </section>

            {/* ── 다가오는 D-Day ── */}
            <section className="surface rounded-xl p-4">
              <SectionHeader
                icon={<Flag size={15} className="text-rose-500" />}
                title="다가오는 D-Day"
                help={GUIDES.dday}
                actionLabel="달력"
                onAction={() => goCalendar()}
                collapsed={ddayCollapsed}
                onToggle={toggleDdayCollapsed}
              />
              {!ddayCollapsed && (upcomingDdays.length === 0 ? (
                <p className="text-13px text-gray-400 dark:text-gray-500">다가오는 D-Day가 없어요</p>
              ) : (
                <ul className="space-y-1">
                  {upcomingDdays.map(d => {
                    const diff = daysUntil(d.targetDate, now);
                    return (
                      <li key={d.id}>
                        <button onClick={() => openDday(d)} className="w-full flex items-center gap-2.5 text-left py-1 hover:text-leaf-700 dark:hover:text-leaf-300">
                          <span className={`w-14 flex-shrink-0 whitespace-nowrap text-12px font-bold tabular-nums ${diff <= 3 ? 'text-rose-500' : 'text-gray-500 dark:text-gray-400'}`}>{ddayLabel(diff)}</span>
                          <span className="text-13px text-gray-800 dark:text-gray-100 truncate">{d.title}</span>
                          <span className="ml-auto flex-shrink-0 text-11px text-gray-400 tabular-nums">{format(new Date(d.targetDate + 'T00:00'), 'M/d')}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ))}
            </section>

            {/* ── 이번 달 목표 ── */}
            <section className="surface rounded-xl p-4">
              <SectionHeader
                icon={<Target size={15} className="text-leaf-600 dark:text-leaf-400" />}
                title={`${format(now, 'M월')} 목표`}
                help={GUIDES.goal}
                meta={goals.length > 0 && <span className="count-pill">{goalsDone}/{goals.length}</span>}
                actionLabel="달력"
                onAction={() => goCalendar()}
                collapsed={goalCollapsed}
                onToggle={toggleGoalCollapsed}
              />
              {!goalCollapsed && (goals.length === 0 ? (
                <p className="text-13px text-gray-400 dark:text-gray-500">달력 화면에서 이번 달 목표를 세워보세요</p>
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
                          <span className={`text-13px truncate ${g.completed ? 'line-through text-gray-400' : 'text-gray-800 dark:text-gray-100'}`}>{g.title}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              ))}
            </section>

            {/* ── 메모 ── */}
            {!hidden.has('notes') && <MemoSection />}

            <button onClick={() => goCalendar()} className="btn-secondary h-10 text-13px justify-center">
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
        <OverdueModal onEdit={todo => setTodoModal({ todo })} onClose={() => setShowOverdue(false)} />
      )}
      {showAchievement && <AchievementModal onClose={() => setShowAchievement(false)} />}
      {showNotice && <NoticeModal onClose={() => setShowNotice(false)} />}
    </div>
  );
}
