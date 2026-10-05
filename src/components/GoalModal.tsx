import { useState } from 'react';
import { X, Flag } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useApp } from '../context/AppContext';

export default function GoalModal({ month, onClose }: { month: string; onClose: () => void }) {
  const { addMonthlyGoal } = useApp();
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const t = title.trim();
    if (!t || saving) return;
    setSaving(true);
    try {
      await addMonthlyGoal(month, t);
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
            <h2 className="text-base font-bold text-gray-900 dark:text-white">
              {format(parseISO(`${month}-01`), 'M월', { locale: ko })} 목표 추가
            </h2>
          </div>
          <button onClick={onClose} aria-label="닫기"
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
            <X size={17} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <input
            autoFocus
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="이번 달 목표를 입력하세요"
            className="w-full px-3.5 py-2.5 rounded-lg bg-white dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 shadow-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-leaf-500/25 focus:border-leaf-500 text-sm transition-all"
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
          />
          <div className="flex gap-2">
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-sm font-medium transition-colors">
              취소
            </button>
            <button onClick={handleSave} disabled={!title.trim() || saving}
              className="flex-1 py-2.5 rounded-lg bg-leaf-600 hover:bg-leaf-700 disabled:opacity-40 text-white text-sm font-semibold transition-colors">
              {saving ? '추가 중...' : '추가'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
