import { useState } from 'react';
import { X, CalendarClock, Trash2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { buildRecurringDates } from '../lib/recurrence';
import type { RepeatRule } from '../lib/recurrence';
import RepeatPicker from './RepeatPicker';
import SeriesScopePicker from './SeriesScopePicker';
import type { SeriesScope } from './SeriesScopePicker';
import type { ScheduleItem } from '../types';
import { LIMITS } from '../lib/limits';

interface Props {
  schedule?: ScheduleItem;
  defaultDate?: string;
  onClose: () => void;
}

export default function ScheduleModal({ schedule, defaultDate, onClose }: Props) {
  const {
    schedules, addSchedule, updateSchedule, deleteSchedule,
    addScheduleSeries, updateScheduleSeries, deleteScheduleSeries,
  } = useApp();
  const isEdit = !!schedule;
  const [title, setTitle] = useState(schedule?.title ?? '');
  const [date, setDate] = useState(schedule?.date ?? defaultDate ?? '');
  const [startTime, setStartTime] = useState(schedule?.startTime ?? '');
  const [notes, setNotes] = useState(schedule?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // 반복으로 만든 일정을 수정/삭제할 때 적용 범위
  const seriesId = schedule?.seriesId ?? null;
  const seriesItems = seriesId ? schedules.filter(s => s.seriesId === seriesId) : [];
  const inSeries = seriesItems.length > 1;

  // 반복 설정 (예: 매주 월·수 수업, 매주 화요일 정기 회의). 새 일정뿐 아니라
  // 아직 반복이 아닌 기존 일정도 반복으로 바꿀 수 있음 (이 일정이 첫 회차가 되고 이후 날짜가 추가됨)
  const canRepeat = !inSeries;
  const [repeat, setRepeat] = useState<RepeatRule>({ freq: 'none', weekdays: [], until: '' });
  const repeating = canRepeat && repeat.freq !== 'none';
  const repeatDates = repeating ? buildRecurringDates(date, repeat) : [];
  // 기존 일정을 반복으로 바꿀 때 새로 만들어지는 개수 (이 일정 날짜는 제외)
  const newRepeatCount = isEdit ? repeatDates.filter(d => d !== date).length : repeatDates.length;
  const [scope, setScope] = useState<SeriesScope>('one');
  const followingCount = schedule ? seriesItems.filter(s => s.date >= schedule.date).length : 0;
  const scopeFromDate = scope === 'following' && schedule ? schedule.date : null;

  const canSave = !!title.trim() && !!date && !saving && (!repeating || repeatDates.length > 0);

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    try {
      const fields = { title: title.trim(), startTime: startTime || null, notes: notes.trim() || null };
      if (isEdit && repeating && newRepeatCount > 0) {
        // 기존 일정을 반복으로 바꾸기: 이 일정은 내용/날짜만 저장하고 반복 묶음의 첫 회차로 사용
        await updateSchedule(schedule.id, { ...fields, date });
        await addScheduleSeries(fields, repeatDates.filter(d => d !== date), schedule.id);
      } else if (isEdit) {
        if (inSeries && scope !== 'one' && seriesId) {
          await updateScheduleSeries(seriesId, scopeFromDate, fields);
          // 날짜 변경은 이 일정에만 적용
          if (date !== schedule.date) await updateSchedule(schedule.id, { date });
        } else {
          await updateSchedule(schedule.id, { ...fields, date });
        }
      } else if (repeating) {
        await addScheduleSeries(fields, repeatDates);
      } else {
        await addSchedule({ ...fields, date });
      }
      onClose();
    } finally {
      setSaving(false);
    }
  }

  function handleDelete() {
    if (!schedule) return;
    if (inSeries && scope !== 'one' && seriesId) deleteScheduleSeries(seriesId, scopeFromDate);
    else deleteSchedule(schedule.id);
    onClose();
  }

  function handleBackdrop(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  const deleteCount = inSeries ? (scope === 'all' ? seriesItems.length : scope === 'following' ? followingCount : 1) : 1;

  return (
    <div className="modal-overlay" onClick={handleBackdrop}>
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm max-h-[90dvh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex-shrink-0 px-6 pt-5 pb-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarClock size={16} className="text-blue-500" />
            <h2 className="text-base font-bold text-gray-900 dark:text-white">{isEdit ? '일정 수정' : '일정 추가'}</h2>
          </div>
          <button onClick={onClose} aria-label="닫기"
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
            <X size={17} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3">
          <input maxLength={LIMITS.title}
            autoFocus
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="일정 제목"
            className="w-full px-3.5 py-2.5 rounded-lg bg-white dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 shadow-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm transition-all"
            onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleSave(); }}
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
          <textarea maxLength={LIMITS.longText}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="메모 (선택)"
            rows={2}
            className="w-full px-3.5 py-2.5 rounded-lg bg-white dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 shadow-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm resize-none transition-all"
          />

          {canRepeat && (
            <RepeatPicker
              startDate={date}
              rule={repeat}
              onChange={setRepeat}
              occurrenceCount={repeatDates.length}
              itemLabel="일정"
              accent="blue"
              convertingExisting={isEdit}
            />
          )}

          {isEdit && inSeries && (
            <SeriesScopePicker scope={scope} onChange={setScope} seriesCount={seriesItems.length} followingCount={followingCount} accent="blue" />
          )}
        </div>

        <div className="flex-shrink-0 flex gap-2 px-6 pb-5 pt-1">
          {isEdit && (
            confirmDelete ? (
              <button onClick={handleDelete}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg bg-red-500 text-white text-sm font-semibold whitespace-nowrap">
                <Trash2 size={14} />
                {deleteCount > 1 ? `${deleteCount}개 삭제` : '정말 삭제'}
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
          <button onClick={handleSave} disabled={!canSave}
            className="flex-1 py-2.5 rounded-lg bg-blue-500 hover:bg-blue-600 disabled:opacity-40 text-white text-sm font-semibold transition-colors whitespace-nowrap">
            {saving ? '저장 중...'
              : repeating && newRepeatCount > 0 ? (isEdit ? `저장 + ${newRepeatCount}개 추가` : `${newRepeatCount}개 추가`)
              : isEdit ? '저장' : '추가'}
          </button>
        </div>
      </div>
    </div>
  );
}
