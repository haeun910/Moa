import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CalendarDays, Flag } from 'lucide-react';
import { format, isSameMonth } from 'date-fns';
import { ko } from 'date-fns/locale';
import { holidayLabel } from '../hooks/useHolidays';
import type { HolidayMap } from '../hooks/useHolidays';
import { isMultiDay, scheduleEndDate, scheduleOnDate } from '../lib/scheduleDates';
import { weekLanes } from '../lib/calendarLanes';
import type { LaneSegment } from '../lib/calendarLanes';
import { DAY_LABELS, weekdayTone } from '../lib/calendarStyle';
import type { Category, DDay, ScheduleItem, Settings, Subcategory, Todo } from '../types';

// 설정 > 글자 크기에 맞춘 달력 칸의 최소 높이와 최소 줄 수.
// 칸에 몇 줄을 넣을지는 화면에서 칸 높이를 재서 정하고(useFitChipLines), minLines는 화면이 낮아도 보여주는 줄 수
// (칸이 그만큼 커짐). 글자 자체는 앱 전체 배율(--fs)로 커짐.
const CELL_STYLES: Record<Settings['calendarTextSize'], { cellMinH: string; minLines: number }> = {
  small: { cellMinH: 'min-h-[84px]', minLines: 4 },
  medium: { cellMinH: 'min-h-[96px]', minLines: 4 },
  large: { cellMinH: 'min-h-[112px]', minLines: 3 },
};

// 칩 한 줄: 글자 크기는 폰 11px, 그 위로 12px. 높이는 글자의 1.5배로 고정해서 막대·칩·빈 줄이 정확히 같은 높이가 되게 함
const CHIP_FONT = 'text-11px sm:text-12px';
const CHIP_LINE = 'h-[1.5em] leading-[1.5em]';
const CHIP_GAP = 3; // 줄 사이 간격(px), 칩 목록의 space-y-[3px]와 같아야 함

// 한 칸에 한 줄씩 보이는 것: 디데이·일정은 제목, 할 일은 하위 카테고리(없으면 카테고리) 이름으로 묶음
interface CalendarChip {
  key: string;
  title: string;
  kind: 'dday' | 'schedule' | 'todo';
  done: boolean; // 할 일 묶음은 그 안의 할 일을 모두 끝냈을 때
  time?: string | null; // 일정 시작 시각
  color?: string; // 할 일 묶음의 카테고리 색
  total?: number; // 할 일 묶음에 든 할 일 수 ('안 하기' 제외)
  doneCount?: number;
}

// 월 달력 칸 하나에 칩이 몇 줄 들어가는지 화면에서 재서 돌려줌.
// 칸 높이를 칸 안의 내용으로 재면 "칩을 더 넣음 → 칸이 커짐 → 더 넣음"으로 번질 수 있어서,
// 내용과 상관없는 값(화면 높이, 달력이 시작하는 위치, 주 수)으로 칸 높이를 계산함.
function useFitChipLines(minLines: number) {
  const gridRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ lines: 0, listTop: 0, lineH: 0 });
  const [, setTick] = useState(0);

  const measure = useCallback(() => {
    const grid = gridRef.current;
    const probe = probeRef.current;
    const cell = grid?.querySelector<HTMLElement>('[data-day-cell]');
    const list = cell?.querySelector<HTMLElement>('[data-chip-list]');
    const card = grid?.parentElement;
    const inner = card?.parentElement;
    const root = grid?.closest<HTMLElement>('[data-calendar-root]');
    const scroller = grid?.closest<HTMLElement>('[data-calendar-scroller]');
    if (!grid || !probe || !cell || !list || !card || !inner || !root || !scroller) return;
    const weeks = Math.max(1, grid.querySelectorAll('[data-day-cell]').length / 7);
    const rootStyle = getComputedStyle(root);
    // min-h-screen = 화면 높이(오프라인 안내 줄 높이는 뺀 값). 폰·태블릿은 아래 메뉴 자리(padding-bottom)도 뺌
    const screenH = parseFloat(rootStyle.minHeight) || window.innerHeight;
    const gridRect = grid.getBoundingClientRect();
    const gridTop = gridRect.top - root.getBoundingClientRect().top + scroller.scrollTop;
    const below = (parseFloat(rootStyle.paddingBottom) || 0) + (parseFloat(getComputedStyle(inner).paddingBottom) || 0)
      + (card.getBoundingClientRect().bottom - gridRect.bottom);
    const cellStyle = getComputedStyle(cell);
    const cellMin = parseFloat(cellStyle.minHeight) || 0;
    const cellH = Math.max(cellMin, (screenH - below - gridTop) / weeks);
    const listTop = list.offsetTop;
    const room = cellH - listTop - (parseFloat(cellStyle.paddingBottom) || 0);
    const lineH = probe.getBoundingClientRect().height;
    if (!(lineH > 0)) return;
    const lines = Math.max(1, Math.floor((room + CHIP_GAP) / (lineH + CHIP_GAP)));
    setFit(prev => (prev.lines === lines && prev.listTop === listTop && prev.lineH === lineH ? prev : { lines, listTop, lineH }));
  }, []);

  // 화면 크기·글자 배율이 바뀌면 다시 잼
  useEffect(() => {
    const onResize = () => setTick(t => t + 1);
    window.addEventListener('resize', onResize);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onResize) : null;
    if (ro && probeRef.current) ro.observe(probeRef.current);
    if (ro && gridRef.current) ro.observe(gridRef.current);
    return () => { window.removeEventListener('resize', onResize); ro?.disconnect(); };
  }, []);

  // 위쪽 요약 카드 높이 등이 바뀌어 달력 시작 위치가 달라질 수 있어서 그릴 때마다 확인 (값이 같으면 다시 그리지 않음)
  useLayoutEffect(() => { measure(); });

  return { gridRef, probeRef, lines: Math.max(minLines, fit.lines), listTop: fit.listTop, lineH: fit.lineH };
}

interface Props {
  days: Date[];
  viewMonth: Date;
  todayStr: string;
  selectedDate: string;
  panelOpen: boolean;
  todos: Todo[]; // 숨긴 카테고리를 뺀 할 일
  ddays: DDay[];
  schedules: ScheduleItem[];
  categories: Category[];
  subcategories: Subcategory[];
  holidays: HolidayMap;
  textSize: Settings['calendarTextSize'];
  onDayClick: (dateStr: string) => void;
}

// 월 달력. 여러 날 일정은 칸을 넘어 이어진 막대로, 나머지는 칸마다 한 줄씩
export default function MonthGrid({
  days, viewMonth, todayStr, selectedDate, panelOpen, todos, ddays, schedules, categories, subcategories, holidays, textSize, onDayClick,
}: Props) {
  const cellStyle = CELL_STYLES[textSize];
  const { gridRef, probeRef, lines: lineLimit, listTop, lineH } = useFitChipLines(cellStyle.minLines);
  const weekCount = Math.ceil(days.length / 7);
  const keys = days.map(d => format(d, 'yyyy-MM-dd'));

  // 여러 날 일정: 주마다 줄을 정해 막대로 그림. 마지막 한 줄은 "+N개 더" 자리로 남겨 둠
  const multiDay = schedules.filter(isMultiDay);
  const maxBarLanes = Math.max(1, lineLimit - 1);
  const weekSegs: LaneSegment<ScheduleItem>[][] = Array.from({ length: weekCount }, (_, w) =>
    weekLanes(keys.slice(w * 7, w * 7 + 7), multiDay, s => [s.date, scheduleEndDate(s)]));

  const subById = new Map(subcategories.map(s => [s.id, s]));
  const catById = new Map(categories.map(c => [c.id, c]));

  return (
    <div className="relative rounded-xl surface overflow-hidden flex flex-col flex-1 md:min-h-0">
      {/* 칩 한 줄 높이를 재는 보이지 않는 줄 (useFitChipLines) */}
      <div ref={probeRef} aria-hidden="true" className={`absolute left-0 top-0 invisible pointer-events-none ${CHIP_FONT} ${CHIP_LINE}`}>가</div>
      <div className="flex-shrink-0 grid grid-cols-7 border-b border-gray-200/70 dark:border-gray-800">
        {DAY_LABELS.map((d, i) => (
          <div key={d} className={`py-2 px-2 sm:px-2.5 text-11px sm:text-12px font-semibold ${
            i === 0 ? 'text-red-500 dark:text-red-400' : i === 6 ? 'text-blue-500 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'
          }`}>{d}</div>
        ))}
      </div>
      <div ref={gridRef} className="flex-1 grid grid-cols-7" style={{ gridTemplateRows: `repeat(${weekCount}, 1fr)` }}>
        {days.map((day, idx) => {
          const dateStr = keys[idx];
          const week = Math.floor(idx / 7);
          const col = idx % 7;
          const isToday = dateStr === todayStr;
          const isSelected = dateStr === selectedDate && panelOpen;
          const inMonth = isSameMonth(day, viewMonth);
          const dow = day.getDay();
          const isLastRow = week === weekCount - 1;
          const holiday = holidayLabel(holidays, dateStr);

          // 이 날을 지나는 막대: 보이는 줄(빈 자리 포함)과, 줄이 모자라 못 그린 막대 수
          const barsHere = weekSegs[week].filter(s => s.startCol <= col && col <= s.endCol);
          const shownLanes = barsHere.filter(s => s.lane < maxBarLanes);
          const laneRows = shownLanes.length ? Math.max(...shownLanes.map(s => s.lane)) + 1 : 0;
          const hiddenBars = barsHere.length - shownLanes.length;

          // 디데이·하루짜리 일정은 제목, 할 일은 하위 카테고리(없으면 카테고리) 이름으로 묶어서 한 줄씩
          const chips: CalendarChip[] = [
            ...ddays.filter(d => d.targetDate === dateStr).map(d => ({ key: `dday-${d.id}`, title: d.title, kind: 'dday' as const, done: false })),
            ...schedules.filter(s => !isMultiDay(s) && scheduleOnDate(s, dateStr))
              .sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''))
              .map(s => ({ key: `sch-${s.id}`, title: s.title, kind: 'schedule' as const, done: s.completed, time: s.startTime })),
          ];
          const todoGroups = new Map<string, CalendarChip>();
          for (const t of todos) {
            if (t.date !== dateStr || t.skipped) continue;
            // 날짜 창(CategoryTodoGroups)과 같은 묶음: 하위 카테고리가 이 할 일의 카테고리 소속일 때만 하위 카테고리로 묶음
            const subRaw = t.subcategoryId ? subById.get(t.subcategoryId) : undefined;
            const sub = subRaw && subRaw.categoryId === t.categoryId ? subRaw : undefined;
            const cat = t.categoryId ? catById.get(t.categoryId) : undefined;
            const key = sub ? `sub-${sub.id}` : `cat-${cat ? cat.id : 'none'}`;
            const group = todoGroups.get(key);
            if (group) {
              group.done = group.done && t.completed;
              group.total = (group.total ?? 0) + 1;
              group.doneCount = (group.doneCount ?? 0) + (t.completed ? 1 : 0);
            } else {
              todoGroups.set(key, { key, title: sub?.name ?? cat?.name ?? '분류 없음', kind: 'todo', done: t.completed, color: cat?.color, total: 1, doneCount: t.completed ? 1 : 0 });
            }
          }
          chips.push(...todoGroups.values());

          // 칸 높이에 들어가는 만큼 보여주고, 넘치면 마지막 줄을 "+N개 더"에 내줌
          const room = lineLimit - laneRows;
          const overflow = chips.length + hiddenBars > room;
          const visibleChips = overflow ? chips.slice(0, Math.max(0, room - 1)) : chips;
          const overflowCount = chips.length - visibleChips.length + hiddenBars;

          return (
            <button key={dateStr} data-day-cell onClick={() => onDayClick(dateStr)}
              style={{ gridRow: week + 1, gridColumn: col + 1 }}
              aria-label={`${format(day, 'M월 d일 EEEE', { locale: ko })}${holiday ? ` ${holiday}` : ''}`}
              aria-pressed={isSelected}
              className={`relative [container:day-cell/inline-size] flex flex-col items-start ${cellStyle.cellMinH} md:min-h-0 min-w-0 overflow-hidden p-1 sm:p-1.5 text-left transition-colors ${
                col !== 6 ? 'border-r border-gray-200/70 dark:border-gray-800' : ''
              } ${!isLastRow ? 'border-b border-gray-200/70 dark:border-gray-800' : ''} ${
                // 오늘: 초록 테두리 + 연한 초록 배경 / 고른 날: 진한 회색 테두리 (오늘과 구분)
                isToday
                  ? `bg-leaf-50 dark:bg-leaf-900/25 ${isSelected
                      ? 'shadow-[inset_0_0_0_2.5px_theme(colors.leaf.600)] dark:shadow-[inset_0_0_0_2.5px_theme(colors.leaf.400)]'
                      : 'shadow-[inset_0_0_0_2px_theme(colors.leaf.500)] hover:bg-leaf-100/70 dark:hover:bg-leaf-900/40'}`
                  : isSelected
                    ? 'bg-gray-50 dark:bg-gray-800/50 shadow-[inset_0_0_0_1.5px_theme(colors.gray.800)] dark:shadow-[inset_0_0_0_1.5px_theme(colors.gray.300)]'
                    : inMonth ? 'hover:bg-gray-50 dark:hover:bg-gray-800/40' : 'bg-gray-50/70 dark:bg-gray-950/30 hover:bg-gray-100/60 dark:hover:bg-gray-800/40'
              }`}
            >
              <div className="w-full min-w-0 flex items-center gap-1 h-6 mb-1">
                <span className={`flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-12px sm:text-13px tabular-nums ${
                  isToday
                    ? 'bg-leaf-600 dark:bg-leaf-500 text-white font-bold'
                    : !inMonth
                      ? 'text-gray-300 dark:text-gray-600 font-medium'
                      : `${weekdayTone(holiday ? 0 : dow)} font-semibold`
                }`}>
                  {format(day, 'd')}
                </span>
                {/* 공휴일 이름 (빨간 날) */}
                {holiday && (
                  <span className={`min-w-0 truncate text-10px sm:text-11px font-medium text-red-500 dark:text-red-400 ${inMonth ? '' : 'opacity-40'}`}>{holiday}</span>
                )}
              </div>
              <div data-chip-list className={`w-full space-y-[3px] overflow-hidden ${CHIP_FONT} ${inMonth ? '' : 'opacity-40'}`}>
                {/* 여러 날 일정 막대가 지나가는 줄은 비워 둠 (막대는 아래 주 단위 층에서 그림) */}
                {Array.from({ length: laneRows }, (_, i) => <div key={`lane-${i}`} aria-hidden="true" className={CHIP_LINE} />)}
                {visibleChips.map(chip => (
                  <div key={chip.key} title={chip.title}
                    className={`w-full flex items-center gap-1 ${CHIP_LINE} px-0.5 sm:px-1.5 rounded-[4px] font-medium ${
                      chip.kind === 'todo'
                        ? (chip.done ? 'text-gray-400 dark:text-gray-500' : 'text-gray-800 dark:text-gray-100')
                        : chip.kind === 'dday'
                          ? 'bg-leaf-100 text-leaf-800 dark:bg-leaf-900/60 dark:text-leaf-100'
                          : chip.done
                            ? 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500'
                            : 'bg-blue-50 text-blue-800 dark:bg-blue-900/50 dark:text-blue-100'
                    }`}
                  >
                    {/* 디데이는 깃발, 일정은 달력 아이콘 (폰은 칸이 좁아 색으로만 구분), 할 일은 카테고리 색 점 */}
                    {chip.kind === 'todo'
                      ? <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${chip.done ? 'opacity-40' : ''}`} style={{ backgroundColor: chip.color ?? '#9DA397' }} />
                      : chip.kind === 'dday'
                        ? <Flag size={10} className="flex-shrink-0 hidden sm:block" strokeWidth={2.6} />
                        : <CalendarDays size={10} className="flex-shrink-0 hidden sm:block" strokeWidth={2.6} />}
                    {/* 폰은 칸이 좁아서 말줄임표(…) 없이 들어가는 만큼 글자를 보여줌 (전체는 눌러서 팝업으로) */}
                    <span className={`min-w-0 overflow-hidden whitespace-nowrap sm:text-ellipsis ${chip.done ? 'line-through' : ''} ${chip.kind === 'dday' ? 'font-semibold' : ''}`}>
                      {/* 일정 시작 시각: 칸이 넉넉할 때만 (좁은 칸에서는 제목 자리를 먼저) */}
                      {chip.time && <span className="hidden cell-wide:inline mr-1 tabular-nums font-normal opacity-70">{chip.time}</span>}
                      {chip.title}
                    </span>
                    {/* 할 일이 여러 개 묶인 줄은 끝낸 개수를 같이 (다 끝내면 줄이 그어지고 숫자는 빠짐).
                        폰 칸은 너무 좁아서 숫자가 이름을 가리므로 태블릿·컴퓨터에서만 */}
                    {chip.kind === 'todo' && !chip.done && (chip.total ?? 0) > 1 && (
                      <span className="hidden sm:inline flex-shrink-0 ml-auto pl-0.5 text-11px tabular-nums font-normal text-gray-400 dark:text-gray-500">{chip.doneCount}/{chip.total}</span>
                    )}
                  </div>
                ))}
                {overflowCount > 0 && (
                  <p className={`${CHIP_LINE} px-0.5 sm:px-1.5 text-gray-500 dark:text-gray-400 font-medium`}>
                    {/* 폰 칸은 좁아서 "+N"만 */}
                    <span className="sm:hidden">+{overflowCount}</span><span className="hidden sm:inline">+{overflowCount}개 더</span>
                  </p>
                )}
              </div>
            </button>
          );
        })}

        {/* 여러 날 일정 막대: 주마다 그 주 전체 칸 위에 겹쳐 그림 (누르면 아래 날짜 칸이 눌림) */}
        {listTop > 0 && lineH > 0 && weekSegs.map((segs, w) => (
          <div key={`bars-${w}`} aria-hidden="true" className="relative z-[1] pointer-events-none" style={{ gridRow: w + 1, gridColumn: '1 / -1' }}>
            {segs.filter(s => s.lane < maxBarLanes).flatMap(seg => {
              // 이번 달이 아닌 날은 흐리게 그리므로 막대도 그 경계에서 나눔
              const runs: Array<[number, number, boolean]> = [];
              for (let c = seg.startCol; c <= seg.endCol; c++) {
                const inMonth = isSameMonth(days[w * 7 + c], viewMonth);
                const last = runs[runs.length - 1];
                if (last && last[2] === inMonth && last[1] === c - 1) last[1] = c;
                else runs.push([c, c, inMonth]);
              }
              return runs.map(([from, to, inMonth], i) => {
                const roundLeft = from === seg.startCol && !seg.continuesBefore;
                const roundRight = to === seg.endCol && !seg.continuesAfter;
                const s = seg.item;
                return (
                  <div key={`${s.id}-${i}`} data-bar
                    className={`absolute flex items-center ${CHIP_FONT} ${CHIP_LINE} px-1.5 font-semibold whitespace-nowrap overflow-hidden ${
                      roundLeft ? 'rounded-l-[4px]' : ''} ${roundRight ? 'rounded-r-[4px]' : ''} ${inMonth ? '' : 'opacity-40'} ${
                      s.completed
                        ? 'bg-gray-100 text-gray-400 line-through dark:bg-gray-800 dark:text-gray-500'
                        : 'bg-blue-100 text-blue-900 dark:bg-blue-800/70 dark:text-blue-50'
                    }`}
                    style={{
                      top: listTop + seg.lane * (lineH + CHIP_GAP),
                      // 시작·끝 칸에서는 칸 안쪽 여백만큼 띄우고, 이어지는 쪽은 칸 끝까지
                      left: `calc(${from} * 100% / 7 + ${roundLeft ? 4 : 0}px)`,
                      width: `calc(${to - from + 1} * 100% / 7 - ${(roundLeft ? 4 : 0) + (roundRight ? 4 : 0)}px)`,
                    }}
                  >
                    {/* 주가 바뀌거나 이번 달 경계에서 나뉜 조각마다 제목을 다시 보여줌 (지난주부터 이어지면 ‹ 표시) */}
                    <span className="min-w-0 truncate">{i === 0 && seg.continuesBefore && '‹ '}{s.title}</span>
                  </div>
                );
              });
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
