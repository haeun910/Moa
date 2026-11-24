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

// 설정 > 글자 크기에 맞춘 달력 칸의 최소 높이. 할 일이 많으면 칸(그 주 줄 전체)이 내용만큼 길어지고,
// 달력이 화면보다 길어지면 달력 영역이 스크롤됨. 글자 자체는 앱 전체 배율(--fs)로 커짐.
const CELL_MIN_H: Record<Settings['calendarTextSize'], string> = {
  small: 'min-h-[84px]',
  medium: 'min-h-[96px]',
  large: 'min-h-[112px]',
};

// 칩 한 줄: 글자 크기는 폰 11px, 그 위로 12px. 높이는 글자의 1.5배로 고정해서 막대·칩·빈 줄이 정확히 같은 높이가 되게 함
const CHIP_FONT = 'text-11px sm:text-12px';
const CHIP_LINE = 'h-[1.5em] leading-[1.5em]';
const CHIP_GAP = 3; // 줄 사이 간격(px), 칩 목록의 space-y-[3px]와 같아야 함
// 칸 위에서 칩 목록이 시작하는 높이 = 칸 안쪽 여백(p-1 / sm:p-1.5) + 날짜 줄(h-6) + 그 아래 간격(mb-1).
// 여러 날 일정 막대를 칩 줄에 맞춰 그릴 때 씀 (칸 여백·날짜 줄 높이를 바꾸면 같이 바꿀 것)
const LIST_TOP = '[--list-top:32px] sm:[--list-top:34px]';

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
  // 할 일 배치(PlanPanel): 할 일을 끌고 있는 칸 / 할 일을 골랐거나 끄는 중이라 칸을 누르면 그 날로 옮겨지는 상태
  dropDate?: string | null;
  placing?: boolean;
}

// 월 달력. 여러 날 일정은 칸을 넘어 이어진 막대로, 나머지는 칸마다 한 줄씩. 줄이지 않고 전부 보여줌
export default function MonthGrid({
  days, viewMonth, todayStr, selectedDate, panelOpen, todos, ddays, schedules, categories, subcategories, holidays, textSize, onDayClick,
  dropDate = null, placing = false,
}: Props) {
  const cellMinH = CELL_MIN_H[textSize];
  const weekCount = Math.ceil(days.length / 7);
  const keys = days.map(d => format(d, 'yyyy-MM-dd'));

  // 여러 날 일정: 주마다 줄을 정해 막대로 그림
  const multiDay = schedules.filter(isMultiDay);
  const weekSegs: LaneSegment<ScheduleItem>[][] = Array.from({ length: weekCount }, (_, w) =>
    weekLanes(keys.slice(w * 7, w * 7 + 7), multiDay, s => [s.date, scheduleEndDate(s)]));

  const subById = new Map(subcategories.map(s => [s.id, s]));
  const catById = new Map(categories.map(c => [c.id, c]));

  return (
    // overflow-clip: 모서리는 둥글게 자르되 스크롤 상자는 만들지 않음 → 요일 줄이 달력 영역 스크롤에 붙어 있을 수 있고,
    // 카드가 내용(길어진 칸)보다 작아지지 않음 (overflow-hidden이면 카드가 줄어들며 아래 칸이 잘림)
    <div className="relative rounded-xl surface overflow-clip flex flex-col flex-1">
      {/* 요일: 할 일이 많아 달력이 길어져도 스크롤할 때 위에 붙어 있음 (폰은 화면 전체가 스크롤되어 붙지 않음) */}
      <div className="sticky top-0 z-[2] flex-shrink-0 grid grid-cols-7 bg-white dark:bg-gray-900 border-b border-gray-200/70 dark:border-gray-800">
        {DAY_LABELS.map((d, i) => (
          <div key={d} className={`py-2 px-2 sm:px-2.5 text-11px sm:text-12px font-semibold ${
            i === 0 ? 'text-red-500 dark:text-red-400' : i === 6 ? 'text-blue-500 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'
          }`}>{d}</div>
        ))}
      </div>
      {/* 주(줄) 높이: 남는 높이를 주마다 똑같이 나눠 채우되(grow, basis 0), 할 일이 많은 주는 내용만큼 길어지고
          다른 주는 남은 높이를 나눠 가짐. 다 합쳐 화면보다 길면 달력 영역이 스크롤됨.
          (grid의 1fr로 하면 내용으로 높이를 잴 때 모든 주가 가장 긴 주만큼 늘어나서 flex로 나눔) */}
      <div className="flex-1 flex flex-col">
        {Array.from({ length: weekCount }, (_, week) => (
          <div key={keys[week * 7]} className="relative grow shrink-0 basis-0 grid grid-cols-7">
            {days.slice(week * 7, week * 7 + 7).map((day, col) => {
              const idx = week * 7 + col;
              const dateStr = keys[idx];
              const isToday = dateStr === todayStr;
              const isSelected = dateStr === selectedDate && panelOpen;
              const isDrop = dateStr === dropDate;
              const inMonth = isSameMonth(day, viewMonth);
              const dow = day.getDay();
              const isLastRow = week === weekCount - 1;
              const holiday = holidayLabel(holidays, dateStr);

              // 이 날을 지나는 막대가 차지하는 줄 수 (중간에 빈 줄이 있어도 그 줄까지 비워 둠)
              const barsHere = weekSegs[week].filter(s => s.startCol <= col && col <= s.endCol);
              const laneRows = barsHere.length ? Math.max(...barsHere.map(s => s.lane)) + 1 : 0;

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
              // 다 끝낸 묶음(줄 그어진 것)은 맨 아래로 → 남은 일이 위에 모여 보이게 (그 안에서는 원래 순서 그대로)
              const groups = [...todoGroups.values()];
              chips.push(...groups.filter(g => !g.done), ...groups.filter(g => g.done));

              return (
                <button key={dateStr} data-day-cell data-drop-date={dateStr} onClick={() => onDayClick(dateStr)}
                  aria-label={`${format(day, 'M월 d일 EEEE', { locale: ko })}${holiday ? ` ${holiday}` : ''}${placing ? ', 고른 할 일을 이 날로 옮기기' : ''}`}
                  aria-pressed={isSelected}
                  className={`relative [container:day-cell/inline-size] flex flex-col items-start ${cellMinH} min-w-0 overflow-x-clip p-1 sm:p-1.5 text-left transition-colors ${
                    col !== 6 ? 'border-r border-gray-200/70 dark:border-gray-800' : ''
                  } ${!isLastRow ? 'border-b border-gray-200/70 dark:border-gray-800' : ''} ${
                    // 할 일을 끌어 올려 둔 칸: 진한 초록 테두리 + 초록 배경
                    isDrop
                      ? 'bg-leaf-100 dark:bg-leaf-900/50 shadow-[inset_0_0_0_2.5px_theme(colors.leaf.600)] dark:shadow-[inset_0_0_0_2.5px_theme(colors.leaf.400)]'
                    // 오늘: 초록 테두리 + 연한 초록 배경 / 고른 날: 진한 회색 테두리 (오늘과 구분)
                    : isToday
                      ? `bg-leaf-50 dark:bg-leaf-900/25 ${isSelected
                          ? 'shadow-[inset_0_0_0_2.5px_theme(colors.leaf.600)] dark:shadow-[inset_0_0_0_2.5px_theme(colors.leaf.400)]'
                          : 'shadow-[inset_0_0_0_2px_theme(colors.leaf.500)] hover:bg-leaf-100/70 dark:hover:bg-leaf-900/40'}`
                      : isSelected
                        ? 'bg-gray-50 dark:bg-gray-800/50 shadow-[inset_0_0_0_1.5px_theme(colors.gray.800)] dark:shadow-[inset_0_0_0_1.5px_theme(colors.gray.300)]'
                        : inMonth ? 'hover:bg-gray-50 dark:hover:bg-gray-800/40' : 'bg-gray-50/70 dark:bg-gray-950/30 hover:bg-gray-100/60 dark:hover:bg-gray-800/40'
                  } ${
                    // 할 일을 골라 둔 상태: 칸에 올리면 "여기에 놓기"처럼 보이게
                    placing && !isDrop ? 'cursor-copy hover:!bg-leaf-50 dark:hover:!bg-leaf-900/30 hover:shadow-[inset_0_0_0_2px_theme(colors.leaf.400)]' : ''
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
                  <div data-chip-list className={`w-full space-y-[3px] overflow-x-clip ${CHIP_FONT} ${inMonth ? '' : 'opacity-40'}`}>
                    {/* 여러 날 일정 막대가 지나가는 줄은 비워 둠 (막대는 아래 주 단위 층에서 그림) */}
                    {Array.from({ length: laneRows }, (_, i) => <div key={`lane-${i}`} aria-hidden="true" className={CHIP_LINE} />)}
                    {chips.map(chip => (
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
                  </div>
                </button>
              );
            })}

            {/* 여러 날 일정 막대: 그 주 전체 칸 위에 겹쳐 그림 (누르면 아래 날짜 칸이 눌림) */}
            {weekSegs[week].length > 0 && (
              <div aria-hidden="true" className={`absolute inset-0 z-[1] pointer-events-none ${LIST_TOP}`}>
                {weekSegs[week].flatMap(seg => {
                  // 이번 달이 아닌 날은 흐리게 그리므로 막대도 그 경계에서 나눔
                  const runs: Array<[number, number, boolean]> = [];
                  for (let c = seg.startCol; c <= seg.endCol; c++) {
                    const inMonth = isSameMonth(days[week * 7 + c], viewMonth);
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
                          // 칩 한 줄 높이 = 1.5em (막대도 칩과 같은 글자 크기라 em이 같음)
                          top: `calc(var(--list-top) + ${seg.lane} * (1.5em + ${CHIP_GAP}px))`,
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
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
