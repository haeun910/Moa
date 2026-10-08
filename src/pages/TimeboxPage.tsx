import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type React from 'react';
import { ChevronLeft, ChevronRight, Plus, ListChecks, PanelRightClose, PanelRightOpen, Repeat, X } from 'lucide-react';
import { addDays, addWeeks, eachDayOfInterval, endOfWeek, format, parseISO, startOfWeek } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useApp } from '../context/AppContext';
import { useNow } from '../hooks/useNow';
import { useMediaQuery } from '../hooks/useMediaQuery';
import TimeBlockModal from '../components/TimeBlockModal';
import type { TimeBlockDraft } from '../components/TimeBlockModal';
import TodoPicker from '../components/TodoPicker';
import {
  DAY_MINUTES, DEFAULT_BLOCK_MINUTES, SNAP_MINUTES,
  blockColor, blockDone, blockTitle, clamp, durationLabel, findFreeSlot, formatMinutes,
  getBlockSpan, layoutOverlaps, minutesNow, snapMinutes, spanToRange,
} from '../lib/timebox';
import type { BlockSpan } from '../lib/timebox';
import type { TimeBlock, Todo } from '../types';

const HOUR_PX = 52;
const MIN_PX = HOUR_PX / 60;
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DRAG_THRESHOLD_PX = 4;
const PANEL_PREF_KEY = 'timebox-panel-open';

// 끌기 상태: 빈 곳을 끌어 새 블록 / 블록 옮기기 / 아래 끝을 끌어 길이 조절 / 할 일 목록에서 끌어오기
type Drag =
  | { kind: 'create'; dateKey: string; anchor: number; current: number }
  | { kind: 'move'; id: string; dateKey: string; startMin: number; duration: number; grab: number; originX: number; originY: number; active: boolean }
  | { kind: 'resize'; id: string; dateKey: string; startMin: number; endMin: number }
  | { kind: 'todo'; todo: Todo; x: number; y: number; originX: number; originY: number; active: boolean; target: { dateKey: string; startMin: number } | null };

type ModalState = { block: TimeBlock } | { draft: TimeBlockDraft };

function weekdayTone(dow: number) {
  if (dow === 0) return 'text-red-500 dark:text-red-400';
  if (dow === 6) return 'text-blue-500 dark:text-blue-400';
  return 'text-gray-700 dark:text-gray-200';
}

export default function TimeboxPage() {
  const { timeblocks, todos, categories, addTimeBlock, updateTimeBlock, toggleTimeBlock, ensureTimeBlocksFrom } = useApp();
  const now = useNow();
  const todayKey = format(now, 'yyyy-MM-dd');
  const nowMin = minutesNow(now);

  const isWide = useMediaQuery('(min-width: 768px)'); // 7일을 나란히
  const isDesktop = useMediaQuery('(min-width: 1024px)'); // 오른쪽 할 일 패널

  const [weekRef, setWeekRef] = useState(() => new Date());
  const [focusDay, setFocusDay] = useState(todayKey); // 좁은 화면에서 보고 있는 하루
  const [panelOpen, setPanelOpen] = useState(() => {
    try { return localStorage.getItem(PANEL_PREF_KEY) !== '0'; } catch { return true; }
  });
  const [sheetOpen, setSheetOpen] = useState(false);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);

  const dragRef = useRef<Drag | null>(null);
  const colRefs = useRef(new Map<string, HTMLDivElement>());
  const scrollRef = useRef<HTMLDivElement>(null);
  const suppressClickRef = useRef(false);
  const lastPointerTypeRef = useRef<string>('mouse');

  const weekStart = startOfWeek(weekRef);
  const days = eachDayOfInterval({ start: weekStart, end: endOfWeek(weekRef) }).map(d => format(d, 'yyyy-MM-dd'));
  const visibleDays = isWide ? days : [focusDay];
  const weekStartKey = days[0];

  useEffect(() => { ensureTimeBlocksFrom(weekStartKey); }, [weekStartKey, ensureTimeBlocksFrom]);

  // 처음 열면 지금 시각(이번 주가 아니면 아침 7시) 근처로 스크롤
  useLayoutEffect(() => {
    if (!scrollRef.current) return;
    const hour = days.includes(todayKey) ? Math.max(0, nowMin / 60 - 1.5) : 7;
    scrollRef.current.scrollTop = hour * HOUR_PX;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const todosById = useMemo(() => new Map(todos.map(t => [t.id, t])), [todos]);
  const categoriesById = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories]);

  const spansByDay = useMemo(() => {
    const map = new Map<string, { block: TimeBlock; span: BlockSpan }[]>();
    for (const block of timeblocks) {
      const span = getBlockSpan(block);
      if (!map.has(span.dateKey)) map.set(span.dateKey, []);
      map.get(span.dateKey)!.push({ block, span });
    }
    return map;
  }, [timeblocks]);

  // 끄는 동안에는 옮겨질 위치를 미리 보여줌
  function displaySpan(block: TimeBlock, span: BlockSpan): BlockSpan {
    if (drag?.kind === 'move' && drag.active && drag.id === block.id) {
      return { dateKey: drag.dateKey, startMin: drag.startMin, endMin: drag.startMin + drag.duration };
    }
    if (drag?.kind === 'resize' && drag.id === block.id) {
      return { dateKey: drag.dateKey, startMin: drag.startMin, endMin: drag.endMin };
    }
    return span;
  }

  const displayByDay = new Map<string, { block: TimeBlock; span: BlockSpan }[]>();
  for (const items of spansByDay.values()) {
    for (const { block, span } of items) {
      const shown = displaySpan(block, span);
      if (!displayByDay.has(shown.dateKey)) displayByDay.set(shown.dateKey, []);
      displayByDay.get(shown.dateKey)!.push({ block, span: shown });
    }
  }

  const weekItems = days.flatMap(d => spansByDay.get(d) ?? []);
  const weekPlanned = weekItems.reduce((sum, { span }) => sum + (span.endMin - span.startMin), 0);
  const weekDone = weekItems.filter(({ block }) => blockDone(block, todosById)).length;

  // ── 좌표 → (날짜, 분) ────────────────────────────────
  function minuteInColumn(dateKey: string, clientY: number): number | null {
    const el = colRefs.current.get(dateKey);
    if (!el) return null;
    return clamp((clientY - el.getBoundingClientRect().top) / MIN_PX, 0, DAY_MINUTES);
  }

  function dayAtX(clientX: number): string | null {
    for (const [dateKey, el] of colRefs.current) {
      const r = el.getBoundingClientRect();
      if (clientX >= r.left && clientX < r.right) return dateKey;
    }
    return null;
  }

  function insideGrid(clientX: number, clientY: number): boolean {
    const r = scrollRef.current?.getBoundingClientRect();
    return Boolean(r && clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom);
  }

  function setDragState(next: Drag | null) {
    dragRef.current = next;
    setDrag(next);
  }

  function suppressNextClick() {
    suppressClickRef.current = true;
    window.setTimeout(() => { suppressClickRef.current = false; }, 50);
  }

  // ── 끌기 진행/끝 (window에 붙여서 칸 밖으로 나가도 계속 따라가게) ──
  const handlersRef = useRef<{ move: (e: PointerEvent) => void; up: (e: PointerEvent) => void }>({ move: () => {}, up: () => {} });
  handlersRef.current = {
    move(e) {
      const d = dragRef.current;
      if (!d) return;
      if (d.kind === 'create') {
        const min = minuteInColumn(d.dateKey, e.clientY);
        if (min !== null) setDragState({ ...d, current: clamp(snapMinutes(min), 0, DAY_MINUTES) });
      } else if (d.kind === 'move') {
        if (!d.active && Math.hypot(e.clientX - d.originX, e.clientY - d.originY) < DRAG_THRESHOLD_PX) return;
        const dateKey = dayAtX(e.clientX) ?? d.dateKey;
        const min = minuteInColumn(dateKey, e.clientY);
        if (min === null) return;
        setDragState({ ...d, active: true, dateKey, startMin: clamp(snapMinutes(min - d.grab), 0, DAY_MINUTES - d.duration) });
      } else if (d.kind === 'resize') {
        const min = minuteInColumn(d.dateKey, e.clientY);
        if (min !== null) setDragState({ ...d, endMin: clamp(snapMinutes(min), d.startMin + SNAP_MINUTES, DAY_MINUTES) });
      } else if (d.kind === 'todo') {
        if (!d.active && Math.hypot(e.clientX - d.originX, e.clientY - d.originY) < DRAG_THRESHOLD_PX) return;
        let target: { dateKey: string; startMin: number } | null = null;
        const dateKey = insideGrid(e.clientX, e.clientY) ? dayAtX(e.clientX) : null;
        if (dateKey) {
          const min = minuteInColumn(dateKey, e.clientY);
          if (min !== null) target = { dateKey, startMin: clamp(snapMinutes(min - SNAP_MINUTES), 0, DAY_MINUTES - DEFAULT_BLOCK_MINUTES) };
        }
        setDragState({ ...d, active: true, x: e.clientX, y: e.clientY, target });
      }
    },
    up() {
      const d = dragRef.current;
      setDragState(null);
      if (!d) return;
      if (d.kind === 'create') {
        suppressNextClick();
        let lo = Math.min(d.anchor, d.current);
        let hi = Math.max(d.anchor, d.current);
        if (hi - lo < SNAP_MINUTES) {
          lo = Math.floor(d.anchor / 30) * 30;
          hi = Math.min(DAY_MINUTES, lo + DEFAULT_BLOCK_MINUTES);
        }
        setModal({ draft: { dateKey: d.dateKey, startMin: lo, endMin: hi } });
      } else if (d.kind === 'move' && d.active) {
        suppressNextClick();
        updateTimeBlock(d.id, spanToRange(d.dateKey, d.startMin, d.startMin + d.duration));
      } else if (d.kind === 'resize') {
        suppressNextClick();
        updateTimeBlock(d.id, spanToRange(d.dateKey, d.startMin, d.endMin));
      } else if (d.kind === 'todo' && d.active) {
        suppressNextClick();
        if (d.target) {
          const { dateKey, startMin } = d.target;
          addTimeBlock({
            title: d.todo.title, todoId: d.todo.id, color: null, remindMinutes: 0,
            ...spanToRange(dateKey, startMin, Math.min(DAY_MINUTES, startMin + DEFAULT_BLOCK_MINUTES)),
          });
        }
      }
    },
  };

  const dragging = drag !== null;
  useEffect(() => {
    if (!dragging) return;
    const move = (e: PointerEvent) => handlersRef.current.move(e);
    const up = (e: PointerEvent) => handlersRef.current.up(e);
    const cancel = () => setDragState(null);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
    };
  }, [dragging]);

  // ── 끌기 시작 ─────────────────────────────────────────
  function handleColumnPointerDown(e: React.PointerEvent, dateKey: string) {
    lastPointerTypeRef.current = e.pointerType;
    if (e.pointerType !== 'mouse' || e.button !== 0) return; // 터치는 스크롤을 막지 않도록 탭으로만 추가
    if ((e.target as HTMLElement).closest('[data-block]')) return;
    const min = minuteInColumn(dateKey, e.clientY);
    if (min === null) return;
    e.preventDefault();
    const anchor = Math.floor(min / SNAP_MINUTES) * SNAP_MINUTES;
    setDragState({ kind: 'create', dateKey, anchor, current: anchor });
  }

  function handleColumnClick(e: React.MouseEvent, dateKey: string) {
    if (suppressClickRef.current || lastPointerTypeRef.current === 'mouse') return;
    if ((e.target as HTMLElement).closest('[data-block]')) return;
    const min = minuteInColumn(dateKey, e.clientY);
    if (min === null) return;
    const lo = Math.floor(min / 30) * 30;
    setModal({ draft: { dateKey, startMin: lo, endMin: Math.min(DAY_MINUTES, lo + DEFAULT_BLOCK_MINUTES) } });
  }

  function handleBlockPointerDown(e: React.PointerEvent, block: TimeBlock, span: BlockSpan) {
    lastPointerTypeRef.current = e.pointerType;
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button, [data-resize]')) return;
    e.stopPropagation();
    e.preventDefault();
    const min = minuteInColumn(span.dateKey, e.clientY) ?? span.startMin;
    setDragState({
      kind: 'move', id: block.id, dateKey: span.dateKey, startMin: span.startMin,
      duration: span.endMin - span.startMin, grab: min - span.startMin,
      originX: e.clientX, originY: e.clientY, active: false,
    });
  }

  function handleResizePointerDown(e: React.PointerEvent, block: TimeBlock, span: BlockSpan) {
    lastPointerTypeRef.current = e.pointerType;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    setDragState({ kind: 'resize', id: block.id, dateKey: span.dateKey, startMin: span.startMin, endMin: span.endMin });
  }

  function handleTodoDragStart(e: React.PointerEvent, todo: Todo) {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    e.preventDefault();
    setDragState({ kind: 'todo', todo, x: e.clientX, y: e.clientY, originX: e.clientX, originY: e.clientY, active: false, target: null });
  }

  // 할 일을 누르면: 보고 있는 날(이번 주에 오늘이 있으면 오늘)의 다음 빈 시간에 1시간짜리로 제안
  function handleTodoPick(todo: Todo) {
    if (suppressClickRef.current) return;
    const dateKey = isWide ? (days.includes(todayKey) ? todayKey : days[0]) : focusDay;
    const from = dateKey === todayKey ? nowMin : 9 * 60;
    const spans = (spansByDay.get(dateKey) ?? []).map(({ span }) => span);
    const startMin = findFreeSlot(spans, from, DEFAULT_BLOCK_MINUTES);
    setSheetOpen(false);
    setModal({ draft: { dateKey, startMin, endMin: Math.min(DAY_MINUTES, startMin + DEFAULT_BLOCK_MINUTES), todoId: todo.id } });
  }

  function openNewBlock() {
    const dateKey = isWide ? (days.includes(todayKey) ? todayKey : days[0]) : focusDay;
    const from = dateKey === todayKey ? nowMin : 9 * 60;
    const spans = (spansByDay.get(dateKey) ?? []).map(({ span }) => span);
    const startMin = findFreeSlot(spans, from, DEFAULT_BLOCK_MINUTES);
    setModal({ draft: { dateKey, startMin, endMin: Math.min(DAY_MINUTES, startMin + DEFAULT_BLOCK_MINUTES) } });
  }

  function shiftWeek(delta: number) {
    setWeekRef(w => addWeeks(w, delta));
    setFocusDay(d => format(addDays(parseISO(d), delta * 7), 'yyyy-MM-dd'));
  }

  function goToday() {
    setWeekRef(new Date());
    setFocusDay(todayKey);
    if (scrollRef.current) scrollRef.current.scrollTo({ top: Math.max(0, nowMin / 60 - 1.5) * HOUR_PX, behavior: 'smooth' });
  }

  function togglePanel() {
    setPanelOpen(v => {
      try { localStorage.setItem(PANEL_PREF_KEY, v ? '0' : '1'); } catch { /* 저장 못 해도 동작에는 문제 없음 */ }
      return !v;
    });
  }

  const weekLabel = `${format(parseISO(days[0]), 'M월 d일', { locale: ko })} – ${format(parseISO(days[6]), days[0].slice(0, 7) === days[6].slice(0, 7) ? 'd일' : 'M월 d일', { locale: ko })}`;
  const showPanel = isDesktop && panelOpen;
  const dragCursor = drag?.kind === 'resize' || drag?.kind === 'create' ? 'cursor-ns-resize' : drag ? 'cursor-grabbing' : '';

  return (
    <div className={`flex flex-col h-[100svh] pb-[62px] lg:pb-0 ${dragging ? `select-none ${dragCursor}` : ''}`}>
      {/* ── 머리글 ── */}
      <header className="flex-shrink-0 px-4 sm:px-6 xl:px-8 pt-5 sm:pt-7 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="min-w-0">
              <h1 className="page-title">타임박스</h1>
              <p className="page-subtitle">
                {weekLabel}
                {weekItems.length > 0 && (
                  <span className="text-gray-400 dark:text-gray-500"> · 계획 {durationLabel(weekPlanned)} · 완료 {weekDone}/{weekItems.length}</span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={() => shiftWeek(-1)} aria-label="이전 주" className="btn-icon"><ChevronLeft size={18} /></button>
            <button onClick={() => shiftWeek(1)} aria-label="다음 주" className="btn-icon"><ChevronRight size={18} /></button>
            <button onClick={goToday} className="btn-secondary h-8 px-3 text-[13px]">오늘</button>
            {isDesktop && (
              <button onClick={openNewBlock} className="btn-primary h-8 px-3 text-[13px]">
                <Plus size={15} strokeWidth={2.4} />
                추가
              </button>
            )}
            {isDesktop ? (
              <button onClick={togglePanel} aria-label={panelOpen ? '할 일 패널 닫기' : '할 일 패널 열기'} title={panelOpen ? '할 일 패널 닫기' : '할 일 패널 열기'}
                className="btn-secondary w-8 h-8">
                {panelOpen ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />}
              </button>
            ) : (
              <button onClick={() => setSheetOpen(true)} className="btn-secondary h-8 px-3 text-[13px]">
                <ListChecks size={15} className="text-leaf-600 dark:text-leaf-400" />
                할 일 넣기
              </button>
            )}
          </div>
        </div>

        {/* 좁은 화면: 이번 주 7일 중 하루 고르기 */}
        {!isWide && (
          <div className="mt-4 grid grid-cols-7 gap-1" role="tablist" aria-label="요일 선택">
            {days.map(dateKey => {
              const day = parseISO(dateKey);
              const selected = dateKey === focusDay;
              const isToday = dateKey === todayKey;
              const count = spansByDay.get(dateKey)?.length ?? 0;
              return (
                <button key={dateKey} role="tab" aria-selected={selected} onClick={() => setFocusDay(dateKey)}
                  className={`flex flex-col items-center gap-0.5 py-1.5 rounded-xl transition-colors ${
                    selected ? 'bg-leaf-600 dark:bg-leaf-500 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}>
                  <span className={`text-[10.5px] font-medium ${selected ? 'text-white/80' : 'text-gray-400 dark:text-gray-500'}`}>
                    {format(day, 'EEEEE', { locale: ko })}
                  </span>
                  <span className={`text-[15px] font-bold tabular-nums leading-tight ${
                    selected ? 'text-white' : isToday ? 'text-leaf-600 dark:text-leaf-400' : weekdayTone(day.getDay())
                  }`}>
                    {format(day, 'd')}
                  </span>
                  <span className={`w-1 h-1 rounded-full ${count ? (selected ? 'bg-white' : 'bg-leaf-500') : 'bg-transparent'}`} />
                </button>
              );
            })}
          </div>
        )}
      </header>

      {/* ── 본문: 시간표 + (데스크톱) 할 일 패널 ── */}
      <div className="flex-1 min-h-0 flex gap-4 px-4 sm:px-6 xl:px-8 pb-4">
        <div className="flex-1 min-w-0 rounded-2xl surface overflow-hidden flex flex-col">
          {/* 요일 머리글 (넓은 화면) */}
          {isWide && (
            <div className="flex-shrink-0 flex border-b border-gray-100 dark:border-gray-800 pr-[4px]">
              <div className="w-12 flex-shrink-0" />
              {days.map(dateKey => {
                const day = parseISO(dateKey);
                const isToday = dateKey === todayKey;
                const items = spansByDay.get(dateKey) ?? [];
                const planned = items.reduce((s, { span }) => s + span.endMin - span.startMin, 0);
                return (
                  <div key={dateKey} className="flex-1 min-w-0 border-l border-gray-100 dark:border-gray-800 px-2 py-2">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[11px] font-semibold ${isToday ? 'text-leaf-700 dark:text-leaf-300' : 'text-gray-400 dark:text-gray-500'}`}>
                        {format(day, 'EEE', { locale: ko })}
                      </span>
                      <span className={`inline-flex items-center justify-center min-w-[24px] h-6 px-1 rounded-full text-[13px] font-bold tabular-nums ${
                        isToday ? 'bg-leaf-600 dark:bg-leaf-500 text-white' : weekdayTone(day.getDay())
                      }`}>
                        {format(day, 'd')}
                      </span>
                    </div>
                    <p className="text-[10.5px] tabular-nums text-gray-400 dark:text-gray-500 mt-0.5 truncate">
                      {planned ? durationLabel(planned) : ' '}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          {/* 시간 격자 */}
          <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
            <div className="relative flex" style={{ height: DAY_MINUTES * MIN_PX }}>
              {/* 시간 눈금 */}
              <div className="relative w-12 flex-shrink-0">
                {HOURS.slice(1).map(h => (
                  <span key={h} className="absolute right-2 -translate-y-1/2 text-[10.5px] tabular-nums text-gray-400 dark:text-gray-500"
                    style={{ top: h * HOUR_PX }}>
                    {formatMinutes(h * 60)}
                  </span>
                ))}
              </div>
              {/* 가로 줄 (정각 실선, 30분 점선) */}
              <div className="absolute inset-y-0 left-12 right-0 pointer-events-none" aria-hidden>
                {HOURS.map(h => (
                  <div key={h}>
                    {h > 0 && <div className="absolute inset-x-0 border-t border-gray-100 dark:border-gray-800" style={{ top: h * HOUR_PX }} />}
                    <div className="absolute inset-x-0 border-t border-dashed border-gray-100/70 dark:border-gray-800/60" style={{ top: h * HOUR_PX + HOUR_PX / 2 }} />
                  </div>
                ))}
              </div>

              {visibleDays.map(dateKey => {
                const items = displayByDay.get(dateKey) ?? [];
                const layout = layoutOverlaps(items.map(({ block, span }) => ({ id: block.id, startMin: span.startMin, endMin: span.endMin })));
                const isToday = dateKey === todayKey;
                const ghost =
                  drag?.kind === 'create' && drag.dateKey === dateKey
                    ? { lo: Math.min(drag.anchor, drag.current), hi: Math.max(drag.anchor, drag.current, Math.min(drag.anchor, drag.current) + SNAP_MINUTES) }
                    : drag?.kind === 'todo' && drag.target?.dateKey === dateKey
                      ? { lo: drag.target.startMin, hi: Math.min(DAY_MINUTES, drag.target.startMin + DEFAULT_BLOCK_MINUTES) }
                      : null;
                return (
                  <div
                    key={dateKey}
                    ref={el => { if (el) colRefs.current.set(dateKey, el); else colRefs.current.delete(dateKey); }}
                    onPointerDown={e => handleColumnPointerDown(e, dateKey)}
                    onClick={e => handleColumnClick(e, dateKey)}
                    className={`relative flex-1 min-w-0 border-l border-gray-100 dark:border-gray-800 ${isToday && isWide ? 'bg-leaf-50/40 dark:bg-leaf-900/10' : ''}`}
                  >
                    {items.map(({ block, span }) => (
                      <BlockView
                        key={block.id}
                        block={block}
                        span={span}
                        layout={layout.get(block.id) ?? { col: 0, cols: 1 }}
                        title={blockTitle(block, todosById)}
                        color={blockColor(block, todosById, categoriesById)}
                        done={blockDone(block, todosById)}
                        isNow={isToday && span.startMin <= nowMin && nowMin < span.endMin}
                        isPast={dateKey < todayKey || (isToday && span.endMin <= nowMin)}
                        lifted={(drag?.kind === 'move' && drag.active && drag.id === block.id) || (drag?.kind === 'resize' && drag.id === block.id)}
                        onPointerDown={e => handleBlockPointerDown(e, block, span)}
                        onResizePointerDown={e => handleResizePointerDown(e, block, span)}
                        onClick={() => { if (!suppressClickRef.current) setModal({ block }); }}
                        onToggle={() => toggleTimeBlock(block.id)}
                      />
                    ))}

                    {ghost && (
                      <div className="absolute left-1 right-1 rounded-lg border-2 border-dashed border-leaf-500 bg-leaf-100/60 dark:bg-leaf-900/30 pointer-events-none px-1.5 py-0.5"
                        style={{ top: ghost.lo * MIN_PX, height: (ghost.hi - ghost.lo) * MIN_PX }}>
                        <span className="text-[10.5px] font-semibold tabular-nums text-leaf-800 dark:text-leaf-200">
                          {formatMinutes(ghost.lo)} – {formatMinutes(ghost.hi)}
                        </span>
                      </div>
                    )}

                    {isToday && (
                      <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ top: nowMin * MIN_PX }} aria-hidden>
                        <div className="absolute -left-[5px] -top-[4.5px] w-[9px] h-[9px] rounded-full bg-red-500" />
                        <div className="h-[1.5px] bg-red-500" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 데스크톱: 할 일 패널 - 눌러서 넣거나 시간표로 끌어다 놓기 */}
        {showPanel && (
          <aside className="w-[340px] wide:w-[408px] flex-shrink-0 rounded-2xl surface p-3.5 flex flex-col min-h-0">
            <div className="flex-shrink-0 mb-2.5">
              <p className="text-[13px] font-semibold text-gray-900 dark:text-white">할 일 넣기</p>
              <p className="text-[11.5px] text-gray-500 dark:text-gray-400 mt-0.5">시간표로 끌어다 놓거나 눌러서 시간을 정하세요</p>
            </div>
            <div className="flex-1 min-h-0">
              <TodoPicker rangeFrom={days[0]} rangeTo={days[6]} rangeLabel="이번 주" onPick={handleTodoPick} onDragStart={handleTodoDragStart} />
            </div>
          </aside>
        )}
      </div>

      {/* 새 블록 버튼 (데스크톱은 머리글의 "추가" 버튼) */}
      {!isDesktop && (
        <button onClick={openNewBlock} aria-label="타임박스 추가"
          className="fixed bottom-20 right-6 z-30 w-14 h-14 rounded-2xl btn-primary shadow-lg shadow-leaf-900/20">
          <Plus size={24} />
        </button>
      )}

      {/* 할 일을 끄는 동안 마우스를 따라다니는 이름표 */}
      {drag?.kind === 'todo' && drag.active && (
        <div className="fixed z-[70] pointer-events-none px-2.5 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-medium shadow-xl max-w-[220px] truncate"
          style={{ left: drag.x + 14, top: drag.y + 10 }}>
          {drag.todo.title}
        </div>
      )}

      {/* 좁은 화면: 할 일 고르기 시트 */}
      {sheetOpen && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setSheetOpen(false); }}>
          <div className="modal-panel max-w-md h-[70svh] sm:h-[560px]">
            <div className="px-5 pt-5 pb-3 flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-white">할 일 넣기</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {format(parseISO(focusDay), 'M월 d일 EEEE', { locale: ko })}의 빈 시간에 넣어드려요
                </p>
              </div>
              <button onClick={() => setSheetOpen(false)} aria-label="닫기" className="btn-icon"><X size={17} /></button>
            </div>
            <div className="flex-1 min-h-0 px-5 pb-5">
              <TodoPicker rangeFrom={days[0]} rangeTo={days[6]} rangeLabel="이번 주" onPick={handleTodoPick} />
            </div>
          </div>
        </div>
      )}

      {modal && (
        <TimeBlockModal
          block={'block' in modal ? modal.block : undefined}
          draft={'draft' in modal ? modal.draft : undefined}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

interface BlockViewProps {
  block: TimeBlock;
  span: BlockSpan;
  layout: { col: number; cols: number };
  title: string;
  color: string;
  done: boolean;
  isNow: boolean;
  isPast: boolean;
  lifted: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onResizePointerDown: (e: React.PointerEvent) => void;
  onClick: () => void;
  onToggle: () => void;
}

function BlockView({ block, span, layout, title, color, done, isNow, isPast, lifted, onPointerDown, onResizePointerDown, onClick, onToggle }: BlockViewProps) {
  const height = Math.max((span.endMin - span.startMin) * MIN_PX, 18);
  const roomy = height >= 40;
  // 겹치는 블록은 칸을 똑같이 나누면 너무 좁아져서, 앞 블록을 넓게 두고 뒤 블록이 위에 살짝 겹쳐 올라오게 함
  const slot = 100 / layout.cols;
  const left = layout.col * slot;
  const width = layout.col === layout.cols - 1 ? slot : Math.min(100 - left, slot * 1.7);

  return (
    <div
      data-block
      role="button"
      tabIndex={0}
      onPointerDown={onPointerDown}
      onClick={e => { e.stopPropagation(); onClick(); }}
      onKeyDown={e => { if (e.key === 'Enter') onClick(); }}
      className={`group absolute rounded-lg overflow-hidden cursor-pointer select-none transition-[box-shadow,opacity] ${
        lifted ? 'shadow-lg opacity-95' : 'hover:shadow-md'
      } ${isPast && !isNow && !lifted ? 'opacity-60' : ''} ${layout.col > 0 ? 'ring-1 ring-white dark:ring-gray-900' : ''}`}
      style={{
        top: span.startMin * MIN_PX + 1,
        height: height - 2,
        left: `calc(${left}% + 2px)`,
        width: `calc(${width}% - 4px)`,
        zIndex: lifted ? 30 : 10 + layout.col,
        backgroundColor: `${color}${done ? '18' : '2e'}`,
        borderLeft: `3px solid ${color}`,
        boxShadow: isNow ? `0 0 0 1.5px ${color}` : undefined,
      }}
    >
      <div className={`flex items-start gap-1 h-full ${roomy ? 'px-1.5 py-1' : 'px-1.5 items-center'}`}>
        <button
          onClick={e => { e.stopPropagation(); onToggle(); }}
          aria-label={done ? '완료 취소' : '완료'}
          className={`flex-shrink-0 w-3.5 h-3.5 mt-px rounded-[4px] border-[1.5px] flex items-center justify-center bg-white/70 dark:bg-gray-900/50 ${roomy ? '' : 'hidden sm:flex'}`}
          style={{ borderColor: color, backgroundColor: done ? color : undefined }}
        >
          {done && (
            <svg width="7" height="7" viewBox="0 0 8 8" fill="none" aria-hidden>
              <path d="M1 4l2 2 4-4" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
        <div className="min-w-0 flex-1">
          <p className={`text-[11.5px] leading-[1.3] font-semibold text-gray-900 dark:text-white ${roomy ? 'line-clamp-2' : 'truncate'} ${done ? 'line-through decoration-gray-500/70' : ''}`}>
            {title}
          </p>
          {roomy && (
            <p className="flex items-center gap-1 text-[10.5px] tabular-nums text-gray-600 dark:text-gray-300 truncate">
              {formatMinutes(span.startMin)} – {formatMinutes(span.endMin)}
              {block.seriesId && <Repeat size={9} className="flex-shrink-0" aria-label="반복" />}
            </p>
          )}
        </div>
      </div>
      {/* 아래 끝을 끌어서 길이 조절 */}
      <div
        data-resize
        onPointerDown={onResizePointerDown}
        onClick={e => e.stopPropagation()}
        className="absolute bottom-0 inset-x-0 h-2 cursor-ns-resize touch-none flex items-end justify-center"
      >
        <span className="mb-[2px] w-6 h-[3px] rounded-full opacity-0 group-hover:opacity-60 transition-opacity" style={{ backgroundColor: color }} />
      </div>
    </div>
  );
}
