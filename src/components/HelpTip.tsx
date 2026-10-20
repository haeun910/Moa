import { useEffect, useId, useRef, useState } from 'react';
import { HelpCircle } from 'lucide-react';

const BUBBLE_PX = 240; // w-60

// 말풍선이 잘리는 오른쪽 경계: 가로로 넘치는 부분을 숨기는 가장 가까운 부모, 없으면 화면 끝
function clipRight(el: HTMLElement): number {
  let right = window.innerWidth;
  for (let p = el.parentElement; p; p = p.parentElement) {
    const { overflowX } = getComputedStyle(p);
    if (overflowX !== 'visible') {
      right = Math.min(right, p.getBoundingClientRect().right);
      break;
    }
  }
  return right;
}

// 제목 옆 작은 물음표. 누르면 짧은 안내가 말풍선으로 뜨고, 다른 곳을 누르거나 Esc·Tab으로 벗어나면 닫힘
export default function HelpTip({ text, label }: { text: string; label: string }) {
  const [open, setOpen] = useState(false);
  // 화면 오른쪽 끝에 가까운 물음표는 말풍선이 잘리지 않게 왼쪽으로 펼침
  const [alignRight, setAlignRight] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const tipId = useId();

  useEffect(() => {
    if (!open) return;
    function close(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function toggle() {
    if (!open && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setAlignRight(rect.left + BUBBLE_PX > clipRight(ref.current) - 8);
    }
    setOpen(v => !v);
  }

  return (
    <span ref={ref} className="relative inline-flex"
      onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false); }}>
      <button type="button" onClick={e => { e.stopPropagation(); toggle(); }}
        aria-label={`${label} 도움말`} aria-expanded={open} aria-describedby={open ? tipId : undefined}
        className="w-4 h-4 flex items-center justify-center rounded-full text-gray-300 hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-400 transition-colors">
        <HelpCircle size={13} />
      </button>
      {open && (
        <span id={tipId} role="tooltip"
          className={`absolute ${alignRight ? '-right-1' : '-left-1'} top-full mt-1.5 z-30 w-60 px-3 py-2 rounded-lg bg-gray-900 dark:bg-gray-700 text-white text-[12px] leading-snug font-normal shadow-lg text-left whitespace-normal`}>
          {text}
        </span>
      )}
    </span>
  );
}
