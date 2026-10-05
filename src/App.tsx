import { lazy, Suspense, useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppProvider } from './context/AppContext';
import { isSupabaseConfigured } from './lib/supabase';
import Layout from './components/Layout';
import Logo from './components/Logo';
import InstallPrompt from './components/InstallPrompt';
import UpdatePrompt from './components/UpdatePrompt';
import Toaster from './components/Toaster';
import OnboardingModal from './components/OnboardingModal';
import ChangePasswordModal from './components/ChangePasswordModal';
import TodayPage from './pages/TodayPage';
import { useApp } from './context/AppContext';
import { hasSeenOnboarding, markOnboardingSeen } from './lib/onboarding';
import { AlertTriangle, WifiOff, RefreshCw } from 'lucide-react';

// 첫 화면(홈)을 빼고는 필요할 때 불러와서 처음 여는 속도를 줄임
const CalendarPage = lazy(() => import('./pages/CalendarPage'));
const AllTodosPage = lazy(() => import('./pages/AllTodosPage'));
const NotesPage = lazy(() => import('./pages/NotesPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const CategoryPage = lazy(() => import('./pages/CategoryPage'));
const ProjectPage = lazy(() => import('./pages/ProjectPage'));
const TermsPage = lazy(() => import('./pages/TermsPage'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));
const AuthPage = lazy(() => import('./pages/AuthPage'));

function SetupNeededScreen() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full rounded-2xl surface p-6 text-center">
        <div className="inline-flex w-14 h-14 rounded-2xl items-center justify-center mb-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200/60 dark:border-amber-800/40">
          <AlertTriangle size={26} className="text-amber-500" />
        </div>
        <h1 className="text-lg font-bold text-gray-900 dark:text-white mb-2">환경설정이 필요해요</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
          <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded-md">.env</code> 파일에
          {' '}<code className="text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded-md">VITE_SUPABASE_URL</code>과
          {' '}<code className="text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded-md">VITE_SUPABASE_ANON_KEY</code>가
          설정되지 않았습니다. 프로젝트 루트의 <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded-md">.env.example</code> 파일을 참고해
          <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded-md">.env</code> 파일을 만들어주세요.
        </p>
      </div>
    </div>
  );
}

// 앱을 여는 동안 보여주는 대기 화면. 오래 걸리면 안내 문구와 새로고침 버튼을 보여줌
// (index.html의 첫 대기 화면과 같은 모양이라 자연스럽게 이어짐)
function LoadingScreen({ message = '모아를 여는 중이에요' }: { message?: string }) {
  const [slow, setSlow] = useState(false);
  const [verySlow, setVerySlow] = useState(false);
  useEffect(() => {
    const t1 = setTimeout(() => setSlow(true), 5000);
    const t2 = setTimeout(() => setVerySlow(true), 15000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-6" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="animate-pulse motion-reduce:animate-none">
          <Logo size={56} />
        </div>
        <div className="flex items-center gap-1.5 text-sm font-medium text-gray-500 dark:text-gray-400">
          <span className="w-3.5 h-3.5 rounded-full border-2 border-leaf-500 border-t-transparent animate-spin motion-reduce:animate-none" />
          {message}
        </div>
        {slow && (
          <p className="text-xs text-gray-400 dark:text-gray-500 leading-relaxed">
            평소보다 조금 오래 걸리고 있어요.<br />인터넷 연결 상태를 확인해주세요.
          </p>
        )}
        {verySlow && (
          <button onClick={() => window.location.reload()}
            className="btn-primary h-9 px-4">
            <RefreshCw size={14} /> 새로고침
          </button>
        )}
      </div>
    </div>
  );
}

function LoadErrorScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-6">
      <div className="max-w-sm w-full text-center">
        <div className="inline-flex w-14 h-14 rounded-2xl items-center justify-center mb-4 surface">
          <WifiOff size={26} className="text-amber-500" />
        </div>
        <h1 className="text-lg font-bold text-gray-900 dark:text-white mb-2">내용을 불러오지 못했어요</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed mb-5">
          인터넷 연결을 확인한 뒤 다시 시도해주세요.<br />저장된 내용은 안전하게 보관되어 있어요.
        </p>
        <button onClick={onRetry}
          className="btn-primary h-10 px-5">
          <RefreshCw size={15} /> 다시 시도
        </button>
      </div>
    </div>
  );
}

function AppContent() {
  const { currentScreen, dataLoading, loadError, retryLoad, todos, schedules } = useApp();
  const { user } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);

  // 처음 쓰는 사람(아직 할 일/일정이 하나도 없음)에게만 첫 사용 안내를 한 번 보여줌
  useEffect(() => {
    if (!user || dataLoading || loadError) return;
    if (todos.length === 0 && schedules.length === 0 && !hasSeenOnboarding(user.id)) setShowOnboarding(true);
    // 불러오기가 끝난 직후 한 번만 판단
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, dataLoading, loadError]);

  function closeOnboarding() {
    if (user) markOnboardingSeen(user.id);
    setShowOnboarding(false);
  }

  if (dataLoading) return <LoadingScreen />;
  if (loadError) return <LoadErrorScreen onRetry={retryLoad} />;

  return (
    <Layout>
      <Suspense fallback={<LoadingScreen message="화면을 여는 중이에요" />}>
        {currentScreen === 'today'    && <TodayPage />}
        {currentScreen === 'calendar' && <CalendarPage />}
        {currentScreen === 'all'      && <AllTodosPage />}
        {currentScreen === 'notes'    && <NotesPage />}
        {currentScreen === 'settings' && <SettingsPage />}
        {currentScreen === 'categories' && <CategoryPage />}
        {currentScreen === 'project' && <ProjectPage />}
        {currentScreen === 'terms' && <TermsPage />}
        {currentScreen === 'privacy' && <PrivacyPage />}
      </Suspense>
      <InstallPrompt />
      {showOnboarding && <OnboardingModal onClose={closeOnboarding} />}
    </Layout>
  );
}

function Root() {
  const { user, loading, passwordRecovery, endPasswordRecovery } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) return <Suspense fallback={<LoadingScreen />}><AuthPage /></Suspense>;

  return (
    <AppProvider>
      <AppContent />
      {/* 비밀번호 재설정 메일 링크로 들어온 경우: 새 비밀번호부터 정하게 함 */}
      {passwordRecovery && <ChangePasswordModal recovery onClose={endPasswordRecovery} />}
    </AppProvider>
  );
}

export default function App() {
  if (!isSupabaseConfigured) return <SetupNeededScreen />;

  return (
    <AuthProvider>
      <Root />
      <UpdatePrompt />
      <Toaster />
    </AuthProvider>
  );
}
