import { useState } from 'react';
import { X, Trash2 } from 'lucide-react';
import type { Note } from '../types';
import { useApp } from '../context/AppContext';

interface Props {
  note?: Note;
  onClose: () => void;
}

export default function NoteModal({ note, onClose }: Props) {
  const { addNote, updateNote, deleteNote } = useApp();
  const [title, setTitle] = useState(note?.title ?? '');
  const [content, setContent] = useState(note?.content ?? '');

  const isEdit = !!note;

  function handleSave() {
    if (!title.trim() && !content.trim()) return;
    if (isEdit) {
      updateNote(note.id, { title: title.trim(), content: content.trim() });
    } else {
      addNote(title.trim(), content.trim());
    }
    onClose();
  }

  function handleDelete() {
    if (note) {
      deleteNote(note.id);
      onClose();
    }
  }

  function handleBackdrop(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div
      className="modal-overlay"
      onClick={handleBackdrop}
    >
      <div className="modal-panel max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            {isEdit ? '메모 편집' : '새 메모'}
          </h2>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">제목</label>
            <input
              autoFocus
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="메모 제목"
              className="w-full px-3.5 py-2.5 rounded-lg bg-white dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 shadow-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-leaf-500/25 focus:border-leaf-500 transition text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">내용</label>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="내용을 입력하세요..."
              rows={10}
              className="w-full px-3.5 py-2.5 rounded-lg bg-white dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 shadow-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-leaf-500/25 focus:border-leaf-500 transition text-sm resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 flex gap-3">
          {isEdit && (
            <button
              onClick={handleDelete}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-red-500 border border-red-200 dark:border-red-900/40 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-sm font-medium"
            >
              <Trash2 size={15} />
              삭제
            </button>
          )}
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-sm font-medium"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={!title.trim() && !content.trim()}
            className="flex-1 py-2.5 rounded-lg bg-leaf-600 hover:bg-leaf-700 disabled:opacity-40 text-white transition-colors text-sm font-semibold"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}
