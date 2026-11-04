import { useState } from 'react';
import { X, AlertCircle, CalendarCheck, ChevronDown, Ban, Repeat, Archive } from 'lucide-react';
import { format, parseISO, differenceInCalendarDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useApp } from '../context/AppContext';
import { overdueTodos, splitOverdue, OLD_OVERDUE_DAYS } from '../lib/homeStats';
import { showToast } from '../lib/toast';
import type { Todo } from '../types';
import { useEscapeKey } from '../hooks/useEscapeKey';

interface Props {
  onEdit: (todo: Todo) => void;
  onClose: () => void;
}

// 지난 날짜에 못 끝낸 할 일 정리: 오늘로 옮기기 · 안 하기 · 끝냈으면 체크.
// 2주가 넘은 것은 "오래된 할 일"로 접어 두고 한 번에 정리할 수 있게 함.
// (반복 할 일은 가장 최근에 놓친 회차만 보임 → homeStats.overdueTodos)
export default function OverdueModal({ onEdit, onClose }: Props) {
  useEscapeKey(onClose);
  const { todos, categories, updateTodo, toggleTodo } = useApp();
  const [busy, setBusy] = useState(false);
  const [showOld, setShowOld] = useState(false);
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const { recent, old } = splitOverdue(overdueTodos(todos, todayStr), todayStr);

  async function runAll(list: Todo[], update: Partial<Todo>, message: string) {
    if (busy || list.length === 0) return;
    setBusy(true);
    try {
      for (const t of list) await updateTodo(t.id, update);
      showToast(message, 'success');
    } finally {
      setBusy(false);
    }
  }

  function skip(t: Todo) {
    updateTodo(t.id, { skipped: true });
    showToast(`'${t.title.length > 18 ? `${t.title.slice(0, 18)}…` : t.title}'을(를) 안 하기로 했어요`, 'info', 5000, {
      label: '되돌리기',
      onClick: () => updateTodo(t.id, { skipped: false }),
    });
  }

  const byDateDesc = (list: Todo[]) => {
    const dates = Array.from(new Set(list.map(t => t.date as string))).sort().reverse();
    return dates.map(date => ({ date, items: list.filter(t => t.date === date) }));
  };

  const row = (t: Todo) => {
    const cat = categories.find(c => c.id === t.categoryId);
    return (
      <li key={t.id} className="flex items-center gap-2.5 px-3 py-2.5">
        <button onClick={() => toggleTodo(t.id)} aria-label={`${t.title} 완료`}
          className="flex-shrink-0 -m-1.5 p-1.5">
          <span className="w-[18px] h-[18px] rounded-[6px] border-[1.5px] border-gray-300 dark:border-gray-600 flex items-center justify-center hover:border-leaf-500"
            style={cat ? { borderColor: `${cat.color}99` } : undefined} />
        </button>
        <button onClick={() => onEdit(t)} className="flex-1 min-w-0 text-left">
          <span className="block text-14px leading-snug text-gray-900 dark:text-gray-100 truncate">{t.title}</span>
          {(cat || t.seriesId) && (
            <span className="flex items-center gap-1.5 mt-0.5 text-11px text-gray-500 dark:text-gray-400">
              {cat && <><span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cat.color }} />{cat.name}</>}
              {t.seriesId && <span className="inline-flex items-center gap-0.5"><Repeat size={10} />반복</span>}
            </span>
          )}
        </button>
        <div className="flex-shrink-0 flex items-center gap-1">
          <button onClick={() => updateTodo(t.id, { date: todayStr })} className="row-action !bg-leaf-50 !text-leaf-700 hover:!bg-leaf-100 dark:!bg-leaf-900/30 dark:!text-leaf-300 dark:hover:!bg-leaf-900/60"
            title="오늘 할 일로 옮기기">
            <CalendarCheck size={11} />오늘로
          </button>
          <button onClick={() => skip(t)} className="row-action" title="하지 않기로 정리 (그 날짜에 흐리게 남아요)">
            <Ban size={11} />안 하기
          </button>
        </div>
      </li>
    );
  };

  const groups = (list: Todo[]) => byDateDesc(list).map(({ date, items }) => {
    const daysAgo = differenceInCalendarDays(parseISO(todayStr), parseISO(date));
    return (
      <div key={date}>
        <div className="flex items-center gap-2 mb-1.5 px-1">
          <span className="text-xs font-bold text-gray-600 dark:text-gray-300">{format(parseISO(date), 'M월 d일 (EEE)', { locale: ko })}</span>
          <span className="text-10px font-semibold text-gray-400">{daysAgo === 1 ? '어제' : `${daysAgo}일 전`}</span>
        </div>
        <ul className="rounded-xl surface divide-y divide-gray-100 dark:divide-gray-800/80">{items.map(row)}</ul>
      </div>
    );
  });

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-panel max-w-lg" role="dialog" aria-modal="true" aria-label="밀린 할 일">
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-gray-100 dark:border-gray-800">
          <div>
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="text-gray-500 dark:text-gray-400" />
              <h2 className="text-base font-bold text-gray-900 dark:text-white">밀린 할 일</h2>
              {recent.length > 0 && <span className="count-pill">{recent.length}</span>}
            </div>
            <p className="text-xs text-gray-400 mt-0.5">오늘로 옮기거나, 하지 않을 일은 '안 하기'로 정리하세요</p>
          </div>
          <button onClick={onClose} aria-label="닫기" className="btn-icon -mr-1.5"><X size={17} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {recent.length === 0 && old.length === 0 && (
            <div className="text-center py-12">
              <p className="text-sm text-gray-500 dark:text-gray-400">밀린 할 일이 없어요</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">지난 날짜의 할 일을 모두 정리했어요</p>
            </div>
          )}
          {recent.length === 0 && old.length > 0 && (
            <p className="text-13px text-gray-500 dark:text-gray-400 text-center pt-2">최근 2주 동안 밀린 할 일은 없어요</p>
          )}
          {groups(recent)}

          {old.length > 0 && (
            <section className="rounded-xl ring-1 ring-gray-200 dark:ring-gray-800">
              <button onClick={() => setShowOld(v => !v)} aria-expanded={showOld}
                className="w-full flex items-center gap-2 px-3.5 py-3 text-left">
                <Archive size={14} className="text-gray-400 flex-shrink-0" />
                <span className="flex-1 min-w-0">
                  <span className="block text-13px font-semibold text-gray-800 dark:text-gray-100">오래된 할 일 {old.length}개</span>
                  <span className="block text-11.5px text-gray-500 dark:text-gray-400">{OLD_OVERDUE_DAYS}일보다 더 지난 할 일이에요. 밀린 일 숫자에는 세지 않아요</span>
                </span>
                <ChevronDown size={16} className={`text-gray-400 transition-transform ${showOld ? 'rotate-180' : ''}`} />
              </button>
              {showOld && (
                <div className="px-2.5 pb-3 space-y-3">
                  <div className="flex gap-1.5 px-0.5">
                    <button disabled={busy} onClick={() => runAll(old, { skipped: true }, `오래된 할 일 ${old.length}개를 안 하기로 정리했어요`)}
                      className="btn-secondary flex-1 h-8 text-12.5px disabled:opacity-50">
                      <Ban size={13} />모두 안 하기
                    </button>
                    <button disabled={busy} onClick={() => runAll(old, { date: null }, `오래된 할 일 ${old.length}개를 저장소로 보냈어요`)}
                      className="btn-secondary flex-1 h-8 text-12.5px disabled:opacity-50" title="날짜 없이 저장소에 보관">
                      <Archive size={13} />모두 저장소로
                    </button>
                  </div>
                  {groups(old)}
                </div>
              )}
            </section>
          )}
        </div>

        {recent.length > 0 && (
          <div className="flex gap-2 px-6 py-4 border-t border-gray-100 dark:border-gray-800">
            <button onClick={() => runAll(recent, { skipped: true }, `${recent.length}개를 안 하기로 정리했어요`)} disabled={busy}
              className="btn-secondary h-10 px-3.5 text-sm disabled:opacity-50">
              모두 안 하기
            </button>
            <button onClick={() => runAll(recent, { date: todayStr }, `${recent.length}개를 오늘로 옮겼어요`)} disabled={busy}
              className="btn-primary flex-1 h-10 text-sm disabled:opacity-50">
              <CalendarCheck size={15} />
              {busy ? '정리하는 중…' : `모두 오늘로 (${recent.length}개)`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
