import { useMemo, useState } from 'react';
import { X, Trash2, Link2, Unlink, ListChecks, BellOff, Timer } from 'lucide-react';
import { addDays, format, parseISO } from 'date-fns';
import { useApp } from '../context/AppContext';
import { usePushNotifications } from '../hooks/usePushNotifications';
import TodoPicker from './TodoPicker';
import {
  BLOCK_COLORS, DEFAULT_BLOCK_COLOR, DAY_MINUTES, REMIND_OPTIONS,
  durationLabel, formatMinutes, getBlockSpan, parseMinutes, spanToRange,
} from '../lib/timebox';
import type { TimeBlock, Todo } from '../types';

export interface TimeBlockDraft {
  dateKey: string;
  startMin: number;
  endMin: number;
  todoId?: string | null;
}

interface Props {
  block?: TimeBlock;
  draft?: TimeBlockDraft;
  onClose: () => void;
}

const QUICK_DURATIONS = [15, 30, 60, 90, 120];

const inputCls = 'w-full px-3 py-2.5 rounded-lg bg-white dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 shadow-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-leaf-500 text-sm transition-all';

// 타임박스 블록 만들기/고치기: 무엇을(제목 또는 할 일) · 언제(날짜, 시작~끝) · 알림
export default function TimeBlockModal({ block, draft, onClose }: Props) {
  const { todos, categories, addTimeBlock, updateTimeBlock, deleteTimeBlock, setCurrentScreen } = useApp();
  const push = usePushNotifications();
  const isEdit = !!block;
  const initial = block ? getBlockSpan(block) : draft!;

  const [title, setTitle] = useState(block?.title ?? '');
  const [todoId, setTodoId] = useState<string | null>(block?.todoId ?? draft?.todoId ?? null);
  const [dateKey, setDateKey] = useState(initial.dateKey);
  const [start, setStart] = useState(formatMinutes(initial.startMin));
  const [end, setEnd] = useState(formatMinutes(initial.endMin % DAY_MINUTES));
  const [color, setColor] = useState(block?.color ?? DEFAULT_BLOCK_COLOR);
  const [remind, setRemind] = useState<number | null>(block ? block.remindMinutes : 0);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const todo = useMemo(() => todos.find(t => t.id === todoId), [todos, todoId]);
  const todoCat = todo?.categoryId ? categories.find(c => c.id === todo.categoryId) : undefined;

  const startMin = parseMinutes(start);
  const endMin = parseMinutes(end, true);
  const validTime = startMin !== null && endMin !== null && endMin > startMin;
  const effectiveTitle = todo ? todo.title : title.trim();
  const canSave = validTime && Boolean(effectiveTitle) && Boolean(dateKey) && !saving;

  function pickTodo(t: Todo) {
    setTodoId(t.id);
    setTitle(t.title);
    setPicking(false);
  }

  function applyDuration(minutes: number) {
    if (startMin === null) return;
    setEnd(formatMinutes(Math.min(DAY_MINUTES, startMin + minutes) % DAY_MINUTES));
  }

  // 시작 시간을 바꾸면 길이는 그대로 두고 끝 시간도 같이 밀어줌
  function changeStart(value: string) {
    const prevStart = startMin;
    setStart(value);
    const next = parseMinutes(value);
    if (next === null || prevStart === null || endMin === null) return;
    const length = endMin - prevStart;
    if (length > 0) setEnd(formatMinutes(Math.min(DAY_MINUTES, next + length) % DAY_MINUTES));
  }

  async function handleSave() {
    if (!canSave || startMin === null || endMin === null) return;
    setSaving(true);
    try {
      const range = spanToRange(dateKey, startMin, endMin);
      const fields = {
        title: effectiveTitle,
        todoId: todo ? todo.id : null,
        color: todo ? null : color,
        startAt: range.startAt,
        endAt: range.endAt,
        remindMinutes: remind,
      };
      if (isEdit) await updateTimeBlock(block.id, fields);
      else await addTimeBlock(fields);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  function handleDelete() {
    if (block) { deleteTimeBlock(block.id); onClose(); }
  }

  const pushOff = remind !== null && push.state !== 'on';

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-panel max-w-md" onClick={e => e.stopPropagation()}>
        <div className="px-6 pt-5 pb-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Timer size={16} className="text-leaf-600 dark:text-leaf-400" />
            <h2 className="text-base font-bold text-gray-900 dark:text-white">{isEdit ? '타임박스 수정' : '타임박스 추가'}</h2>
          </div>
          <button onClick={onClose} aria-label="닫기"
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
            <X size={17} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 overflow-y-auto">
          {/* 무엇을 */}
          <div>
            {todo ? (
              <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-leaf-50/70 dark:bg-leaf-900/20 ring-1 ring-inset ring-leaf-200 dark:ring-leaf-800/60">
                <Link2 size={14} className="text-leaf-600 dark:text-leaf-400 flex-shrink-0" />
                {todoCat && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: todoCat.color }} />}
                <span className="flex-1 min-w-0 text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{todo.title}</span>
                <button onClick={() => setPicking(v => !v)} className="row-action">바꾸기</button>
                <button onClick={() => { setTodoId(null); setTitle(todo.title); }} aria-label="할 일 연결 해제" title="연결 해제"
                  className="btn-icon w-7 h-7 -mr-1">
                  <Unlink size={13} />
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  autoFocus={!isEdit}
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
                  placeholder="무엇을 할까요?"
                  className={inputCls}
                />
                <button onClick={() => setPicking(v => !v)} title="할 일에서 고르기" aria-label="할 일에서 고르기" aria-expanded={picking}
                  className={`btn-secondary flex-shrink-0 px-3 ${picking ? 'ring-leaf-500 text-leaf-700 dark:text-leaf-300' : ''}`}>
                  <ListChecks size={15} />
                  <span className="hidden sm:inline text-[13px]">할 일</span>
                </button>
              </div>
            )}
            {picking && (
              <div className="mt-2 p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/40 ring-1 ring-inset ring-gray-200/70 dark:ring-gray-800">
                <TodoPicker rangeFrom={dateKey} rangeTo={dateKey} rangeLabel="이 날" onPick={pickTodo} compact />
              </div>
            )}
          </div>

          {/* 언제 */}
          <div className="space-y-2">
            <input type="date" value={dateKey} onChange={e => setDateKey(e.target.value)} aria-label="날짜" className={inputCls} />
            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
              <input type="time" step={300} value={start} onChange={e => changeStart(e.target.value)} aria-label="시작 시간" className={`${inputCls} min-w-0`} />
              <span className="text-gray-400 text-sm" aria-hidden>–</span>
              <input type="time" step={300} value={end} onChange={e => setEnd(e.target.value)} aria-label="끝 시간" className={`${inputCls} min-w-0`} />
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {QUICK_DURATIONS.map(d => {
                const active = validTime && endMin! - startMin! === d;
                return (
                  <button key={d} onClick={() => applyDuration(d)}
                    className={`h-7 px-2.5 rounded-full text-xs font-medium ring-1 ring-inset transition-colors ${
                      active
                        ? 'bg-leaf-600 ring-leaf-600 text-white'
                        : 'ring-gray-200 dark:ring-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}>
                    {durationLabel(d)}
                  </button>
                );
              })}
              <span className={`ml-auto text-xs tabular-nums ${validTime ? 'text-gray-500 dark:text-gray-400' : 'text-red-500'}`}>
                {validTime ? durationLabel(endMin! - startMin!) : '끝 시간이 시작보다 늦어야 해요'}
              </span>
            </div>
            {isEdit && (
              <div className="flex gap-1.5">
                <button onClick={() => setDateKey(format(addDays(parseISO(dateKey), 1), 'yyyy-MM-dd'))} className="row-action">다음 날로</button>
                <button onClick={() => setDateKey(format(new Date(), 'yyyy-MM-dd'))} className="row-action">오늘로</button>
              </div>
            )}
          </div>

          {/* 색 (할 일과 연결된 블록은 카테고리 색을 따라감) */}
          {!todo && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-10">색</span>
              <div className="flex gap-1.5 flex-wrap">
                {BLOCK_COLORS.map(c => (
                  <button key={c} onClick={() => setColor(c)} aria-label={`색 ${c}`} aria-pressed={color === c}
                    className={`w-6 h-6 rounded-full transition-transform ${color === c ? 'ring-2 ring-offset-2 ring-gray-400 dark:ring-offset-gray-900 scale-110' : 'hover:scale-110'}`}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
          )}

          {/* 알림 */}
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-10">알림</span>
              <div className="flex-1 grid grid-cols-4 gap-0.5 p-0.5 rounded-lg bg-gray-100 dark:bg-gray-800" role="radiogroup" aria-label="알림">
                {REMIND_OPTIONS.map(opt => (
                  <button key={String(opt.value)} role="radio" aria-checked={remind === opt.value} onClick={() => setRemind(opt.value)}
                    className={`h-7 rounded-md text-[12.5px] transition-all ${
                      remind === opt.value
                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-semibold shadow-sm'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-medium'
                    }`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            {pushOff && (
              <p className="mt-2 ml-12 flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                <BellOff size={12} className="flex-shrink-0 mt-px" />
                <span>
                  이 기기는 알림이 꺼져 있어요.{' '}
                  <button onClick={() => { onClose(); setCurrentScreen('settings'); }} className="underline underline-offset-2 font-medium">
                    설정에서 켜기
                  </button>
                </span>
              </p>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            {isEdit && (
              confirmDelete ? (
                <button onClick={handleDelete}
                  className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold">
                  <Trash2 size={14} />
                  정말 삭제
                </button>
              ) : (
                <button onClick={() => setConfirmDelete(true)} aria-label="삭제"
                  className="flex items-center justify-center w-10 py-2.5 rounded-lg text-red-500 border border-red-200 dark:border-red-900/40 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                  <Trash2 size={15} />
                </button>
              )
            )}
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-sm font-medium transition-colors">
              취소
            </button>
            <button onClick={handleSave} disabled={!canSave} className="btn-primary flex-1 py-2.5">
              {saving ? '저장 중...' : isEdit ? '저장' : '추가'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
