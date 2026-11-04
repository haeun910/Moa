import { useEffect, useState } from 'react';

// 현재 시각 (타임라인의 "지금" 선, 지금 하는 블록 강조용). 기본 30초마다 갱신
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    function handleVisible() {
      if (document.visibilityState === 'visible') setNow(new Date());
    }
    document.addEventListener('visibilitychange', handleVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', handleVisible);
    };
  }, [intervalMs]);
  return now;
}
