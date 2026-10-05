import { X, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { CHANGELOG } from '../data/changelog';

export default function ChangelogModal({ onClose }: { onClose: () => void }) {
  function handleBackdrop(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div className="modal-overlay" onClick={handleBackdrop}>
      <div
        className="modal-panel max-w-lg"
        style={{ maxHeight: '85vh' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 pt-5 pb-4 border-b border-gray-100 dark:border-gray-800 flex-shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-leaf-600" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">업데이트 내역</h2>
          </div>
          <button onClick={onClose} aria-label="닫기"
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3">
          {CHANGELOG.map((entry, i) => (
            <div key={entry.version} className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/40 p-4">
              <div className="flex items-baseline gap-2 mb-2">
                <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100">v{entry.version}</h3>
                {i === 0 && (
                  <span className="text-[10px] font-bold text-leaf-600 bg-leaf-100 dark:bg-leaf-900/40 px-1.5 py-0.5 rounded-full">최신</span>
                )}
                <span className="text-[10px] text-gray-400 dark:text-gray-500 ml-auto">
                  {format(new Date(entry.date), 'yyyy년 M월 d일', { locale: ko })}
                </span>
              </div>
              <ul className="space-y-1">
                {entry.changes.map((c, j) => (
                  <li key={j} className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed flex gap-1.5">
                    <span className="text-leaf-500 flex-shrink-0">·</span>
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
