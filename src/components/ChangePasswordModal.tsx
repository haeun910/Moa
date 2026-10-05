import { useState } from 'react';
import { X, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const { updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('비밀번호는 8자 이상이어야 합니다.'); return; }
    if (password !== confirm) { setError('비밀번호가 서로 일치하지 않습니다.'); return; }

    setLoading(true);
    try {
      const { error } = await updatePassword(password);
      if (error) setError(error);
      else setDone(true);
    } finally {
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
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">비밀번호 변경</h2>
          <button onClick={onClose} aria-label="닫기"
            className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5">
          {done ? (
            <div className="text-center py-4">
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">비밀번호가 변경되었습니다</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">다음 로그인부터 새 비밀번호를 사용해주세요.</p>
              <button onClick={onClose}
                className="w-full py-2.5 rounded-lg bg-leaf-600 hover:bg-leaf-700 text-white text-sm font-semibold transition-colors">
                확인
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">새 비밀번호</label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="password"
                    autoFocus
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="8자 이상"
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-white dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 shadow-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-leaf-500/25 focus:border-leaf-500 text-sm transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">새 비밀번호 확인</label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="다시 입력"
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-white dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 shadow-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-leaf-500/25 focus:border-leaf-500 text-sm transition-all"
                  />
                </div>
              </div>

              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl px-3.5 py-2.5">
                  <p className="text-xs text-red-600 dark:text-red-400 font-medium">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-lg bg-leaf-600 hover:bg-leaf-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors mt-1"
              >
                {loading ? '변경 중...' : '비밀번호 변경'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
