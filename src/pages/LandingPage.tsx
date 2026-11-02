import { useEffect, useState } from 'react';
import { format, addDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Check, ListChecks, CalendarDays, Flag, Clock, StickyNote, Package, Smartphone, RefreshCw, ChevronDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Logo from '../components/Logo';

// 로그인 전 첫 화면 (검색으로 처음 들어온 사람에게 모아가 무엇인지 보여 줌)
// 버튼: Google로 시작하기 / 가입 없이 둘러보기 / 이메일로 로그인(→ 기존 로그인 화면)

interface Props {
  onLogin: () => void;          // 이메일 로그인·회원가입 화면으로
  onLegal: (which: 'terms' | 'privacy') => void;
}

const FEATURES = [
  { Icon: ListChecks, title: '오늘 할 일', text: '카테고리별로 나눠 적고, 끝내면 체크해서 지워요. 못 끝낸 일은 한 번에 오늘로 옮길 수 있어요.' },
  { Icon: CalendarDays, title: '일정과 달력', text: '약속, 수업, 회의를 달력에 넣어요. 매주 반복, 여러 날 일정, 공휴일 표시도 돼요.' },
  { Icon: Flag, title: 'D-Day와 이번 달 목표', text: '시험, 마감, 기념일까지 남은 날을 홈에서 바로 보여 줘요.' },
  { Icon: Clock, title: '타임박스', text: '하루를 시간 단위로 나눠 계획해요. 시작할 때 알림을 받을 수 있어요.' },
  { Icon: Package, title: '저장소', text: '아직 날짜를 정하지 않은 할 일을 모아 두고, 정해지면 원하는 날로 보내요.' },
  { Icon: StickyNote, title: '메모', text: '장보기 목록, 회의 메모처럼 할 일이 아닌 것도 폴더로 정리해 둬요.' },
];

const FAQ = [
  { q: '정말 무료인가요?', a: '네. 지금 있는 모든 기능을 무료로 쓸 수 있어요.' },
  { q: '가입하지 않고도 써 볼 수 있나요?', a: '"가입 없이 둘러보기"를 누르면 바로 시작돼요. 체험 계정은 이 기기에서만 쓸 수 있고, 마음에 들면 설정에서 Google이나 이메일 계정으로 옮기면 적어 둔 내용이 그대로 남아요.' },
  { q: '휴대폰에서도 쓸 수 있나요?', a: '휴대폰, 태블릿, PC 브라우저에서 모두 열려요. 홈 화면에 추가하면 앱처럼 쓸 수 있고, 같은 계정으로 로그인하면 기기끼리 자동으로 맞춰져요.' },
  { q: '내가 적은 내용은 다른 사람이 볼 수 있나요?', a: '아니요. 내용은 계정별로 나뉘어 저장되고, 내 계정으로 로그인해야만 볼 수 있어요. 계정을 지우면 내용도 함께 지워져요.' },
];

const GoogleMark = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
    <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
    <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
    <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"/>
    <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z"/>
  </svg>
);

export default function LandingPage({ onLogin, onLegal }: Props) {
  const { signInWithGoogle, signInAsGuest } = useAuth();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [error, setError] = useState('');

  // 구글 화면에서 뒤로 가기로 돌아오면 버튼이 "이동 중"으로 막혀 있으므로 풀어 줌
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => { if (e.persisted) { setGoogleLoading(false); setGuestLoading(false); } };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);

  async function handleGoogle() {
    setError('');
    setGoogleLoading(true);
    const { error } = await signInWithGoogle();
    if (error) {
      setError('Google 로그인을 시작하지 못했어요. 잠시 후 다시 시도하거나 이메일로 로그인해 주세요.');
      setGoogleLoading(false);
    }
  }

  async function handleGuest() {
    setError('');
    setGuestLoading(true);
    const { error } = await signInAsGuest();
    if (error) {
      setError('체험을 시작하지 못했어요. 잠시 후 다시 시도해 주세요.');
      setGuestLoading(false);
    }
  }

  const ctas = (where: 'hero' | 'footer') => (
    <div className="flex flex-col sm:flex-row gap-2.5">
      <button onClick={handleGoogle} disabled={googleLoading}
        className={`h-12 px-6 rounded-xl inline-flex items-center justify-center gap-2.5 text-[15px] font-semibold transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-leaf-500 ${
          where === 'hero'
            ? 'bg-leaf-700 hover:bg-leaf-800 text-white shadow-sm'
            : 'bg-white hover:bg-leaf-50 text-gray-900'
        }`}>
        <span className={where === 'hero' ? 'bg-white rounded-full p-[3px] -ml-1' : ''}><GoogleMark /></span>
        {googleLoading ? 'Google로 이동 중…' : 'Google로 시작하기'}
      </button>
      <button onClick={handleGuest} disabled={guestLoading}
        className={`h-12 px-6 rounded-xl inline-flex items-center justify-center text-[15px] font-semibold transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-leaf-500 ${
          where === 'hero'
            ? 'bg-white dark:bg-gray-900 ring-1 ring-inset ring-gray-300 dark:ring-gray-700 text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800'
            : 'ring-1 ring-inset ring-white/40 text-white hover:bg-white/10'
        }`}>
        {guestLoading ? '체험 준비 중…' : '가입 없이 둘러보기'}
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white">
      {/* 머리글 */}
      <header className="max-w-6xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Logo size={32} />
          <span className="text-lg font-bold tracking-[-0.03em]">모아</span>
        </div>
        <button onClick={onLogin}
          className="h-9 px-4 rounded-lg text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-200/60 dark:hover:bg-gray-800 transition-colors">
          로그인
        </button>
      </header>

      <main>
        {/* 첫 화면: 왼쪽 소개, 오른쪽은 직접 눌러 볼 수 있는 오늘 화면 */}
        <section className="relative overflow-hidden">
          <div aria-hidden className="absolute inset-0 opacity-[0.5] dark:opacity-[0.12] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]"
            style={{ backgroundImage: 'linear-gradient(to right, #E2E5DC 1px, transparent 1px), linear-gradient(to bottom, #E2E5DC 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
          <div className="relative max-w-6xl mx-auto px-5 sm:px-8 pt-10 pb-16 sm:pt-16 sm:pb-24 grid lg:grid-cols-[1.05fr_1fr] gap-12 lg:gap-10 items-center">
            <div>
              <h1 className="text-[40px] sm:text-[56px] leading-[1.12] font-bold tracking-[-0.045em]">
                흩어진 할 일과 일정,<br />한 곳에 모아.
              </h1>
              <p className="mt-5 text-[17px] leading-[1.7] text-gray-600 dark:text-gray-300 max-w-[30em]">
                오늘 할 일, 약속, D-Day, 시간 계획을 한 화면에서 보는 무료 플래너예요.
                메모장과 달력 앱을 오가지 않아도 돼요.
              </p>
              <div className="mt-8">{ctas('hero')}</div>
              {error && <p role="alert" className="mt-3 text-sm font-medium text-red-600 dark:text-red-400">{error}</p>}
              <p className="mt-4 text-[13px] text-gray-500 dark:text-gray-400">
                이메일로 가입했다면{' '}
                <button onClick={onLogin} className="font-semibold text-leaf-700 dark:text-leaf-400 underline underline-offset-2">이메일로 로그인</button>
              </p>
            </div>
            <TryTodayCard />
          </div>
        </section>

        {/* 기능 */}
        <section className="bg-white dark:bg-gray-900 border-y border-gray-200 dark:border-gray-800">
          <div className="max-w-6xl mx-auto px-5 sm:px-8 py-16 sm:py-24">
            <h2 className="text-[28px] sm:text-[34px] font-bold tracking-[-0.035em] leading-tight max-w-[18em]">
              하루를 꾸리는 데 필요한 것만 담았어요
            </h2>
            <p className="mt-3 text-gray-600 dark:text-gray-300 leading-relaxed max-w-[34em]">
              안 쓰는 기능은 설정에서 끄면 메뉴에서 사라져요.
            </p>
            <ul className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-10">
              {FEATURES.map(({ Icon, title, text }) => (
                <li key={title} className="flex gap-4">
                  <span className="flex-shrink-0 w-10 h-10 rounded-full bg-leaf-100 dark:bg-leaf-900/50 text-leaf-700 dark:text-leaf-300 flex items-center justify-center">
                    <Icon size={19} />
                  </span>
                  <div>
                    <h3 className="font-bold text-[16px] tracking-[-0.02em]">{title}</h3>
                    <p className="mt-1.5 text-[14.5px] leading-[1.65] text-gray-600 dark:text-gray-400">{text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 기기 */}
        <section className="max-w-6xl mx-auto px-5 sm:px-8 py-16 sm:py-20 grid md:grid-cols-2 gap-10">
          <div className="flex gap-4">
            <Smartphone size={22} className="flex-shrink-0 mt-1 text-leaf-600" />
            <div>
              <h2 className="text-xl font-bold tracking-[-0.03em]">설치 없이, 앱처럼</h2>
              <p className="mt-2 text-[15px] leading-[1.7] text-gray-600 dark:text-gray-300">
                브라우저에서 바로 열려요. 휴대폰 홈 화면에 추가하면 아이콘을 눌러 앱처럼 쓸 수 있어요.
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <RefreshCw size={22} className="flex-shrink-0 mt-1 text-leaf-600" />
            <div>
              <h2 className="text-xl font-bold tracking-[-0.03em]">폰에서 적고 PC에서 보고</h2>
              <p className="mt-2 text-[15px] leading-[1.7] text-gray-600 dark:text-gray-300">
                같은 계정으로 로그인하면 휴대폰과 PC의 내용이 자동으로 맞춰져요.
              </p>
            </div>
          </div>
        </section>

        {/* 자주 묻는 질문 */}
        <section className="max-w-3xl mx-auto px-5 sm:px-8 pb-20">
          <h2 className="text-[24px] sm:text-[28px] font-bold tracking-[-0.035em]">자주 묻는 질문</h2>
          <div className="mt-6 divide-y divide-gray-200 dark:divide-gray-800 border-y border-gray-200 dark:border-gray-800">
            {FAQ.map(({ q, a }) => (
              <details key={q} className="group py-4">
                <summary className="flex items-center justify-between gap-4 cursor-pointer list-none font-semibold text-[15.5px] [&::-webkit-details-marker]:hidden">
                  {q}
                  <ChevronDown size={18} className="flex-shrink-0 text-gray-400 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
                </summary>
                <p className="mt-2.5 text-[14.5px] leading-[1.7] text-gray-600 dark:text-gray-400">{a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* 마지막 권유 */}
        <section className="relative overflow-hidden bg-leaf-900 text-white">
          <div aria-hidden className="absolute inset-0 opacity-[0.07]"
            style={{ backgroundImage: 'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
          <div className="relative max-w-6xl mx-auto px-5 sm:px-8 py-16 sm:py-20 flex flex-col md:flex-row md:items-center md:justify-between gap-8">
            <div>
              <h2 className="text-[28px] sm:text-[34px] font-bold tracking-[-0.035em] leading-tight">오늘 할 일부터 적어 보세요</h2>
              <p className="mt-2 text-leaf-100/75">가입은 나중에 해도 괜찮아요.</p>
            </div>
            {ctas('footer')}
          </div>
        </section>
      </main>

      <footer className="max-w-6xl mx-auto px-5 sm:px-8 py-8 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between text-[13px] text-gray-500 dark:text-gray-400">
        <p>© {new Date().getFullYear()} 모아</p>
        <div className="flex gap-5">
          <a href="/?screen=terms" onClick={e => { e.preventDefault(); onLegal('terms'); }} className="hover:text-gray-800 dark:hover:text-gray-200">이용약관</a>
          <a href="/?screen=privacy" onClick={e => { e.preventDefault(); onLegal('privacy'); }} className="font-semibold hover:text-gray-800 dark:hover:text-gray-200">개인정보처리방침</a>
        </div>
      </footer>
    </div>
  );
}

// ── 직접 체크해 볼 수 있는 "오늘" 카드 (저장되지 않는 예시) ─────────────
function TryTodayCard() {
  const now = new Date();
  const [todos, setTodos] = useState([
    { title: '주간 보고서 보내기', cat: '업무', color: '#4F73A8', done: true },
    { title: '기출문제 2회차 풀기', cat: '공부', color: '#5F7A27', done: false },
    { title: '저녁 러닝 5km', cat: '건강', color: '#B5525C', done: false },
    { title: '엄마 생신 선물 고르기', cat: '개인', color: '#B7832F', done: false },
  ]);
  const doneCount = todos.filter(t => t.done).length;
  const pct = Math.round((doneCount / todos.length) * 100);

  return (
    <div className="relative mx-auto w-full max-w-[440px]">
      <div className="rounded-[22px] bg-white dark:bg-gray-900 shadow-[0_24px_60px_-20px_rgba(40,52,18,0.35)] ring-1 ring-gray-200/80 dark:ring-gray-800 p-5 sm:p-6">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[12px] font-medium text-gray-500">{format(now, 'EEEE', { locale: ko })} · 오늘</p>
            <p className="text-[22px] font-bold tracking-[-0.03em]">{format(now, 'M월 d일', { locale: ko })}</p>
          </div>
          <span className="text-[12px] font-semibold text-leaf-700 dark:text-leaf-300 bg-leaf-50 dark:bg-leaf-900/40 rounded-md px-2 py-1 tabular-nums">
            {doneCount}/{todos.length} 완료
          </span>
        </div>
        <div className="mt-3 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="오늘 할 일 진행률">
          <div className="h-full rounded-full bg-leaf-500 transition-[width] duration-500 ease-out motion-reduce:transition-none" style={{ width: `${pct}%` }} />
        </div>

        {/* 일정·D-Day 한 줄 요약 */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 px-3 py-2.5">
            <p className="text-[11px] font-semibold text-blue-600 dark:text-blue-300">일정</p>
            <p className="text-[13px] font-semibold text-gray-800 dark:text-gray-100 mt-0.5">14:00 치과 예약</p>
          </div>
          <div className="rounded-xl bg-leaf-50 dark:bg-leaf-900/30 px-3 py-2.5">
            <p className="text-[11px] font-semibold text-leaf-700 dark:text-leaf-300">D-6</p>
            <p className="text-[13px] font-semibold text-gray-800 dark:text-gray-100 mt-0.5">자격증 시험 <span className="font-normal text-gray-500">{format(addDays(now, 6), 'M/d')}</span></p>
          </div>
        </div>

        <ul className="mt-4 space-y-1">
          {todos.map((t, i) => (
            <li key={t.title}>
              <button
                onClick={() => setTodos(ts => ts.map((x, j) => j === i ? { ...x, done: !x.done } : x))}
                aria-pressed={t.done}
                className="w-full flex items-center gap-3 rounded-lg px-2 py-2 -mx-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-leaf-500">
                <span className={`flex-shrink-0 w-[18px] h-[18px] rounded-[5px] border-[1.5px] flex items-center justify-center transition-colors ${t.done ? 'bg-leaf-600 border-leaf-600' : ''}`}
                  style={t.done ? undefined : { borderColor: `${t.color}aa` }}>
                  {t.done && <Check size={12} className="text-white" strokeWidth={3.5} />}
                </span>
                <span className={`flex-1 text-[14.5px] ${t.done ? 'line-through text-gray-400' : 'text-gray-800 dark:text-gray-100'}`}>{t.title}</span>
                <span className="text-[11px] font-medium rounded px-1.5 py-0.5" style={{ color: t.color, backgroundColor: `${t.color}14` }}>{t.cat}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-3 text-center text-[12.5px] text-gray-500 dark:text-gray-400">
        {doneCount === todos.length ? '오늘 할 일을 다 끝냈어요!' : '할 일을 눌러 체크해 보세요'}
      </p>
    </div>
  );
}
