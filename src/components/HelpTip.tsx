import { useEffect, useRef, useState } from 'react';
import { HelpCircle } from 'lucide-react';

// 제목 옆 작은 물음표. 누르면 짧은 안내가 말풍선으로 뜨고, 다른 곳을 누르면 닫힘
export default function HelpTip({ text, label }: { text: string; label: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function close(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  return (
    <span ref={ref} className="relative inline-flex">
      <button type="button" onClick={e => { e.stopPropagation(); setOpen(v => !v); }}
        aria-label={`${label} 도움말`} aria-expanded={open}
        className="w-4 h-4 flex items-center justify-center rounded-full text-gray-300 hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-400 transition-colors">
        <HelpCircle size={13} />
      </button>
      {open && (
        <span role="tooltip"
          className="absolute -left-1 top-full mt-1.5 z-30 w-52 px-3 py-2 rounded-lg bg-gray-900 dark:bg-gray-700 text-white text-[12px] leading-snug font-normal shadow-lg text-left whitespace-normal">
          {text}
        </span>
      )}
    </span>
  );
}
