import { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { deleteAllUserData } from '../lib/db';

const CONFIRM_TEXT = '삭제합니다';

export default function DeleteAccountModal({ onClose }: { onClose: () => void }) {
  const { user, signOut } = useAuth();
  const [confirmInput, setConfirmInput] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (confirmInput !== CONFIRM_TEXT) { setError(`"${CONFIRM_TEXT}"를 정확히 입력해주세요.`); return; }
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      await deleteAllUserData(user.id);
      await signOut();
    } catch {
      setError('삭제 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
      setLoading(false);
    }
  }

  function handleBackdrop(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div
      className="modal-overlay"
      onClick={handleBackdrop}
    >
      <div className="modal-panel max-w-sm">
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-base font-semibold text-red-600 dark:text-red-400">계정 삭제</h2>
          <button onClick={onClose} aria-label="닫기"
            className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="flex gap-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl px-3.5 py-3">
            <AlertTriangle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-700 dark:text-red-400 leading-relaxed">
              할 일, 카테고리, 메모, 목표, D-Day 등 저장된 <b>모든 데이터가 영구적으로 삭제</b>되며 되돌릴 수 없습니다. 삭제 후 자동으로 로그아웃됩니다.
            </p>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400">
            계속하려면 아래에 <b className="text-gray-700 dark:text-gray-300">{CONFIRM_TEXT}</b>를 입력해주세요.
          </p>
          <input
            type="text"
            value={confirmInput}
            onChange={e => setConfirmInput(e.target.value)}
            placeholder={CONFIRM_TEXT}
            className="w-full px-3.5 py-2.5 rounded-lg bg-white dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 shadow-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-400 text-sm transition-all"
          />

          {error && <p className="text-xs text-red-600 dark:text-red-400 font-medium">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-lg text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-sm font-medium">
              취소
            </button>
            <button
              onClick={handleDelete}
              disabled={loading || confirmInput !== CONFIRM_TEXT}
              className="flex-1 py-2.5 rounded-lg bg-red-500 hover:bg-red-600 disabled:opacity-40 text-white transition-colors text-sm font-semibold"
            >
              {loading ? '삭제 중...' : '영구 삭제'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
