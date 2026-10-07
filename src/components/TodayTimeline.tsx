import { useMemo, useState } from 'react';
import { Timer, ChevronRight, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { useApp } from '../context/AppContext';
import { useNow } from '../hooks/useNow';
import TimeBlockModal from './TimeBlockModal';
import type { TimeBlockDraft } from './TimeBlockModal';
import {
  DAY_MINUTES, DEFAULT_BLOCK_MINUTES, blockColor, blockDone, blockTitle, clamp, findFreeSlot,
  formatMinutes, getBlockSpan, layoutOverlaps, minutesNow,
} from '../lib/timebox';
import type { TimeBlock } from '../types';

const MIN_RANGE_HOURS = 8;

// 홈 화면: 오늘 하루 타임박스를 가로 막대로 한눈에 (지금 하는 것 / 다음 할 것 + 지금 시각 선)
export default function TodayTimeline() {
  const { timeblocks, todos, categories, setCurrentScreen } = useApp();
  const now = useNow();
  const todayKey = format(now, 'yyyy-MM-dd');
  const nowMin = minutesNow(now);
  const [modal, setModal] = useState<{ block?: TimeBlock; draft?: TimeBlockDraft } | null>(null);

  const todosById = useMemo(() => new Map(todos.map(t => [t.id, t])), [todos]);
  const categoriesById = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories]);

  const items = useMemo(() => timeblocks
    .map(block => ({ block, span: getBlockSpan(block) }))
    .filter(({ span }) => span.dateKey === todayKey), [timeblocks, todayKey]);

  const current = items.find(({ span }) => span.startMin <= nowMin && nowMin < span.endMin);
  const next = items.find(({ span }) => span.startMin > nowMin);
  const doneCount = items.filter(({ block }) => blockDone(block, todosById)).length;

  // 보여줄 시간 범위: 오늘 블록들(과 지금 시각)을 감싸는 정각 단위, 최소 8시간
  let rangeStart = 9 * 60;
  let rangeEnd = 18 * 60;
  if (items.length) {
    rangeStart = Math.floor(Math.min(...items.map(i => i.span.startMin), nowMin) / 60) * 60;
    rangeEnd = Math.ceil(Math.max(...items.map(i => i.span.endMin), nowMin + 1) / 60) * 60;
    if (rangeEnd - rangeStart < MIN_RANGE_HOURS * 60) {
      rangeEnd = Math.min(DAY_MINUTES, rangeStart + MIN_RANGE_HOURS * 60);
      rangeStart = Math.max(0, rangeEnd - MIN_RANGE_HOURS * 60);
    }
  }
  const range = rangeEnd - rangeStart;
  const pct = (min: number) => ((clamp(min, rangeStart, rangeEnd) - rangeStart) / range) * 100;
  const tickStep = range > 14 * 60 ? 180 : range > 9 * 60 ? 120 : 60;
  const ticks: number[] = [];
  for (let m = Math.ceil(rangeStart / tickStep) * tickStep; m <= rangeEnd; m += tickStep) ticks.push(m);

  const layout = layoutOverlaps(items.map(({ block, span }) => ({ id: block.id, startMin: span.startMin, endMin: span.endMin })));

  function addBlock() {
    const startMin = findFreeSlot(items.map(i => i.span), nowMin, DEFAULT_BLOCK_MINUTES);
    setModal({ draft: { dateKey: todayKey, startMin, endMin: Math.min(DAY_MINUTES, startMin + DEFAULT_BLOCK_MINUTES) } });
  }

  const statusText = current
    ? { label: '지금', title: blockTitle(current.block, todosById), time: `~${formatMinutes(current.span.endMin)}` }
    : next
      ? { label: '다음', title: blockTitle(next.block, todosById), time: formatMinutes(next.span.startMin) }
      : null;

  return (
    <section className="flex-shrink-0 rounded-2xl surface px-4 pt-3 pb-3.5 mb-4" aria-label="오늘 타임박스">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mb-2.5">
        <div className="flex items-center gap-2 flex-shrink-0">
          <Timer size={15} className="text-leaf-600 dark:text-leaf-400 flex-shrink-0" />
          <button onClick={() => setCurrentScreen('timebox')}
            className="text-[13px] font-semibold whitespace-nowrap text-gray-900 dark:text-white hover:text-leaf-700 dark:hover:text-leaf-300 transition-colors">
            오늘 타임박스
          </button>
          {items.length > 0 && <span className="count-pill">{doneCount}/{items.length}</span>}
        </div>
        <div className="order-last sm:order-none basis-full sm:basis-auto flex-1 min-w-0">
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

      {items.length === 0 ? (
        <button onClick={addBlock}
          className="w-full h-11 rounded-lg border border-dashed border-gray-200 dark:border-gray-700 text-[13px] text-gray-400 dark:text-gray-500 hover:text-leaf-700 dark:hover:text-leaf-300 hover:border-leaf-400 transition-colors">
          오늘 할 일을 시간에 배치해보세요
        </button>
      ) : (
        <div>
          <div className="relative h-11 rounded-lg bg-gray-50 dark:bg-gray-800/40 overflow-hidden">
            {ticks.map(m => (
              <div key={m} className="absolute inset-y-0 border-l border-gray-200/70 dark:border-gray-700/60" style={{ left: `${pct(m)}%` }} aria-hidden />
            ))}
            {items.map(({ block, span }) => {
              const color = blockColor(block, todosById, categoriesById);
              const done = blockDone(block, todosById);
              const { col, cols } = layout.get(block.id) ?? { col: 0, cols: 1 };
              const isNow = span.startMin <= nowMin && nowMin < span.endMin;
              const title = blockTitle(block, todosById);
              return (
                <button
                  key={block.id}
                  onClick={() => setModal({ block })}
                  title={`${formatMinutes(span.startMin)} – ${formatMinutes(span.endMin)} ${title}`}
                  className={`absolute rounded-md px-1.5 text-left overflow-hidden transition-opacity hover:opacity-100 ${
                    span.endMin <= nowMin && !isNow ? 'opacity-55' : ''
                  }`}
                  style={{
                    left: `calc(${pct(span.startMin)}% + 1px)`,
                    width: `calc(${pct(span.endMin) - pct(span.startMin)}% - 2px)`,
                    top: `calc(${(col / cols) * 100}% + 3px)`,
                    height: `calc(${100 / cols}% - 6px)`,
                    backgroundColor: `${color}${done ? '1c' : '33'}`,
                    borderLeft: `3px solid ${color}`,
                    boxShadow: isNow ? `0 0 0 1.5px ${color}` : undefined,
                  }}
                >
                  <span className={`block truncate text-[11px] leading-[1.25] font-semibold text-gray-900 dark:text-white ${done ? 'line-through decoration-gray-500/70' : ''}`}
                    style={{ lineHeight: cols > 1 ? '1.1' : undefined, marginTop: cols > 1 ? 0 : 4 }}>
                    {title}
                  </span>
                  {cols === 1 && (
                    <span className="block truncate text-[10px] tabular-nums text-gray-600 dark:text-gray-300">{formatMinutes(span.startMin)}</span>
                  )}
                </button>
              );
            })}
            {nowMin >= rangeStart && nowMin <= rangeEnd && (
              <div className="absolute inset-y-0 w-[1.5px] bg-red-500 pointer-events-none" style={{ left: `${pct(nowMin)}%` }} aria-hidden>
                <div className="absolute -top-px -left-[3px] w-[7.5px] h-[7.5px] rounded-full bg-red-500" />
              </div>
            )}
          </div>
          <div className="relative h-3.5 mt-1" aria-hidden>
            {ticks.map(m => (
              <span key={m} className="absolute -translate-x-1/2 text-[10px] tabular-nums text-gray-400 dark:text-gray-500" style={{ left: `${pct(m)}%` }}>
                {m / 60}시
              </span>
            ))}
          </div>
        </div>
      )}

      {modal && <TimeBlockModal block={modal.block} draft={modal.draft} onClose={() => setModal(null)} />}
    </section>
  );
}
