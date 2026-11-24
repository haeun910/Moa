import { useState } from 'react';
import { X, Flag, Milestone, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { useApp } from '../context/AppContext';
import type { DDay } from '../types';
import { LIMITS } from '../lib/limits';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { planProgress } from '../lib/plan';
import { setPlanTarget } from '../lib/planNav';

export default function DDayModal({ dday, onClose, onCreated }: { dday?: DDay; onClose: () => void; onCreated?: (dday: DDay) => void }) {
  useEscapeKey(onClose);
  const { addDDay, updateDDay, todos, currentScreen, setCurrentScreen } = useApp();
  const isEdit = !!dday;
  const [title, setTitle] = useState(dday?.title ?? '');
  const [targetDate, setTargetDate] = useState(dday?.targetDate ?? format(new Date(), 'yyyy-MM-dd'));
  const [saving, setSaving] = useState(false);
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  // 준비 계획(프로젝트 로드맵) 바로가기: 직접 만든 D-Day만 (로드맵 화면 안에서 열었으면 숨김)
  const planned = dday ? todos.filter(t => t.ddayId === dday.id) : [];
  const progress = planProgress(planned);
  const showPlanLink = !!dday && !dday.fromTodoId && currentScreen !== 'project' && (dday.targetDate >= todayStr || planned.length > 0);

  async function handleSave() {
    const t = title.trim();
    if (!t || !targetDate || saving) return;
    setSaving(true);
    try {
      if (isEdit) await updateDDay(dday.id, { title: t, targetDate });
      else {
        const created = await addDDay(t, targetDate);
        if (created) onCreated?.(created);
      }
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function openPlan() {
    if (!dday || saving) return;
    // 고치던 이름·날짜가 있으면 먼저 저장하고 넘어감
    const t = title.trim();
    if (t && targetDate && (t !== dday.title || targetDate !== dday.targetDate)) await updateDDay(dday.id, { title: t, targetDate });
    setPlanTarget(currentScreen, dday.id);
    setCurrentScreen('project');
    onClose();
  }

  function handleBackdrop(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div className="modal-overlay" onClick={handleBackdrop}>
      <div
        className="modal-panel max-w-sm"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 pt-5 pb-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flag size={16} className="text-leaf-600" />
            <h2 className="text-base font-bold text-gray-900 dark:text-white">{isEdit ? 'D-Day 수정' : 'D-Day 추가'}</h2>
          </div>
          <button onClick={onClose} aria-label="닫기"
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
            <X size={17} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-3">
          <input maxLength={LIMITS.title}
            autoFocus
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="디데이 이름"
            className="w-full px-3.5 py-2.5 rounded-lg bg-white dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 shadow-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-leaf-500/25 focus:border-leaf-500 text-sm transition-all"
            onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleSave(); }}
          />
          <input
            type="date"
            value={targetDate}
            onChange={e => setTargetDate(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-lg bg-white dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 shadow-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-leaf-500/25 focus:border-leaf-500 text-sm transition-all"
          />
          {showPlanLink && (
            <button onClick={openPlan}
              className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-800 text-left transition-colors">
              <Milestone size={17} className="text-leaf-600 dark:text-leaf-400 flex-shrink-0" />
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold text-gray-900 dark:text-white">{planned.length ? '준비 계획 보기' : '준비 계획 세우기'}</span>
                <span className="block text-11.5px text-gray-500 dark:text-gray-400 mt-0.5">
                  {planned.length ? `준비할 일 ${progress.total}개 중 ${progress.done}개 끝냈어요` : '이날까지 할 일을 날짜별로 나눠 드려요'}
                </span>
              </span>
              <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />
            </button>
          )}
          <div className="flex gap-2 pt-1">
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-sm font-medium transition-colors">
              취소
            </button>
            <button onClick={handleSave} disabled={!title.trim() || !targetDate || saving}
              className="flex-1 py-2.5 rounded-lg bg-leaf-600 hover:bg-leaf-700 disabled:opacity-40 text-white text-sm font-semibold transition-colors">
              {saving ? '저장 중...' : isEdit ? '저장' : '추가'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
