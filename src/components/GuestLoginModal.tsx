import { useEffect, useState } from 'react';
import type React from 'react';
import { X, Mail, Lock, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';

// 체험 중에 "이미 계정이 있어요": 바로 그 계정으로 로그인.
// 체험 데이터는 기존 계정으로 합칠 수 없어서 지워지므로, 남기고 싶으면 계정 만들기를 안내함
export default function GuestLoginModal({ onClose, onUpgrade }: { onClose: () => void; onUpgrade: () => void }) {
  const { loginFromGuest, googleLoginFromGuest } = useAuth();
  const { todos, notes, schedules } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState<'email' | 'google' | null>(null);

  // 구글 화면에서 뒤로 가기로 돌아오면 "이동 중" 상태가 그대로 복원되므로 풀어 줌
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => { if (e.persisted) setLoading(null); };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);

  const written = [
    todos.length > 0 && `할 일 ${todos.length}개`,
    schedules.length > 0 && `일정 ${schedules.length}개`,
    notes.length > 0 && `메모 ${notes.length}개`,
  ].filter(Boolean).join(', ');

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setError('');
    setLoading('email');
    const { error } = await loginFromGuest(email.trim(), password);
    if (error) {
      setLoading(null);
      setError(/invalid|credentials/i.test(error)
        ? '이메일 또는 비밀번호가 맞지 않아요. 체험 내용은 그대로 있어요.'
        : /confirm/i.test(error)
          ? '이메일 확인이 아직 안 된 계정이에요. 가입할 때 받은 메일의 링크를 먼저 눌러 주세요.'
          : '로그인하지 못했어요. 잠시 후 다시 시도해 주세요.');
    }
    // 성공하면 그 계정으로 바뀌면서 이 창도 사라짐
  }

  async function handleGoogle() {
    setError('');
    setLoading('google');
    const { error } = await googleLoginFromGuest();
    if (error) {
      setError('Google 로그인을 시작하지 못했어요. 잠시 후 다시 시도해 주세요.');
      setLoading(null);
    }
  }

  const inputClass = 'w-full pl-10 pr-4 py-2.5 rounded-lg bg-white dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-leaf-500/25 focus:border-leaf-500 text-sm transition-all';

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget && !loading) onClose(); }}>
      <div className="modal-panel sm:max-w-sm">
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">기존 계정으로 로그인</h2>
          <button onClick={onClose} aria-label="닫기" className="btn-icon -mr-1.5"><X size={17} /></button>
        </div>
        <div className="px-6 py-5 space-y-4 overflow-y-auto">
          <div className="flex gap-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/60 px-3.5 py-3">
            <AlertTriangle size={15} className="text-gray-500 dark:text-gray-400 flex-shrink-0 mt-0.5" />
            <p className="text-12.5px text-gray-600 dark:text-gray-300 leading-relaxed">
              {written ? <>체험 중에 적은 {written}는 기존 계정으로 옮겨지지 않고 지워져요. </> : <>체험 중에 적은 내용은 기존 계정으로 옮겨지지 않아요. </>}
              남기고 싶다면{' '}
              <button onClick={onUpgrade} className="font-semibold text-leaf-700 dark:text-leaf-400 underline underline-offset-2">새 계정 만들기</button>
              로 옮겨 주세요.
            </p>
          </div>

          <button onClick={handleGoogle} disabled={loading !== null} className="btn-secondary w-full h-11 gap-2.5 disabled:opacity-60">
            <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden>
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
            </svg>
            {loading === 'google' ? 'Google로 이동 중…' : 'Google로 로그인'}
          </button>

          <div className="flex items-center gap-3 text-11px text-gray-400">
            <span className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />또는 이메일<span className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
          </div>

          <form onSubmit={handleEmail} className="space-y-2.5">
            <div className="relative">
              <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="이메일" aria-label="이메일" className={inputClass} />
            </div>
            <div className="relative">
              <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="password" required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="비밀번호" aria-label="비밀번호" className={inputClass} />
            </div>
            <button type="submit" disabled={loading !== null} className="btn-primary w-full h-10 disabled:opacity-50">
              {loading === 'email' ? '로그인 중…' : '로그인'}
            </button>
          </form>

          {error && (
            <p role="alert" className="text-xs text-red-600 dark:text-red-400 font-medium">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
