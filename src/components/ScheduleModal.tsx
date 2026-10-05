import { useState } from 'react';
import { X, CalendarClock, Trash2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { ScheduleItem } from '../types';

interface Props {
  schedule?: ScheduleItem;
  defaultDate?: string;
  onClose: () => void;
}

export default function ScheduleModal({ schedule, defaultDate, onClose }: Props) {
  const { addSchedule, updateSchedule, deleteSchedule } = useApp();
  const isEdit = !!schedule;
  const [title, setTitle] = useState(schedule?.title ?? '');
  const [date, setDate] = useState(schedule?.date ?? defaultDate ?? '');
  const [startTime, setStartTime] = useState(schedule?.startTime ?? '');
  const [notes, setNotes] = useState(schedule?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handleSave() {
    const t = title.trim();
    if (!t || !date || saving) return;
    setSaving(true);
    try {
      const fields = { title: t, date, startTime: startTime || null, notes: notes.trim() || null };
      if (isEdit) await updateSchedule(schedule.id, fields);
      else await addSchedule(fields);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  function handleDelete() {
    if (schedule) { deleteSchedule(schedule.id); onClose(); }
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
            <CalendarClock size={16} className="text-blue-500" />
            <h2 className="text-base font-bold text-gray-900 dark:text-white">{isEdit ? '일정 수정' : '일정 추가'}</h2>
          </div>
          <button onClick={onClose} aria-label="닫기"
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
            <X size={17} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-3">
          <input
            autoFocus
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="일정 제목"
            className="w-full px-3.5 py-2.5 rounded-lg bg-white dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 shadow-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm transition-all"
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-white dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 shadow-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm transition-all"
            />
            <input
              type="time"
              value={startTime}
              onChange={e => setStartTime(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-white dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 shadow-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm transition-all"
            />
          </div>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="메모 (선택)"
            rows={2}
            className="w-full px-3.5 py-2.5 rounded-lg bg-white dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 shadow-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm resize-none transition-all"
          />
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
            <button onClick={handleSave} disabled={!title.trim() || !date || saving}
              className="flex-1 py-2.5 rounded-lg bg-blue-500 hover:bg-blue-600 disabled:opacity-40 text-white text-sm font-semibold transition-colors">
              {saving ? '저장 중...' : isEdit ? '저장' : '추가'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
