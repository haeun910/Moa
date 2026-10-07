import { useCallback, useEffect, useState } from 'react';
import { disablePush, enablePush, getPushSubscription, isIosBrowserTab, isPushConfigured, isPushSupported, sendTestPush } from '../lib/push';

export type PushState = 'unsupported' | 'ios-needs-install' | 'not-configured' | 'denied' | 'off' | 'on';

// 이 기기의 타임박스 알림 상태 (설정 화면 스위치, 블록 편집 화면 안내에서 사용)
export function usePushNotifications() {
  const [state, setState] = useState<PushState>('off');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (isIosBrowserTab()) return setState('ios-needs-install');
    if (!isPushSupported()) return setState('unsupported');
    if (!isPushConfigured) return setState('not-configured');
    if (Notification.permission === 'denied') return setState('denied');
    const sub = await getPushSubscription().catch(() => null);
    setState(sub && Notification.permission === 'granted' ? 'on' : 'off');
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const run = useCallback(async (action: () => Promise<unknown>): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      await action();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : '알림 설정 중 문제가 생겼어요.');
      return false;
    } finally {
      await refresh();
      setBusy(false);
    }
  }, [refresh]);

  const enable = useCallback(() => run(enablePush), [run]);
  const disable = useCallback(() => run(disablePush), [run]);

  const test = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const { sent } = await sendTestPush();
      if (sent === 0) setError('보낼 기기를 찾지 못했어요. 알림을 껐다가 다시 켜보세요.');
      return sent > 0;
    } catch (err) {
      const reason = err instanceof Error && err.message ? ` (${err.message})` : '';
      setError(`테스트 알림을 보내지 못했어요${reason}. 알림 서버(Edge Function) 설정을 확인해주세요.`);
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  return { state, busy, error, enable, disable, test };
}
