import { useState } from 'react';
import { X, Plus, Pencil, Trash2, Megaphone } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useApp } from '../context/AppContext';
import type { Notice } from '../types';

export default function NoticeModal({ onClose }: { onClose: () => void }) {
  const { notices, isAdmin, addNotice, updateNotice, deleteNotice } = useApp();
  const [editing, setEditing] = useState<Notice | 'new' | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function openNew() { setEditing('new'); setTitle(''); setContent(''); }
  function openEdit(n: Notice) { setEditing(n); setTitle(n.title); setContent(n.content); }
  function cancelEdit() { setEditing(null); setTitle(''); setContent(''); }

  async function handleSave() {
    if (!title.trim() || !content.trim() || saving) return;
    setSaving(true);
    try {
      if (editing === 'new') await addNotice(title.trim(), content.trim());
      else if (editing) await updateNotice(editing.id, { title: title.trim(), content: content.trim() });
      cancelEdit();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (confirmDeleteId !== id) { setConfirmDeleteId(id); return; }
    await deleteNotice(id);
    setConfirmDeleteId(null);
  }

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
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-gray-100 dark:border-gray-800 flex-shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Megaphone size={18} className="text-leaf-600" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">공지사항</h2>
          </div>
          <div className="flex items-center gap-1.5">
            {isAdmin && editing === null && (
              <button onClick={openNew} aria-label="공지 작성"
                className="w-8 h-8 rounded-full bg-leaf-600 hover:bg-leaf-700 text-white flex items-center justify-center transition-colors">
                <Plus size={16} />
              </button>
            )}
            <button onClick={onClose} aria-label="닫기"
              className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {editing !== null ? (
            <div className="space-y-3">
              <input
                autoFocus
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="제목"
                className="w-full px-3.5 py-2.5 rounded-lg bg-white dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 shadow-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-leaf-500/25 focus:border-leaf-500 text-sm font-semibold transition-all"
              />
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="내용을 입력하세요"
                rows={6}
                className="w-full px-3.5 py-2.5 rounded-lg bg-white dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 shadow-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-leaf-500/25 focus:border-leaf-500 text-sm transition-all resize-none"
              />
              <div className="flex gap-2">
                <button onClick={cancelEdit}
                  className="flex-1 py-2.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-sm font-medium transition-colors">
                  취소
                </button>
                <button onClick={handleSave} disabled={!title.trim() || !content.trim() || saving}
                  className="flex-1 py-2.5 rounded-lg bg-leaf-600 hover:bg-leaf-700 disabled:opacity-40 text-white text-sm font-semibold transition-colors">
                  {saving ? '저장 중...' : '게시'}
                </button>
              </div>
            </div>
          ) : notices.length === 0 ? (
            <div className="text-center py-12">
              <Megaphone size={28} className="text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-sm text-gray-400 dark:text-gray-500">아직 등록된 공지가 없어요</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notices.map(n => (
                <div key={n.id} className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/40 p-4">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 flex-1">{n.title}</h3>
                    {isAdmin && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => openEdit(n)} aria-label="공지 편집"
                          className="text-gray-400 hover:text-leaf-600 transition-colors p-1">
                          <Pencil size={13} />
                        </button>
                        {confirmDeleteId === n.id ? (
                          <button onClick={() => handleDelete(n.id)}
                            className="text-[11px] px-2 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium">확인</button>
                        ) : (
                          <button onClick={() => handleDelete(n.id)} aria-label="공지 삭제"
                            className="text-gray-400 hover:text-red-500 transition-colors p-1">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-wrap">{n.content}</p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-2">
                    {format(new Date(n.createdAt), 'yyyy년 M월 d일', { locale: ko })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
