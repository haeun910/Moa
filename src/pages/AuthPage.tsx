import { useState } from 'react';
import { Eye, EyeOff, Mail, Lock, User, ArrowLeft, Check } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, addDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useAuth } from '../context/AuthContext';
import Logo from '../components/Logo';

type Mode = 'login' | 'signup' | 'forgot';

// 구글 로그인에서 돌아왔는데 실패한 경우(취소, 설정 문제 등) 주소에 붙어 오는 오류를 읽고 주소는 깨끗하게 정리
function readOAuthError(): string {
  const params = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const code = params.get('error') ?? hash.get('error');
  if (!code) return '';
  window.history.replaceState(null, '', window.location.pathname);
  if (code === 'access_denied') return 'Google 로그인이 취소되었습니다.';
  return 'Google 로그인에 실패했습니다. 잠시 후 다시 시도하거나 이메일로 로그인해 주세요.';
}

export default function AuthPage() {
  const { signIn, signUp, signInWithGoogle, resetPassword } = useAuth();
  const [mode, setMode] = useState<Mode>('login');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState(readOAuthError);
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  function reset() { setError(''); setInfo(''); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setInfo('');
    setLoading(true);

    try {
      if (mode === 'forgot') {
        const { error } = await resetPassword(email);
        if (error) setError(error);
        else setInfo('비밀번호 재설정 이메일을 보냈습니다.');
        return;
      }

      if (mode === 'signup') {
        if (password.length < 8) { setError('비밀번호는 8자 이상이어야 합니다.'); return; }
        const { error } = await signUp(email, password, displayName);
        if (error) setError(error);
        else setInfo('가입 확인 이메일을 보냈습니다. 메일함을 확인해 주세요.');
        return;
      }

      const { error } = await signIn(email, password);
      if (error) setError('이메일 또는 비밀번호가 올바르지 않습니다.');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    reset();
    const { error } = await signInWithGoogle();
    if (error) setError(error);
  }

  const inputClass = "w-full h-11 pl-10 pr-4 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-leaf-500/25 focus:border-leaf-500 text-sm transition-all";
  const labelClass = "block text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1.5";

  return (
    <div className="min-h-screen flex bg-white dark:bg-gray-950">
      <BrandPanel />

      <div className="flex-1 flex items-center justify-center px-5 py-10 sm:px-8">
      <div className="w-full max-w-[380px]">
        {/* Logo (작은 화면에서만, 큰 화면은 왼쪽 패널에 있음) */}
        <div className="lg:hidden flex items-center gap-2.5 mb-10">
          <Logo size={36} />
          <span className="text-xl font-bold tracking-[-0.03em] text-gray-900 dark:text-white">모아</span>
        </div>

        <div className="mb-7">
          <h1 className="text-[26px] font-bold tracking-[-0.03em] text-gray-900 dark:text-white">
            {mode === 'login' ? '다시 만나서 반가워요' : mode === 'signup' ? '모아 시작하기' : '비밀번호 재설정'}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5">
            {mode === 'login' ? '할 일과 일정을 이어서 정리해 보세요.' : mode === 'signup' ? '1분이면 가입하고 바로 쓸 수 있어요.' : '가입한 이메일로 재설정 링크를 보내드려요.'}
          </p>
        </div>

        <div>
          {mode !== 'forgot' && (
            <div className="grid grid-cols-2 p-0.5 rounded-lg bg-gray-100 dark:bg-gray-800 mb-6" role="tablist">
              {(['login', 'signup'] as const).map(m => (
                <button
                  key={m}
                  role="tab"
                  aria-selected={mode === m}
                  onClick={() => { setMode(m); reset(); }}
                  className={`h-9 rounded-md text-sm transition-all duration-200 ${
                    mode === m
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm font-semibold'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-medium'
                  }`}
                >
                  {m === 'login' ? '로그인' : '회원가입'}
                </button>
              ))}
            </div>
          )}

          {mode === 'forgot' && (
            <div className="mb-5">
              <button onClick={() => { setMode('login'); reset(); }} className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-medium">
                <ArrowLeft size={15} />
                로그인으로 돌아가기
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className={labelClass}>이름</label>
                <div className="relative">
                  <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)}
                    placeholder="홍길동" className={inputClass} />
                </div>
              </div>
            )}

            <div>
              <label className={labelClass}>이메일</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="example@email.com" required className={inputClass} />
              </div>
            </div>

            {mode !== 'forgot' && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[13px] font-medium text-gray-700 dark:text-gray-300">비밀번호</label>
                  {mode === 'login' && (
                    <button type="button" onClick={() => { setMode('forgot'); reset(); }}
                      className="text-[13px] text-leaf-700 dark:text-leaf-400 hover:underline underline-offset-2 font-medium">
                      비밀번호를 잊으셨나요?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                    placeholder={mode === 'signup' ? '8자 이상' : '비밀번호'} required
                    className={inputClass + ' pr-10'} />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div role="alert" className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-lg px-3.5 py-2.5">
                <p className="text-[13px] text-red-700 dark:text-red-400 font-medium">{error}</p>
              </div>
            )}
            {info && (
              <div role="status" className="bg-leaf-50 dark:bg-leaf-900/20 border border-leaf-200 dark:border-leaf-800/50 rounded-lg px-3.5 py-2.5">
                <p className="text-[13px] text-leaf-800 dark:text-leaf-300 font-medium">{info}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full h-11 !mt-6 active:scale-[0.99]"
            >
              {loading ? '처리 중...' : mode === 'login' ? '로그인' : mode === 'signup' ? '가입하기' : '재설정 이메일 보내기'}
            </button>
          </form>

          {mode !== 'forgot' && (
            <>
              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
                <span className="text-xs text-gray-400">또는</span>
                <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
              </div>

              <button
                onClick={handleGoogle}
                className="btn-secondary w-full h-11 gap-2.5 shadow-sm"
              >
                <svg width="18" height="18" viewBox="0 0 18 18">
                  <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
                  <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
                  <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"/>
                  <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z"/>
                </svg>
                Google로 계속하기
              </button>
            </>
          )}
        </div>

        <p className="text-xs text-gray-400 dark:text-gray-500 mt-8 leading-relaxed">
          계속하면 이용약관 및 개인정보처리방침에 동의하는 것으로 간주합니다.
        </p>
      </div>
      </div>
    </div>
  );
}

// ── 큰 화면 왼쪽: 브랜드 + 실제 화면을 축소한 미리보기 ───────────────
function BrandPanel() {
  const now = new Date();
  const days = eachDayOfInterval({ start: startOfWeek(startOfMonth(now)), end: endOfWeek(endOfMonth(now)) });
  const todayKey = format(now, 'yyyy-MM-dd');
  // 미리보기용 예시 일정 (오늘 기준 며칠 뒤)
  const previewChips: Record<string, { label: string; tone: 'leaf' | 'blue' }> = {
    [format(addDays(now, 2), 'yyyy-MM-dd')]: { label: '디자인 리뷰', tone: 'blue' },
    [format(addDays(now, 6), 'yyyy-MM-dd')]: { label: '자격증 시험', tone: 'leaf' },
    [format(addDays(now, 9), 'yyyy-MM-dd')]: { label: '팀 회식', tone: 'blue' },
  };
  const previewTodos = [
    { title: '주간 보고서 작성', done: true, color: '#4F7A3A' },
    { title: '기출문제 2회차 풀기', done: false, color: '#3E7CB1' },
    { title: '저녁 러닝 5km', done: false, color: '#B5525C' },
  ];

  return (
    <aside className="hidden lg:flex relative w-[46%] max-w-[680px] flex-col justify-between overflow-hidden bg-leaf-900 text-white px-12 py-11">
      {/* 은은한 모눈 배경 (플래너 종이 느낌) */}
      <div aria-hidden className="absolute inset-0 opacity-[0.07]"
        style={{ backgroundImage: 'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)', backgroundSize: '44px 44px' }} />
      <div aria-hidden className="absolute -right-32 -top-32 w-[420px] h-[420px] rounded-full bg-leaf-500/25 blur-3xl" />

      <div className="relative flex items-center gap-2.5">
        <Logo size={34} />
        <span className="text-lg font-bold tracking-[-0.03em]">모아</span>
      </div>

      <div className="relative">
        <h2 className="text-[40px] xl:text-[46px] leading-[1.15] font-bold tracking-[-0.04em]">
          흩어진 할 일과 일정,<br />한 곳에 모아.
        </h2>
        <p className="mt-4 text-[15px] leading-relaxed text-leaf-100/75 max-w-[380px]">
          이번 달 목표와 D-Day, 약속과 오늘 할 일을 한 화면에서 보고 차근차근 지워 나가요.
        </p>

        {/* 미리보기 */}
        <div className="relative mt-10 h-[300px] select-none" aria-hidden>
          <div className="absolute left-0 top-0 w-[340px] rounded-2xl bg-white text-gray-900 shadow-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold tracking-[-0.02em]">{format(now, 'yyyy년 M월', { locale: ko })}</p>
              <span className="text-[10px] font-semibold text-leaf-700 bg-leaf-50 rounded-md px-1.5 py-0.5">월</span>
            </div>
            <div className="grid grid-cols-7 gap-y-1 text-center">
              {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
                <span key={d} className={`text-[9px] font-semibold pb-1 ${i === 0 ? 'text-red-500/80' : i === 6 ? 'text-blue-500/80' : 'text-gray-400'}`}>{d}</span>
              ))}
              {days.map(day => {
                const key = format(day, 'yyyy-MM-dd');
                const chip = previewChips[key];
                const inMonth = isSameMonth(day, now);
                return (
                  <div key={key} className="h-[34px] flex flex-col items-center">
                    <span className={`w-5 h-5 flex items-center justify-center rounded-full text-[10px] tabular-nums ${
                      key === todayKey ? 'bg-leaf-600 text-white font-bold' : inMonth ? 'text-gray-700 font-medium' : 'text-gray-300'
                    }`}>{format(day, 'd')}</span>
                    {chip && (
                      <span className={`mt-0.5 w-[90%] h-1.5 rounded-full ${chip.tone === 'leaf' ? 'bg-leaf-300' : 'bg-blue-300'}`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="absolute left-[220px] top-[120px] w-[250px] rounded-2xl bg-white text-gray-900 shadow-2xl p-4">
            <p className="text-[10px] font-medium text-gray-500">{format(now, 'EEEE', { locale: ko })} <span className="text-leaf-600 font-semibold">오늘</span></p>
            <p className="text-[15px] font-bold tracking-[-0.03em] mb-2.5">{format(now, 'M월 d일', { locale: ko })}</p>
            <div className="h-1 rounded-full bg-gray-100 mb-3"><div className="h-full w-1/3 rounded-full bg-leaf-500" /></div>
            <div className="space-y-2">
              {previewTodos.map(t => (
                <div key={t.title} className="flex items-center gap-2">
                  <span className={`w-3.5 h-3.5 rounded-[4px] border-[1.5px] flex items-center justify-center ${t.done ? 'bg-leaf-600 border-leaf-600' : ''}`}
                    style={t.done ? undefined : { borderColor: `${t.color}99` }}>
                    {t.done && <Check size={9} className="text-white" strokeWidth={3.5} />}
                  </span>
                  <span className={`text-[12px] ${t.done ? 'line-through text-gray-400' : 'text-gray-800'}`}>{t.title}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <p className="relative text-xs text-leaf-100/50">© {now.getFullYear()} 모아</p>
    </aside>
  );
}
