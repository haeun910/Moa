import { useState } from 'react';
import { X, MessageSquareHeart, Send } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import * as db from '../lib/db';
import { APP_VERSION } from '../data/changelog';
import { showToast } from '../lib/toast';

const MAX_LENGTH = 2000;

// 설정 > 의견 보내기: 불편한 점/원하는 기능을 운영자에게 보냄 (보낸 내용은 운영자만 볼 수 있음)
export default function FeedbackModal({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  async function handleSend() {
    const text = content.trim();
    if (!text || !user || sending) return;
    setSending(true);
    setError('');
    try {
      await db.createFeedback(user.id, text, APP_VERSION);
      showToast('의견을 보냈어요. 소중한 의견 고마워요!', 'success');
      onClose();
    } catch (err) {
      console.error(err);
      setError(navigator.onLine === false
        ? '인터넷에 연결되어 있지 않아요. 연결 후 다시 보내주세요.'
        : '보내지 못했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      setSending(false);
    }
  }

  function handleBackdrop(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div className="modal-overlay" onClick={handleBackdrop}>
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md max-h-[90dvh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex-shrink-0 px-6 pt-5 pb-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquareHeart size={17} className="text-leaf-600" />
            <h2 className="text-base font-bold text-gray-900 dark:text-white">의견 보내기</h2>
          </div>
          <button onClick={onClose} aria-label="닫기"
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
            <X size={17} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3">
          <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
            불편했던 점, 있었으면 하는 기능, 버그 등 무엇이든 편하게 적어주세요.
            보낸 내용은 운영자만 볼 수 있어요.
          </p>
          <textarea
            autoFocus
            value={content}
            onChange={e => setContent(e.target.value.slice(0, MAX_LENGTH))}
            rows={6}
            placeholder="예) 반복 일정을 격주 말고 3주마다도 할 수 있으면 좋겠어요"
            className="w-full px-3.5 py-2.5 rounded-lg bg-white dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 shadow-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-leaf-500/25 focus:border-leaf-500 text-sm resize-none transition-all"
          />
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-red-500">{error}</span>
            <span className="text-gray-400">{content.length}/{MAX_LENGTH}</span>
          </div>
        </div>

        <div className="flex-shrink-0 flex gap-2 px-6 pb-5">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-sm font-medium">
            취소
          </button>
          <button onClick={handleSend} disabled={!content.trim() || sending}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-leaf-600 hover:bg-leaf-700 disabled:opacity-40 text-white text-sm font-semibold">
            <Send size={14} />
            {sending ? '보내는 중...' : '보내기'}
          </button>
        </div>
      </div>
    </div>
  );
}
