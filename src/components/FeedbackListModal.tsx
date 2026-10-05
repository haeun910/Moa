import { useEffect, useState } from 'react';
import { X, Inbox, Trash2, RefreshCw } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import * as db from '../lib/db';
import type { DbFeedback } from '../lib/db';
import { showToast } from '../lib/toast';

// 관리자 전용: 사용자들이 보낸 의견 목록 (보낸 사람은 개인정보 보호를 위해 표시하지 않음)
export default function FeedbackListModal({ onClose }: { onClose: () => void }) {
  const [items, setItems] = useState<DbFeedback[] | null>(null);
  const [error, setError] = useState('');

  async function load() {
    setError('');
    try {
      setItems(await db.fetchFeedback());
    } catch (err) {
      console.error(err);
      setError('불러오지 못했어요. 013 마이그레이션을 실행했는지 확인해주세요.');
      setItems([]);
    }
  }

  useEffect(() => { load(); }, []);

  async function remove(id: string) {
    const prev = items;
    setItems(list => list?.filter(f => f.id !== id) ?? null);
    try {
      await db.deleteFeedback(id);
    } catch {
      setItems(prev);
      showToast('삭제하지 못했어요.', 'error');
    }
  }

  function handleBackdrop(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div className="modal-overlay" onClick={handleBackdrop}>
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[85dvh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex-shrink-0 px-6 pt-5 pb-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Inbox size={17} className="text-leaf-600" />
            <h2 className="text-base font-bold text-gray-900 dark:text-white">받은 의견</h2>
            {items && <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded-full">{items.length}</span>}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={load} aria-label="새로고침"
              className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
              <RefreshCw size={15} />
            </button>
            <button onClick={onClose} aria-label="닫기"
              className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
              <X size={17} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
          {items === null && <p className="text-sm text-gray-400 text-center py-10">불러오는 중...</p>}
          {error && <p className="text-sm text-red-500 text-center py-4">{error}</p>}
          {items && items.length === 0 && !error && <p className="text-sm text-gray-400 text-center py-10">아직 받은 의견이 없어요</p>}
          {items?.map(f => (
            <div key={f.id} className="group rounded-xl border border-gray-200 dark:border-gray-800 p-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] text-gray-400">
                  {format(parseISO(f.created_at), 'yyyy.M.d HH:mm')}{f.app_version ? ` · v${f.app_version}` : ''}
                </span>
                <button onClick={() => remove(f.id)} aria-label="삭제"
                  className="opacity-60 md:opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all">
                  <Trash2 size={13} />
                </button>
              </div>
              <p className="text-sm text-gray-800 dark:text-gray-100 whitespace-pre-wrap break-words">{f.content}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
