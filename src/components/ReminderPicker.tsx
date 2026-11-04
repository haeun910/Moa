import { Bell, BellOff } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { isPushConfigured } from '../lib/push';

// 시간이 있을 때: 시작 시각 기준 / 시간이 없을 때: 그날 오전 9시 기준 (0 = 당일 9시, 1440 = 전날 9시)
const TIMED: { value: number | null; label: string }[] = [
  { value: null, label: '없음' },
  { value: 0, label: '정시' },
  { value: 10, label: '10분 전' },
  { value: 30, label: '30분 전' },
  { value: 60, label: '1시간 전' },
  { value: 1440, label: '하루 전' },
];
const ALL_DAY: { value: number | null; label: string }[] = [
  { value: null, label: '없음' },
  { value: 0, label: '당일 오전 9시' },
  { value: 1440, label: '전날 오전 9시' },
];

// 시간을 지웠을 때처럼 지금 고를 수 없는 값이면 가장 가까운 값으로
export function normalizeRemind(value: number | null | undefined, hasTime: boolean): number | null {
  if (value === null || value === undefined) return null;
  if (hasTime) return TIMED.some(o => o.value === value) ? value : 10;
  return value >= 1440 ? 1440 : 0;
}

interface Props {
  value: number | null;
  onChange: (value: number | null) => void;
  hasDate: boolean;
  hasTime: boolean;
  onLeave: () => void; // "설정에서 켜기"를 누르면 창을 닫고 설정으로
  compact?: boolean; // 일정 창처럼 작은 제목 모양
}

// 할 일·일정의 미리 알림 고르기 (알림 서버가 준비된 앱에서만 보임)
export default function ReminderPicker({ value, onChange, hasDate, hasTime, onLeave, compact }: Props) {
  const push = usePushNotifications();
  const { setCurrentScreen } = useApp();
  if (!isPushConfigured) return null;
  const options = hasTime ? TIMED : ALL_DAY;
  const current = normalizeRemind(value, hasTime);
  const pushOff = current !== null && hasDate && push.state !== 'on';

  return (
    <div>
      <p className={compact ? 'flex items-center gap-1 text-12px font-medium text-gray-500 dark:text-gray-400 mb-1' : 'flex items-center gap-1 text-13px font-medium text-gray-700 dark:text-gray-300 mb-1.5'}>
        <Bell size={11} />
        미리 알림
      </p>
      {hasDate ? (
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="미리 알림">
          {options.map(opt => {
            const on = current === opt.value;
            return (
              <button key={String(opt.value)} type="button" role="radio" aria-checked={on} onClick={() => onChange(opt.value)}
                className={`h-8 px-3 rounded-lg text-12.5px transition-colors ${
                  on
                    ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 font-semibold'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 font-medium'
                }`}>
                {opt.label}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-12px text-gray-400 dark:text-gray-500">날짜를 정하면 알림을 받을 수 있어요</p>
      )}
      {pushOff && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
          <BellOff size={12} className="flex-shrink-0 mt-px" />
          <span>
            {push.state === 'ios-needs-install'
              ? '아이폰은 홈 화면에 추가한 앱에서만 알림을 받을 수 있어요. '
              : push.state === 'unsupported'
                ? '이 브라우저는 알림을 지원하지 않아요. 다른 기기에서 알림을 켜 두면 거기로 알려드려요.'
                : push.state === 'denied'
                  ? '이 브라우저에서 알림이 차단되어 있어요. 브라우저 설정에서 허용해 주세요.'
                  : '이 기기는 알림이 꺼져 있어요. '}
            {(push.state === 'off' || push.state === 'ios-needs-install') && (
              <button type="button" onClick={() => { onLeave(); setCurrentScreen('settings'); }} className="underline underline-offset-2 font-medium">
                설정에서 켜기
              </button>
            )}
          </span>
        </p>
      )}
    </div>
  );
}
