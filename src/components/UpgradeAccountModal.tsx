import { useEffect, useState } from 'react';
import { X, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// 게스트(체험) 계정을 정식 계정으로: 지금까지 적은 내용은 같은 계정이라 그대로 남음
export default function UpgradeAccountModal({ onClose }: { onClose: () => void }) {
  const { upgradeWithEmail, linkGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState<'email' | 'google' | null>(null);

  // 구글 화면에서 뒤로 가기로 돌아오면 "이동 중" 상태가 그대로 복원되므로 풀어 줌
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => { if (e.persisted) setLoading(null); };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    const value = email.trim();
    if (!value) return;
    setError('');
    setLoading('email');
    const { error } = await upgradeWithEmail(value);
    setLoading(null);
    if (!error) { setSentTo(value); return; }
    setError(/already|registered|exists/i.test(error)
      ? '이미 가입된 이메일이에요. 다른 이메일을 쓰거나, 데이터를 내보낸 뒤 그 계정으로 로그인해 주세요.'
      : '메일을 보내지 못했어요. 이메일 주소를 확인하고 잠시 후 다시 시도해 주세요.');
  }

  async function handleGoogle() {
    setError('');
    setLoading('google');
    // 성공하면 구글 화면으로 넘어감
    const { error } = await linkGoogle();
    if (error) {
      setError('Google 연결을 시작하지 못했어요. 잠시 후 다시 시도하거나 이메일로 만들어 주세요.');
      setLoading(null);
    }
  }

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-panel max-w-sm">
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">계정 만들기</h2>
          <button onClick={onClose} aria-label="닫기"
            className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {sentTo ? (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">확인 메일을 보냈어요</p>
              <p className="text-[13px] text-gray-500 dark:text-gray-400 leading-relaxed">
                <b className="text-gray-700 dark:text-gray-300">{sentTo}</b> 메일함에서 링크를 누르면 정식 계정이 돼요.
                지금까지 적은 내용은 그대로 남아요. 그다음 <b className="text-gray-700 dark:text-gray-300">설정 › 비밀번호 변경</b>에서
                로그인할 때 쓸 비밀번호를 정해 주세요.
              </p>
              <button onClick={onClose} className="btn-primary w-full h-10">확인</button>
            </div>
          ) : (
            <>
              <p className="text-[13px] text-gray-500 dark:text-gray-400 leading-relaxed">
                지금은 이 기기에서만 쓰는 체험 계정이에요. 계정을 만들면 적어 둔 내용이 그대로 옮겨지고, 다른 기기에서도 로그인할 수 있어요.
              </p>

              <button onClick={handleGoogle} disabled={loading !== null} className="btn-secondary w-full h-11 gap-2.5 shadow-sm disabled:opacity-60">
                {loading === 'google' ? 'Google로 이동 중…' : 'Google 계정으로 만들기'}
              </button>

              <form onSubmit={handleEmail} className="space-y-2.5">
                <label className="block text-[13px] font-medium text-gray-700 dark:text-gray-300">또는 이메일로</label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.com"
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-white dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 shadow-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-leaf-500/25 focus:border-leaf-500 text-sm transition-all" />
                </div>
                <button type="submit" disabled={loading !== null} className="btn-primary w-full h-10 disabled:opacity-50">
                  {loading === 'email' ? '보내는 중…' : '확인 메일 받기'}
                </button>
              </form>

              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl px-3.5 py-2.5">
                  <p className="text-xs text-red-600 dark:text-red-400 font-medium">{error}</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
