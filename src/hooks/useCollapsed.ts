import { useState } from 'react';

// 접었다 펼 수 있는 묶음(홈 카드 등)의 접힘 상태. 기기에 기억해 두고 다음에 열 때도 그대로
export function useCollapsed(key: string, defaultCollapsed = false): [boolean, () => void] {
  const storageKey = `collapsed:${key}`;
  const [collapsed, setCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved === null ? defaultCollapsed : saved === '1';
    } catch { return defaultCollapsed; }
  });
  function toggle() {
    setCollapsed(v => {
      try { localStorage.setItem(storageKey, v ? '0' : '1'); } catch { /* 기억 못 해도 지금은 접힘 */ }
      return !v;
    });
  }
  return [collapsed, toggle];
}
