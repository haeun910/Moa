import { useState } from 'react';
import { Plus, NotebookPen, Search } from 'lucide-react';
import { format, isThisYear } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useApp } from '../context/AppContext';
import NoteModal from '../components/NoteModal';
import type { Note } from '../types';

function noteDate(iso: string) {
  const d = new Date(iso);
  return format(d, isThisYear(d) ? 'M월 d일' : 'yyyy년 M월 d일', { locale: ko });
}

export default function NotesPage() {
  const { notes } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [editNote, setEditNote] = useState<Note | undefined>();
  const [query, setQuery] = useState('');

  function openEdit(note: Note) { setEditNote(note); setShowModal(true); }
  function openNew() { setEditNote(undefined); setShowModal(true); }
  function closeModal() { setShowModal(false); setEditNote(undefined); }

  const filtered = query.trim()
    ? notes.filter(n =>
        n.title.toLowerCase().includes(query.toLowerCase()) ||
        n.content.toLowerCase().includes(query.toLowerCase())
      )
    : notes;

  return (
    <div className="px-4 lg:px-8 pt-8 sm:pt-10 pb-28 max-w-4xl mx-auto">
      {/* Header */}
      <header className="flex items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="page-title">메모</h1>
          <p className="page-subtitle">{notes.length}개의 메모</p>
        </div>
        <button onClick={openNew} className="hidden lg:inline-flex btn-primary h-9 px-3.5">
          <Plus size={16} strokeWidth={2.4} />
          새 메모
        </button>
      </header>

      {/* Search */}
      {notes.length > 0 && (
        <div className="relative mb-6">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="제목이나 내용으로 검색"
            className="w-full h-10 pl-10 pr-4 bg-white dark:bg-gray-900 ring-1 ring-gray-200 dark:ring-gray-800 rounded-xl text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-leaf-500 transition-shadow"
          />
        </div>
      )}

      {notes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-14 h-14 rounded-2xl bg-white dark:bg-gray-900 shadow-card flex items-center justify-center mb-4">
            <NotebookPen size={24} className="text-gray-400" />
          </div>
          <p className="text-gray-700 dark:text-gray-200 font-semibold">아직 메모가 없어요</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-5">회의 내용, 아이디어, 읽을거리를 적어두세요</p>
          <button onClick={openNew} className="btn-primary h-9 px-4">
            <Plus size={16} strokeWidth={2.4} />
            첫 메모 쓰기
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-gray-600 dark:text-gray-300 font-medium">‘{query}’에 맞는 메모가 없어요</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">다른 단어로 검색해 보세요</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((note) => (
            <button
              key={note.id}
              onClick={() => openEdit(note)}
              className="group text-left rounded-xl surface p-4 flex flex-col min-h-[132px] hover:shadow-md hover:-translate-y-px transition-all duration-150"
            >
              <h3 className="font-semibold text-[15px] tracking-[-0.015em] text-gray-900 dark:text-white truncate mb-1.5">
                {note.title || '제목 없음'}
              </h3>
              <p className="text-[13px] text-gray-600 dark:text-gray-400 line-clamp-4 leading-relaxed whitespace-pre-line flex-1">
                {note.content || '내용 없음'}
              </p>
              <p className="text-[11px] tabular-nums text-gray-400 dark:text-gray-500 mt-3">
                {noteDate(note.updatedAt)}
              </p>
            </button>
          ))}
        </div>
      )}

      {/* 모바일 추가 버튼 */}
      <button
        onClick={openNew}
        aria-label="새 메모"
        className="lg:hidden fixed bottom-[78px] right-5 w-14 h-14 rounded-2xl btn-primary shadow-lg shadow-leaf-900/20"
      >
        <Plus size={24} strokeWidth={2.4} />
      </button>

      {showModal && <NoteModal note={editNote} onClose={closeModal} />}
    </div>
  );
}
