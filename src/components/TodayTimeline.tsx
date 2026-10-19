import { useEffect, useMemo, useRef, useState } from 'react';
import type React from 'react';
import { Timer, ChevronRight, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { useApp } from '../context/AppContext';
import { useNow } from '../hooks/useNow';
import TimeBlockModal from './TimeBlockModal';
import ScheduleModal from './ScheduleModal';
import { buildAgenda } from '../lib/agenda';
import type { AgendaTimed } from '../lib/agenda';
import type { TimeBlockDraft } from './TimeBlockModal';
import {
  DAY_MINUTES, DEFAULT_BLOCK_MINUTES, blockColor, blockDone, blockTitle, clamp, findFreeSlot,
  formatMinutes, getBlockSpan, layoutOverlaps, minutesNow,
} from '../lib/timebox';
import type { ScheduleItem, TimeBlock } from '../types';

const MIN_RANGE_HOURS = 8;
const HOUR_PX = 48;
const MIN_PX = HOUR_PX / 60;
const LABEL_PX = 40; // 왼쪽 시간 글자 칸 너비

// 홈 화면: 오늘 하루 타임박스를 세로 시간표로 한눈에 (지금 하는 것 / 다음 할 것 + 지금 시각 선)
export default function TodayTimeline() {
  const { timeblocks, todos, categories, schedules, ddays, setCurrentScreen } = useApp();
  const now = useNow();
  const todayKey = format(now, 'yyyy-MM-dd');
  const nowMin = minutesNow(now);
  const [modal, setModal] = useState<{ block?: TimeBlock; draft?: TimeBlockDraft } | null>(null);
  const [scheduleModal, setScheduleModal] = useState<ScheduleItem | null>(null);

  const todosById = useMemo(() => new Map(todos.map(t => [t.id, t])), [todos]);
  const categoriesById = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories]);

  const items = useMemo(() => timeblocks
    .map(block => ({ block, span: getBlockSpan(block) }))
    .filter(({ span }) => span.dateKey === todayKey), [timeblocks, todayKey]);

  // 블록 말고도 시간이 정해진 오늘 할 일·일정을 같이 보여줌 (점선)
  const agendaItems = useMemo<AgendaTimed[]>(
    () => buildAgenda([todayKey], { todos, schedules, ddays, timeblocks, categories, todayKey }).get(todayKey)?.timed ?? [],
    [todayKey, todos, schedules, ddays, timeblocks, categories],
  );
  // 지금/다음 표시와 범위 계산은 블록과 할 일·일정을 모두 보고 정함
  const entries = [
    ...items.map(({ block, span }) => ({ id: block.id, startMin: span.startMin, endMin: span.endMin, title: blockTitle(block, todosById) })),
    ...agendaItems.map(item => ({ id: item.key, startMin: item.startMin, endMin: item.endMin, title: item.title })),
  ].sort((a, b) => a.startMin - b.startMin);

  const current = entries.find(e => e.startMin <= nowMin && nowMin < e.endMin);
  const next = entries.find(e => e.startMin > nowMin);
  const doneCount = items.filter(({ block }) => blockDone(block, todosById)).length;

  // 보여줄 시간 범위: 오늘 블록들(과 지금 시각)을 감싸는 정각 단위, 최소 8시간
  let rangeStart = 9 * 60;
  let rangeEnd = 18 * 60;
  if (entries.length) {
    rangeStart = Math.floor(Math.min(...entries.map(e => e.startMin), nowMin) / 60) * 60;
    rangeEnd = Math.ceil(Math.max(...entries.map(e => e.endMin), nowMin + 1) / 60) * 60;
    if (rangeEnd - rangeStart < MIN_RANGE_HOURS * 60) {
      rangeEnd = Math.min(DAY_MINUTES, rangeStart + MIN_RANGE_HOURS * 60);
      rangeStart = Math.max(0, rangeEnd - MIN_RANGE_HOURS * 60);
    }
  }
  const hours: number[] = [];
  for (let m = rangeStart; m < rangeEnd; m += 60) hours.push(m / 60);

  const layout = layoutOverlaps(entries);
  // 세로 위치(시각)와 가로 위치(겹치는 블록끼리 나란히)
  function place(id: string, startMin: number, endMin: number): React.CSSProperties {
    const { col, cols } = layout.get(id) ?? { col: 0, cols: 1 };
    const top = (clamp(startMin, rangeStart, rangeEnd) - rangeStart) * MIN_PX;
    const height = Math.max(20, (clamp(endMin, rangeStart, rangeEnd) - clamp(startMin, rangeStart, rangeEnd)) * MIN_PX - 2);
    return {
      top: top + 1,
      height,
      left: `calc(${LABEL_PX}px + (100% - ${LABEL_PX + 2}px) * ${col / cols})`,
      width: `calc((100% - ${LABEL_PX + 2}px) / ${cols} - 3px)`,
    };
  }

  // 처음 열 때 지금 시각이 보이도록 스크롤
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasEntries = entries.length > 0;
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = Math.max(0, (clamp(minutesNow(new Date()), rangeStart, rangeEnd) - rangeStart) * MIN_PX - HOUR_PX);
  }, [hasEntries, rangeStart, rangeEnd]);

  function addBlockAt(fromMin: number) {
    const startMin = findFreeSlot(entries.map(e => ({ dateKey: todayKey, startMin: e.startMin, endMin: e.endMin })), fromMin, DEFAULT_BLOCK_MINUTES);
    setModal({ draft: { dateKey: todayKey, startMin, endMin: Math.min(DAY_MINUTES, startMin + DEFAULT_BLOCK_MINUTES) } });
  }
  function addBlock() { addBlockAt(nowMin); }

  const statusText = current
    ? { label: '지금', title: current.title, time: `~${formatMinutes(current.endMin)}` }
    : next
      ? { label: '다음', title: next.title, time: formatMinutes(next.startMin) }
      : null;

  return (
    <section className="flex-shrink-0 rounded-2xl surface px-4 pt-3 pb-3.5" aria-label="오늘 타임박스">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mb-2.5">
        <div className="flex items-center gap-2 flex-shrink-0">
          <Timer size={15} className="text-leaf-600 dark:text-leaf-400 flex-shrink-0" />
          <button onClick={() => setCurrentScreen('timebox')}
            className="text-[13px] font-semibold whitespace-nowrap text-gray-900 dark:text-white hover:text-leaf-700 dark:hover:text-leaf-300 transition-colors">
            오늘 타임박스
          </button>
          {items.length > 0 && <span className="count-pill">{doneCount}/{items.length}</span>}
        </div>
        <div className="order-last basis-full min-w-0">
          {statusText && (
            <p className="min-w-0 flex items-center gap-1.5 text-[12.5px]">
              <span className={`flex-shrink-0 text-[10.5px] font-bold px-1.5 py-px rounded ${
                current ? 'bg-leaf-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
              }`}>
                {statusText.label}
              </span>
              <span className="truncate text-gray-800 dark:text-gray-200">{statusText.title}</span>
              <span className="flex-shrink-0 tabular-nums text-gray-400">{statusText.time}</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-0.5 -mr-1.5 flex-shrink-0 ml-auto">
          <button onClick={addBlock} aria-label="타임박스 추가" title="타임박스 추가" className="btn-icon w-7 h-7">
            <Plus size={15} />
          </button>
          <button onClick={() => setCurrentScreen('timebox')} aria-label="주간 타임박스 열기" title="주간 타임박스 열기" className="btn-icon w-7 h-7">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {entries.length === 0 ? (
        <button onClick={addBlock}
          className="w-full h-11 rounded-lg border border-dashed border-gray-200 dark:border-gray-700 text-[13px] text-gray-400 dark:text-gray-500 hover:text-leaf-700 dark:hover:text-leaf-300 hover:border-leaf-400 transition-colors">
          오늘 할 일을 시간에 배치해보세요
        </button>
      ) : (
        <div ref={scrollRef} className="max-h-[560px] overflow-y-auto scrollbar-thin -mx-1 px-1 pt-2 pb-1">
          <div className="relative" style={{ height: hours.length * HOUR_PX }}>
            {/* 시간 눈금: 빈 칸을 누르면 그 시각에 블록 추가 */}
            {hours.map((h, i) => (
              <button key={h} onClick={() => addBlockAt(h * 60)} aria-label={`${h}시에 타임박스 추가`}
                className="group absolute inset-x-0 flex items-start text-left hover:bg-leaf-50/50 dark:hover:bg-leaf-900/10 transition-colors"
                style={{ top: i * HOUR_PX, height: HOUR_PX }}>
                <span className="w-10 flex-shrink-0 -mt-[7px] pr-2 text-right text-[10.5px] tabular-nums text-gray-400 dark:text-gray-500">
                  {h}시
                </span>
                <span className={`flex-1 h-full ${i > 0 ? 'border-t border-gray-100 dark:border-gray-800' : ''}`} />
              </button>
            ))}
            {items.map(({ block, span }) => {
              const color = blockColor(block, todosById, categoriesById);
              const done = blockDone(block, todosById);
              const isNow = span.startMin <= nowMin && nowMin < span.endMin;
              const title = blockTitle(block, todosById);
              return (
                <button
                  key={block.id}
                  onClick={() => setModal({ block })}
                  title={`${formatMinutes(span.startMin)} – ${formatMinutes(span.endMin)} ${title}`}
                  className={`absolute rounded-md px-2 py-1 text-left overflow-hidden transition-opacity hover:opacity-100 ${
                    span.endMin <= nowMin && !isNow ? 'opacity-55' : ''
                  }`}
                  style={{
                    ...place(block.id, span.startMin, span.endMin),
                    backgroundColor: `${color}${done ? '1c' : '33'}`,
                    borderLeft: `3px solid ${color}`,
                    boxShadow: isNow ? `0 0 0 1.5px ${color}` : undefined,
                  }}
                >
                  <span className={`block truncate text-[12px] leading-tight font-semibold text-gray-900 dark:text-white ${done ? 'line-through decoration-gray-500/70' : ''}`}>
                    {title}
                  </span>
                  {(span.endMin - span.startMin) * MIN_PX >= 34 && (
                    <span className="block truncate text-[10.5px] tabular-nums text-gray-600 dark:text-gray-300">
                      {formatMinutes(span.startMin)} – {formatMinutes(span.endMin)}
                    </span>
                  )}
                </button>
              );
            })}
            {agendaItems.map(item => {
              const isNow = item.startMin <= nowMin && nowMin < item.endMin;
              const kindLabel = item.kind === 'todo' ? '할 일' : '일정';
              return (
                <button
                  key={item.key}
                  onClick={() => {
                    if (item.kind === 'todo') setModal({ draft: { dateKey: todayKey, startMin: item.startMin, endMin: item.endMin, todoId: item.todo.id } });
                    else setScheduleModal(item.schedule);
                  }}
                  title={`${formatMinutes(item.startMin)} ${kindLabel} · ${item.title}`}
                  className={`absolute rounded-md px-2 py-1 text-left overflow-hidden border border-dashed transition-opacity hover:opacity-100 ${
                    item.endMin <= nowMin && !isNow ? 'opacity-55' : ''
                  }`}
                  style={{
                    ...place(item.key, item.startMin, item.endMin),
                    backgroundColor: `${item.color}${item.done ? '0d' : '17'}`,
                    borderColor: `${item.color}99`,
                    borderLeft: `3px solid ${item.color}`,
                  }}
                >
                  <span className={`block truncate text-[12px] leading-tight font-medium text-gray-800 dark:text-gray-100 ${item.done ? 'line-through decoration-gray-500/70' : ''}`}>
                    {item.title}
                  </span>
                  {(item.endMin - item.startMin) * MIN_PX >= 34 && (
                    <span className="block truncate text-[10.5px] tabular-nums text-gray-500 dark:text-gray-400">{formatMinutes(item.startMin)} · {kindLabel}</span>
                  )}
                </button>
              );
            })}
            {nowMin >= rangeStart && nowMin <= rangeEnd && (
              <div className="absolute right-0 h-[1.5px] bg-red-500 pointer-events-none" style={{ left: LABEL_PX - 4, top: (nowMin - rangeStart) * MIN_PX }} aria-hidden>
                <div className="absolute -left-[3px] -top-[3px] w-[7.5px] h-[7.5px] rounded-full bg-red-500" />
              </div>
            )}
          </div>
        </div>
      )}

      {scheduleModal && <ScheduleModal schedule={scheduleModal} onClose={() => setScheduleModal(null)} />}
      {modal && <TimeBlockModal block={modal.block} draft={modal.draft} onClose={() => setModal(null)} />}
    </section>
  );
}
