import { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { deleteGuestAccount, deleteMyAccount, isMissingGuestDeleteFunction } from '../lib/db';

// 체험 끝내기: 게스트 계정은 로그아웃하면 다시 들어올 방법이 없어서, 남기지 않고 데이터째 지움
export default function EndGuestModal({ onClose, onUpgrade }: { onClose: () => void; onUpgrade: () => void }) {
  const { user, signOut } = useAuth();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleEnd() {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      // 체험 계정만 지우는 함수로 (다른 창에서 회원 계정으로 바뀌었으면 서버가 거절). 024 전 DB면 예전 방식
      try {
        await deleteGuestAccount(user.id);
      } catch (e) {
        if (!isMissingGuestDeleteFunction(e) || !user.is_anonymous) throw e;
        await deleteMyAccount(user.id);
      }
      await signOut().catch(() => {});
    } catch {
      setError('체험을 끝내지 못했어요. 잠시 후 다시 시도해 주세요.');
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-panel max-w-sm">
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">체험 끝내기</h2>
          <button onClick={onClose} aria-label="닫기"
            className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="flex gap-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl px-3.5 py-3">
            <AlertTriangle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-700 dark:text-red-400 leading-relaxed">
              체험 계정은 다시 들어올 수 없어서, 끝내면 지금까지 적은 <b>모든 내용이 지워져요.</b> 남기고 싶으면 먼저 계정을 만들어 주세요.
            </p>
          </div>
          {error && <p className="text-xs text-red-600 dark:text-red-400 font-medium">{error}</p>}
          <div className="flex gap-2">
            <button onClick={onUpgrade} disabled={loading} className="btn-primary flex-1 h-10">계정 만들기</button>
            <button onClick={handleEnd} disabled={loading}
              className="flex-1 h-10 rounded-lg text-sm font-semibold text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/60 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50">
              {loading ? '지우는 중…' : '지우고 끝내기'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
