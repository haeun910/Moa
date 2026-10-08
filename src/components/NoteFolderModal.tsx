import { useState } from 'react';
import { X, FolderPlus, Folder, Pencil, Trash2, Check } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { LIMITS } from '../lib/limits';

// 메모 폴더 관리: 추가 / 이름 바꾸기 / 삭제 (삭제해도 메모는 "폴더 없음"으로 남음)
export default function NoteFolderModal({ onClose }: { onClose: () => void }) {
  const { noteFolders, notes, addNoteFolder, renameNoteFolder, deleteNoteFolder } = useApp();
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [confirmId, setConfirmId] = useState<string | null>(null);

  async function handleAdd() {
    const name = newName.trim().slice(0, 50);
    if (!name) return;
    try { await addNoteFolder(name); setNewName(''); } catch { /* 알림은 공통 처리 */ }
  }

  function saveRename() {
    const name = editName.trim().slice(0, 50);
    if (editingId && name) renameNoteFolder(editingId, name);
    setEditingId(null);
  }

  function handleBackdrop(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div className="modal-overlay" onClick={handleBackdrop}>
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm max-h-[85dvh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex-shrink-0 px-5 pt-5 pb-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900 dark:text-white">폴더 관리</h2>
          <button onClick={onClose} aria-label="닫기" className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
            <X size={17} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {noteFolders.length === 0 && <p className="text-sm text-gray-400 text-center py-6">아직 폴더가 없어요</p>}
          {noteFolders.map(f => {
            const count = notes.filter(n => n.folderId === f.id).length;
            return (
              <div key={f.id} className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <Folder size={16} className="flex-shrink-0 text-amber-500" />
                {editingId === f.id ? (
                  <>
                    <input maxLength={LIMITS.folderName} autoFocus value={editName} onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) saveRename(); if (e.key === 'Escape') setEditingId(null); }}
                      className="flex-1 min-w-0 px-2 py-1 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-leaf-500/25 focus:border-leaf-500" />
                    <button onClick={saveRename} aria-label="이름 저장" className="w-7 h-7 rounded-lg bg-leaf-600 text-white flex items-center justify-center"><Check size={14} /></button>
                  </>
                ) : confirmId === f.id ? (
                  <>
                    <span className="flex-1 min-w-0 text-xs text-gray-500 dark:text-gray-400">
                      삭제할까요? 메모 {count}개는 "폴더 없음"으로 옮겨져요
                    </span>
                    <button onClick={() => setConfirmId(null)} className="px-2 py-1 rounded-lg text-xs text-gray-500 bg-gray-100 dark:bg-gray-800">취소</button>
                    <button onClick={() => { deleteNoteFolder(f.id); setConfirmId(null); }} className="px-2 py-1 rounded-lg text-xs font-semibold text-white bg-red-500">삭제</button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 min-w-0 text-sm text-gray-800 dark:text-gray-100 truncate">{f.name}</span>
                    <span className="text-xs text-gray-400">{count}</span>
                    <button onClick={() => { setEditingId(f.id); setEditName(f.name); }} aria-label={`${f.name} 이름 바꾸기`}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"><Pencil size={13} /></button>
                    <button onClick={() => setConfirmId(f.id)} aria-label={`${f.name} 삭제`}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 size={13} /></button>
                  </>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex-shrink-0 p-3 border-t border-gray-100 dark:border-gray-800 flex items-center gap-2">
          <FolderPlus size={16} className="flex-shrink-0 text-gray-400 ml-2" />
          <input maxLength={LIMITS.folderName} value={newName} onChange={e => setNewName(e.target.value)} placeholder="새 폴더 이름"
            onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleAdd(); }}
            className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-white dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 shadow-sm text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-leaf-500/25 focus:border-leaf-500" />
          <button onClick={handleAdd} disabled={!newName.trim()}
            className="px-3 py-2 rounded-xl bg-leaf-600 hover:bg-leaf-700 disabled:opacity-40 text-white text-sm font-semibold">추가</button>
        </div>
      </div>
    </div>
  );
}
