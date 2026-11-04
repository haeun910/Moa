import { useEffect } from 'react';
import type React from 'react';
import { X } from 'lucide-react';

// 팝업 창: 폰에서는 아래에서 올라오는 시트, 넓은 화면에서는 가운데 카드.
// title을 주면 머리글(제목 + 닫기)을 그려 주고, 안 주면 children이 머리글까지 그림
export default function Sheet({ title, icon, onClose, children, footer, size = 'md' }: {
  title?: React.ReactNode;
  icon?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'md' | 'lg';
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" className={`modal-panel ${size === 'lg' ? 'sm:max-w-lg h-[85svh] sm:h-[min(720px,85svh)]' : 'sm:max-w-md max-h-[80svh]'}`}>
        <div className="sm:hidden mx-auto mt-2 w-9 h-1 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0" aria-hidden />
        {title && (
          <div className="flex-shrink-0 flex items-center justify-between gap-3 px-5 pt-4 pb-2">
            <div className="flex items-center gap-2 min-w-0">
              {icon}
              <h2 className="text-base font-bold text-gray-900 dark:text-white truncate">{title}</h2>
            </div>
            <button onClick={onClose} aria-label="닫기" className="btn-icon -mr-1.5"><X size={18} /></button>
          </div>
        )}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">{children}</div>
        {footer && <div className="flex-shrink-0 border-t border-gray-100 dark:border-gray-800 px-4 pt-3 pb-3">{footer}</div>}
      </div>
    </div>
  );
}
