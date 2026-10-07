import { useState } from 'react';
import type React from 'react';
import { format } from 'date-fns';
import { ChevronRight, LogOut, Moon, Sun, Monitor, Bell, BellRing, Tag, Info, FileDown, KeyRound, FileText, ShieldCheck, UserX, Download, CheckCircle2, BarChart3, EyeOff, Milestone } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { usePwaInstall } from '../hooks/usePwaInstall';
import { usePushNotifications } from '../hooks/usePushNotifications';
import type { PushState } from '../hooks/usePushNotifications';
import ChangePasswordModal from '../components/ChangePasswordModal';
import DeleteAccountModal from '../components/DeleteAccountModal';
import InstallInstructionsModal from '../components/InstallInstructionsModal';
import ChangelogModal from '../components/ChangelogModal';
import AdminStatsModal from '../components/AdminStatsModal';
import { APP_VERSION } from '../data/changelog';
import type { Settings } from '../types';

const SCREEN_OPTIONS: { value: Settings['defaultScreen']; label: string }[] = [
  { value: 'today', label: '홈' },
  { value: 'timebox', label: '타임박스' },
  { value: 'all', label: '저장소' },
  { value: 'notes', label: '메모' },
];

// ── 설정 화면 공통 조각 ─────────────────────────────────────

function Group({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section>
      {title && <h2 className="text-[13px] font-semibold text-gray-500 dark:text-gray-400 mb-2 px-1">{title}</h2>}
      <div className="rounded-xl surface divide-y divide-gray-100 dark:divide-gray-800 overflow-hidden">
        {children}
      </div>
    </section>
  );
}

function RowContent({ icon, title, desc, danger }: { icon: React.ReactNode; title: string; desc?: string; danger?: boolean }) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <span className={`flex-shrink-0 ${danger ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'}`}>{icon}</span>
      <div className="text-left min-w-0">
        <p className={`text-sm font-medium ${danger ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}`}>{title}</p>
        {desc && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{desc}</p>}
      </div>
    </div>
  );
}

function LinkRow({ onClick, chevron = true, trailing, ...content }: {
  icon: React.ReactNode; title: string; desc?: string; danger?: boolean;
  onClick: () => void; chevron?: boolean; trailing?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full px-4 min-h-[52px] py-3 flex items-center justify-between gap-3 transition-colors ${
        content.danger ? 'hover:bg-red-50/70 dark:hover:bg-red-900/10' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
      }`}
    >
      <RowContent {...content} />
      <span className="flex items-center gap-2 flex-shrink-0">
        {trailing}
        {chevron && <ChevronRight size={16} className="text-gray-300 dark:text-gray-600" />}
      </span>
    </button>
  );
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button
      onClick={onChange}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`relative w-11 h-[26px] rounded-full transition-colors duration-200 flex-shrink-0 ${checked ? 'bg-leaf-600 dark:bg-leaf-500' : 'bg-gray-200 dark:bg-gray-700'}`}
    >
      <span className={`absolute top-[3px] left-[3px] w-5 h-5 bg-white rounded-full shadow-[0_1px_3px_rgb(0_0_0/0.2)] transition-transform duration-200 ${checked ? 'translate-x-[18px]' : 'translate-x-0'}`} />
    </button>
  );
}

function Segmented<T extends string>({ value, options, onChange, label }: {
  value: T; options: { value: T; label: string; Icon?: React.FC<{ size?: number; strokeWidth?: number }> }[];
  onChange: (v: T) => void; label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid gap-0.5 p-0.5 rounded-lg bg-gray-100 dark:bg-gray-800" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      {options.map(({ value: v, label: l, Icon }) => (
        <button
          key={v}
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={`flex items-center justify-center gap-1.5 h-8 rounded-md text-[13px] transition-all ${
            value === v
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-semibold shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-medium'
          }`}
        >
          {Icon && <Icon size={14} strokeWidth={value === v ? 2.2 : 1.8} />}
          {l}
        </button>
      ))}
    </div>
  );
}

const PUSH_DESC: Record<PushState, string> = {
  on: '타임박스가 시작할 때 이 기기로 알려드려요',
  off: '타임박스가 시작할 때 이 기기로 알림 받기',
  denied: '알림이 차단되어 있어요. 브라우저(앱) 설정에서 알림을 허용해주세요',
  unsupported: '이 브라우저는 알림을 지원하지 않아요',
  'ios-needs-install': '아이폰·아이패드는 홈 화면에 앱을 설치한 뒤 켤 수 있어요',
  'not-configured': '알림 서버 설정이 아직 안 되어 있어요 (README 참고)',
};

// 타임박스 알림 (웹 푸시) - 기기마다 따로 켜고 끔
function PushRows({ onEnabledChange }: { onEnabledChange: (on: boolean) => void }) {
  const { state, busy, error, enable, disable, test } = usePushNotifications();
  const [testSent, setTestSent] = useState(false);
  const available = state === 'on' || state === 'off';

  async function toggle() {
    if (state === 'on') { if (await disable()) onEnabledChange(false); }
    else if (await enable()) onEnabledChange(true);
  }

  return (
    <>
      <div className="px-4 min-h-[52px] py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex-shrink-0 text-gray-500 dark:text-gray-400"><Bell size={17} /></span>
          <div className="text-left min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">알림</p>
            <p className={`text-xs mt-0.5 ${available ? 'text-gray-500 dark:text-gray-400' : 'text-amber-700 dark:text-amber-400'}`}>{PUSH_DESC[state]}</p>
            {error && <p className="text-xs mt-0.5 text-red-600 dark:text-red-400">{error}</p>}
          </div>
        </div>
        {available && <Switch label="알림" checked={state === 'on'} onChange={() => { if (!busy) toggle(); }} />}
      </div>
      {state === 'on' && (
        <LinkRow
          icon={<BellRing size={17} />}
          title="테스트 알림 보내기"
          desc={testSent ? '보냈어요! 잠시 후 알림이 오는지 확인해보세요' : '서버에서 이 계정의 기기들로 알림을 보내봐요'}
          chevron={false}
          onClick={async () => { if (!busy) setTestSent(await test()); }}
        />
      )}
    </>
  );
}

function FieldRow({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-3.5">
      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{title}</p>
      {desc && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{desc}</p>}
      <div className="mt-2.5">{children}</div>
    </div>
  );
}

export default function SettingsPage() {
  const { settings, updateSettings, categories, subcategories, todos, notes, monthlyGoals, ddays, schedules, timeblocks, isAdmin, setCurrentScreen } = useApp();
  const { user, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showInstallInstructions, setShowInstallInstructions] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);
  const [showAdminStats, setShowAdminStats] = useState(false);
  const { canPromptDirectly, isInstalled, promptInstall } = usePwaInstall();

  async function handleSignOut() { setSigningOut(true); await signOut(); }

  async function handleInstallClick() {
    if (canPromptDirectly) await promptInstall();
    else setShowInstallInstructions(true);
  }

  const hasEmailPassword = user?.app_metadata?.providers?.includes('email') ?? false;

  function handleExport() {
    const payload = {
      exportedAt: new Date().toISOString(),
      todos, categories, subcategories, notes, monthlyGoals, ddays, schedules, timeblocks,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `moa-backup-${format(new Date(), 'yyyyMMdd')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const displayName = user?.user_metadata?.display_name ?? user?.email?.split('@')[0] ?? '';
  const initials = displayName.slice(0, 2).toUpperCase();

  const THEME_OPTS = [
    { value: 'light' as const, label: '라이트', Icon: Sun },
    { value: 'dark' as const, label: '다크', Icon: Moon },
    { value: 'system' as const, label: '시스템', Icon: Monitor },
  ];

  return (
    <div className="px-4 lg:px-8 pt-8 sm:pt-10 pb-24 max-w-xl mx-auto">
      <h1 className="page-title mb-6">설정</h1>

      {/* Profile card */}
      <div className="rounded-xl surface p-4 mb-8 flex items-center gap-3.5">
        <div className="w-12 h-12 rounded-full bg-leaf-600 dark:bg-leaf-500 flex items-center justify-center flex-shrink-0 overflow-hidden ring-4 ring-leaf-50 dark:ring-leaf-900/30">
          {user?.user_metadata?.avatar_url ? (
            <img src={user.user_metadata.avatar_url} className="w-12 h-12 object-cover" alt="" />
          ) : (
            <span className="text-base font-bold text-white">{initials || '?'}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-semibold text-gray-900 dark:text-white truncate">{displayName || '사용자'}</p>
          <p className="text-[13px] text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
        </div>
        <button onClick={handleSignOut} disabled={signingOut} className="btn-secondary h-8 px-3 text-[13px] flex-shrink-0">
          <LogOut size={14} />
          {signingOut ? '로그아웃 중' : '로그아웃'}
        </button>
      </div>

      <div className="space-y-7">
        <Group title="화면">
          <FieldRow title="테마">
            <Segmented label="테마" value={settings.theme} options={THEME_OPTS} onChange={v => updateSettings({ theme: v })} />
          </FieldRow>
          <FieldRow title="시작 화면" desc="앱을 열면 처음 보이는 화면">
            <Segmented label="시작 화면" value={settings.defaultScreen} options={SCREEN_OPTIONS} onChange={v => updateSettings({ defaultScreen: v })} />
          </FieldRow>
          <FieldRow title="달력 글자 크기" desc="홈 화면 달력 칸에 보이는 일정 글자">
            <Segmented
              label="달력 글자 크기"
              value={settings.calendarTextSize}
              options={[{ value: 'small', label: '작게' }, { value: 'medium', label: '보통' }, { value: 'large', label: '크게' }]}
              onChange={v => updateSettings({ calendarTextSize: v })}
            />
          </FieldRow>
        </Group>

        {/* 목록 표시 (정렬 / 완료 숨기기 / 카테고리별 표시) */}
        <Group title="목록 표시">
          <FieldRow title="정렬 기준">
            <Segmented
              label="정렬 기준"
              value={settings.listSortBy}
              options={[{ value: 'manual', label: '직접 순서' }, { value: 'date', label: '등록순' }, { value: 'name', label: '이름순' }]}
              onChange={v => updateSettings({ listSortBy: v })}
            />
          </FieldRow>
          <div className="px-4 min-h-[52px] py-3 flex items-center justify-between gap-3">
            <RowContent icon={<EyeOff size={17} />} title="완료된 항목 숨기기" />
            <Switch label="완료된 항목 숨기기" checked={settings.hideCompleted} onChange={() => updateSettings({ hideCompleted: !settings.hideCompleted })} />
          </div>
          {categories.length > 0 && (
            <div className="px-4 py-3.5">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">카테고리별 표시</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 mb-2.5">끄면 저장소와 홈 목록에서 숨겨져요</p>
              <div className="flex flex-wrap gap-1.5">
                {categories.map(cat => {
                  const hidden = settings.hiddenCategoryIds.includes(cat.id);
                  return (
                    <button
                      key={cat.id}
                      role="checkbox"
                      aria-checked={!hidden}
                      onClick={() => updateSettings({
                        hiddenCategoryIds: hidden
                          ? settings.hiddenCategoryIds.filter(id => id !== cat.id)
                          : [...settings.hiddenCategoryIds, cat.id],
                      })}
                      className={`flex items-center gap-1.5 h-8 px-3 rounded-full text-[13px] font-medium ring-1 ring-inset transition-colors ${
                        hidden
                          ? 'ring-gray-200 dark:ring-gray-700 text-gray-400 dark:text-gray-500 line-through decoration-gray-300'
                          : 'ring-gray-300 dark:ring-gray-600 text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-900'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${hidden ? 'opacity-40' : ''}`} style={{ backgroundColor: cat.color }} />
                      {cat.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </Group>

        <Group title="정리">
          <PushRows onEnabledChange={on => updateSettings({ notifications: on })} />
          <LinkRow icon={<Tag size={17} />} title="카테고리 관리" onClick={() => setCurrentScreen('categories')}
            trailing={<span className="text-[13px] tabular-nums text-gray-400">{categories.length}개</span>} />
          <LinkRow icon={<Milestone size={17} />} title="프로젝트 로드맵" desc="카테고리 하나를 골라 타임라인으로 보기" onClick={() => setCurrentScreen('project')} />
        </Group>

        {/* 계정 & 데이터 */}
        <Group title="계정과 데이터">
          {hasEmailPassword && (
            <LinkRow icon={<KeyRound size={17} />} title="비밀번호 변경" onClick={() => setShowPasswordModal(true)} />
          )}
          <LinkRow icon={<FileDown size={17} />} title="데이터 내보내기" desc="할 일 · 메모 등을 JSON 파일로 백업" onClick={handleExport} chevron={false} />
          <LinkRow icon={<UserX size={17} />} title="계정 삭제" danger onClick={() => setShowDeleteModal(true)} chevron={false} />
        </Group>

        {/* 관리자 전용 */}
        {isAdmin && (
          <Group title="관리자">
            <LinkRow icon={<BarChart3 size={17} />} title="관리자 통계" desc="가입자 · 활성 사용자 등 (관리자만 보여요)" onClick={() => setShowAdminStats(true)} />
          </Group>
        )}

        <Group title="앱 정보">
          {isInstalled ? (
            <div className="px-4 min-h-[52px] py-3 flex items-center">
              <RowContent icon={<CheckCircle2 size={17} className="text-leaf-600" />} title="앱이 이미 설치되어 있어요" />
            </div>
          ) : (
            <LinkRow icon={<Download size={17} />} title="앱 설치하기" desc="홈 화면에 추가하면 더 편리해요" onClick={handleInstallClick} />
          )}
          <LinkRow icon={<Info size={17} />} title="업데이트 내역" onClick={() => setShowChangelog(true)}
            trailing={<span className="text-[13px] tabular-nums text-gray-400">v{APP_VERSION}</span>} />
          <LinkRow icon={<FileText size={17} />} title="이용약관" onClick={() => setCurrentScreen('terms')} />
          <LinkRow icon={<ShieldCheck size={17} />} title="개인정보처리방침" onClick={() => setCurrentScreen('privacy')} />
        </Group>

        <p className="text-center text-xs text-gray-400 dark:text-gray-600 pt-2">모아 v{APP_VERSION}</p>
      </div>

      {showPasswordModal && <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />}
      {showDeleteModal && <DeleteAccountModal onClose={() => setShowDeleteModal(false)} />}
      {showInstallInstructions && <InstallInstructionsModal onClose={() => setShowInstallInstructions(false)} />}
      {showChangelog && <ChangelogModal onClose={() => setShowChangelog(false)} />}
      {showAdminStats && <AdminStatsModal onClose={() => setShowAdminStats(false)} />}
    </div>
  );
}
