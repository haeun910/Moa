import { useState } from 'react';
import { X, Flag, Trash2, Pencil, Plus, Link2 } from 'lucide-react';
import { parseISO, differenceInCalendarDays, format } from 'date-fns';
import DDayModal from './DDayModal';
import type { DDay } from '../types';

interface Props {
  ddays: DDay[]; // 지나간 것 포함 전체 (수동 등록 + 할 일 연동 가상 항목 모두)
  onDelete: (dday: DDay) => void;
  onClose: () => void;
}

// "D-Day" 제목을 누르면 지나간 것까지 포함한 전체 목록을 보여주는 모달.
// 메인 D-Day 위젯은 다가올 것만 보여주고, 여기서 전체 히스토리를 확인/관리함.
export default function DDayListModal({ ddays, onDelete, onClose }: Props) {
  const [editing, setEditing] = useState<DDay | 'new' | null>(null);

  function handleBackdrop(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  function ddayLabel(targetDate: string): string {
    const diff = differenceInCalendarDays(parseISO(targetDate), new Date());
    if (diff === 0) return 'D-Day';
    if (diff > 0) return `D-${diff}`;
    return `D+${Math.abs(diff)}`;
  }

  const sorted = [...ddays].sort((a, b) => a.targetDate.localeCompare(b.targetDate));

  return (
    <>
      <div className="modal-overlay" onClick={handleBackdrop}>
        <div
          className="modal-panel max-w-sm"
          style={{ maxHeight: '85vh' }}
          onClick={e => e.stopPropagation()}
        >
          <div className="px-6 pt-5 pb-4 border-b border-gray-100 dark:border-gray-800 flex-shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flag size={16} className="text-leaf-600" />
              <h2 className="text-base font-bold text-gray-900 dark:text-white">전체 D-Day</h2>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setEditing('new')} aria-label="D-Day 추가"
                className="w-8 h-8 rounded-full flex items-center justify-center text-leaf-600 hover:bg-leaf-50 dark:hover:bg-leaf-900/20">
                <Plus size={17} />
              </button>
              <button onClick={onClose} aria-label="닫기"
                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
                <X size={17} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3">
            {sorted.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8">등록된 D-Day가 없어요</p>
            )}
            <div className="space-y-1">
              {sorted.map(d => {
                const isPast = differenceInCalendarDays(parseISO(d.targetDate), new Date()) < 0;
                return (
                  <div key={d.id} className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl ${isPast ? 'opacity-50' : ''}`}>
                    <span className={`flex-shrink-0 text-[11px] font-bold px-1.5 py-0.5 rounded-md min-w-[42px] text-center ${
                      isPast ? 'bg-gray-100 dark:bg-gray-800 text-gray-400' : 'bg-leaf-50 dark:bg-leaf-900/30 text-leaf-600 dark:text-leaf-400'
                    }`}>{ddayLabel(d.targetDate)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 dark:text-gray-300 truncate">{d.title}</p>
                      <p className="text-[11px] text-gray-400">{format(parseISO(d.targetDate), 'yyyy.M.d')}</p>
                    </div>
                    {d.fromTodoId ? (
                      <span title="할 일에서 연동됨 (할 일 쪽에서 관리)" className="flex-shrink-0 text-gray-300 dark:text-gray-600">
                        <Link2 size={13} />
                      </span>
                    ) : (
                      <>
                        <button onClick={() => setEditing(d)} aria-label="수정"
                          className="flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:text-leaf-600 hover:bg-leaf-50 dark:hover:bg-leaf-900/20 transition-colors">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => onDelete(d)} aria-label="삭제"
                          className="flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {editing && (
        <DDayModal
          dday={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
