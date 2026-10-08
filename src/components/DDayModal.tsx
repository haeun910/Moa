import { useState } from 'react';
import { X, Flag } from 'lucide-react';
import { format } from 'date-fns';
import { useApp } from '../context/AppContext';
import type { DDay } from '../types';
import { LIMITS } from '../lib/limits';

export default function DDayModal({ dday, onClose }: { dday?: DDay; onClose: () => void }) {
  const { addDDay, updateDDay } = useApp();
  const isEdit = !!dday;
  const [title, setTitle] = useState(dday?.title ?? '');
  const [targetDate, setTargetDate] = useState(dday?.targetDate ?? format(new Date(), 'yyyy-MM-dd'));
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const t = title.trim();
    if (!t || !targetDate || saving) return;
    setSaving(true);
    try {
      if (isEdit) await updateDDay(dday.id, { title: t, targetDate });
      else await addDDay(t, targetDate);
      onClose();
    } finally {
      setSaving(false);
    }
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
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
          />
          <input
            type="date"
            value={targetDate}
            onChange={e => setTargetDate(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-lg bg-white dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 shadow-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-leaf-500/25 focus:border-leaf-500 text-sm transition-all"
          />
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
