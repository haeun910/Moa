import { Bell, BellOff } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { isPushConfigured } from '../lib/push';
import { ALL_DAY_REMIND_OPTIONS as ALL_DAY, TIMED_REMIND_OPTIONS as TIMED, normalizeRemind } from '../lib/reminder';

interface Props {
  value: number | null;
  onChange: (value: number | null) => void;
  hasDate: boolean;
  hasTime: boolean;
  onLeave: () => void; // "설정에서 켜기"를 누르면 창을 닫고 설정으로
  compact?: boolean; // 일정 창처럼 작은 제목 모양
  accent?: 'leaf' | 'blue'; // 반복 고르기와 같은 색 (할 일 = 초록, 일정 = 파랑)
}

// 할 일·일정의 미리 알림 고르기 (알림 서버가 준비된 앱에서만 보임)
export default function ReminderPicker({ value, onChange, hasDate, hasTime, onLeave, compact, accent = 'leaf' }: Props) {
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
                // 반복 고르기(RepeatPicker)와 같은 모양
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  on
                    ? (accent === 'blue' ? 'bg-blue-500 border-blue-500 text-white' : 'bg-leaf-600 border-leaf-600 text-white')
                    : 'bg-transparent border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-400'
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
