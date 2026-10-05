import { useEffect, useMemo, useState } from 'react';
import { Plus, FileText, Search, Folder, FolderOpen, Inbox, Pin, Settings2, X } from 'lucide-react';
import { format, isToday, isThisYear } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useApp } from '../context/AppContext';
import NoteEditor from '../components/NoteEditor';
import NoteFolderModal from '../components/NoteFolderModal';
import type { Note } from '../types';

// 'all' = 전체 메모, 'none' = 폴더 없음, 그 외 = 폴더 id
type FolderFilter = 'all' | 'none' | string;

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

function shortDate(iso: string) {
  const d = new Date(iso);
  if (isToday(d)) return format(d, 'a h:mm', { locale: ko });
  if (isThisYear(d)) return format(d, 'M월 d일', { locale: ko });
  return format(d, 'yyyy. M. d.');
}

// 제목이 없으면 내용 첫 줄을 제목처럼 보여줌
function noteHeading(n: Note) {
  return n.title.trim() || n.content.trim().split('\n')[0] || '새 메모';
}
function notePreview(n: Note) {
  const body = n.title.trim() ? n.content : n.content.split('\n').slice(1).join(' ');
  return body.replace(/\s+/g, ' ').trim();
}

export default function NotesPage() {
  const { notes, noteFolders } = useApp();
  // PC(넓은 화면): 폴더 | 목록 | 편집기 3칸 / 휴대폰: 목록 → 누르면 전체 화면 편집기
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [folder, setFolder] = useState<FolderFilter>('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // 편집기를 다시 만들지 결정하는 키 (새 메모가 저장돼 id가 생겨도 편집기가 새로 뜨지 않게 따로 관리)
  const [editorKey, setEditorKey] = useState<string | null>(null);
  const [newCount, setNewCount] = useState(0);
  const [showFolderModal, setShowFolderModal] = useState(false);

  // 지워진 폴더를 보고 있었다면 전체로
  useEffect(() => {
    if (folder !== 'all' && folder !== 'none' && !noteFolders.some(f => f.id === folder)) setFolder('all');
  }, [folder, noteFolders]);

  const q = query.trim().toLowerCase();
  const visible = useMemo(() => notes
    .filter(n => folder === 'all' || (folder === 'none' ? !n.folderId : n.folderId === folder))
    .filter(n => !q || n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt)),
  [notes, folder, q]);
  const pinnedNotes = visible.filter(n => n.pinned);
  const otherNotes = visible.filter(n => !n.pinned);

  const folderName = (id: string | null) => noteFolders.find(f => f.id === id)?.name ?? null;
  const currentLabel = folder === 'all' ? '전체 메모' : folder === 'none' ? '폴더 없음' : folderName(folder) ?? '전체 메모';
  const countIn = (f: FolderFilter) => f === 'all' ? notes.length : notes.filter(n => (f === 'none' ? !n.folderId : n.folderId === f)).length;

  const selectedNote = selectedId ? notes.find(n => n.id === selectedId) : undefined;
  const isNew = !!editorKey?.startsWith('new-') && !selectedNote;
  const activeNote = selectedNote;
  const activeKey = editorKey;
  const editorOpen = !!editorKey && (isNew || !!selectedNote);

  // PC에서는 아무것도 안 골랐으면(처음 열었을 때, 폴더를 바꿨을 때, 메모를 지웠을 때) 목록 첫 메모를 열어둠
  const firstVisibleId = visible[0]?.id ?? null;
  useEffect(() => {
    if (!isDesktop || editorOpen || !firstVisibleId) return;
    setSelectedId(firstVisibleId);
    setEditorKey(firstVisibleId);
  }, [isDesktop, editorOpen, firstVisibleId]);

  function openNote(n: Note) { setSelectedId(n.id); setEditorKey(n.id); }
  function newNote() {
    const key = `new-${newCount}`;
    setNewCount(c => c + 1);
    setSelectedId(null);
    setEditorKey(key);
  }
  function closeEditor() { setSelectedId(null); setEditorKey(null); }

  const defaultFolderId = folder !== 'all' && folder !== 'none' ? folder : null;

  const editor = editorOpen && activeKey ? (
    <NoteEditor
      key={activeKey}
      note={activeNote}
      defaultFolderId={defaultFolderId}
      onCreated={n => setSelectedId(n.id)}
      onDeleted={closeEditor}
      onClose={isDesktop ? undefined : closeEditor}
      fullscreen={!isDesktop}
    />
  ) : null;

  // ── 목록 한 줄 ──
  const renderItem = (n: Note) => {
    const on = isDesktop && activeNote?.id === n.id;
    const preview = notePreview(n);
    return (
      <li key={n.id}>
        <button onClick={() => openNote(n)}
          className={`w-full text-left px-4 py-3 rounded-xl transition-colors ${on ? 'bg-leaf-50 dark:bg-leaf-900/25 ring-1 ring-inset ring-leaf-200/80 dark:ring-leaf-800/50' : 'hover:bg-gray-100/80 dark:hover:bg-gray-800/50'}`}>
          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{noteHeading(n)}</p>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 truncate">
            <span className="text-gray-700 dark:text-gray-300 mr-1.5 tabular-nums">{shortDate(n.updatedAt)}</span>
            {preview || '추가 텍스트 없음'}
          </p>
          {folder === 'all' && n.folderId && (
            <p className="mt-1 flex items-center gap-1 text-[11px] text-gray-400"><Folder size={11} />{folderName(n.folderId)}</p>
          )}
        </button>
      </li>
    );
  };

  const list = (
    visible.length === 0 ? (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
        <div className="w-14 h-14 rounded-2xl surface flex items-center justify-center mb-3">
          <FileText size={24} className="text-gray-400" />
        </div>
        <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">{q ? '검색 결과가 없어요' : '메모가 없어요'}</p>
        {!q && <p className="text-xs text-gray-400 mt-1">새 메모를 작성해보세요</p>}
      </div>
    ) : (
      <div className="space-y-4">
        {pinnedNotes.length > 0 && (
          <div>
            <p className="flex items-center gap-1 px-4 mb-1 text-xs font-semibold text-gray-500 dark:text-gray-400"><Pin size={11} /> 고정됨</p>
            <ul className="space-y-0.5">{pinnedNotes.map(renderItem)}</ul>
          </div>
        )}
        {otherNotes.length > 0 && (
          <div>
            {pinnedNotes.length > 0 && <p className="px-4 mb-1 text-xs font-semibold text-gray-500 dark:text-gray-400">메모</p>}
            <ul className="space-y-0.5">{otherNotes.map(renderItem)}</ul>
          </div>
        )}
      </div>
    )
  );

  const searchBox = (
    <div className="relative">
      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
      <input value={query} onChange={e => setQuery(e.target.value)} placeholder="검색"
        className="w-full h-9 pl-9 pr-8 bg-white dark:bg-gray-900 ring-1 ring-gray-200 dark:ring-gray-800 rounded-lg text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-leaf-500/25 focus:border-leaf-500 transition-shadow" />
      {query && (
        <button onClick={() => setQuery('')} aria-label="검색어 지우기" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400"><X size={14} /></button>
      )}
    </div>
  );

  // ── PC: 폴더 | 목록 | 편집기 ──
  if (isDesktop) {
    const folderRow = (f: FolderFilter, label: string, Icon: typeof Folder, iconClass: string) => {
      const on = folder === f;
      return (
        <li key={f}>
          <button onClick={() => { setFolder(f); setSelectedId(null); setEditorKey(null); }}
            className={`w-full flex items-center gap-2.5 px-3 h-9 rounded-lg text-sm transition-colors ${
              on ? 'bg-white dark:bg-gray-900 shadow-card text-gray-900 dark:text-white font-semibold' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/60 font-medium'
            }`}>
            <Icon size={16} className={`flex-shrink-0 ${iconClass}`} />
            <span className="flex-1 min-w-0 truncate text-left">{label}</span>
            <span className="text-xs tabular-nums text-gray-400">{countIn(f)}</span>
          </button>
        </li>
      );
    };
    return (
      <div className="h-screen flex bg-gray-50 dark:bg-gray-950">
        {/* 폴더 */}
        <aside className="w-56 flex-shrink-0 border-r border-gray-200/70 dark:border-gray-800 flex flex-col">
          <div className="px-5 pt-8 pb-4">
            <h1 className="page-title">메모</h1>
          </div>
          <nav className="flex-1 overflow-y-auto px-3 space-y-4">
            <ul className="space-y-0.5">
              {folderRow('all', '전체 메모', FolderOpen, 'text-leaf-600 dark:text-leaf-400')}
              {folderRow('none', '폴더 없음', Inbox, 'text-gray-400')}
            </ul>
            <div>
              <p className="px-3 mb-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400">폴더</p>
              <ul className="space-y-0.5">
                {noteFolders.map(f => folderRow(f.id, f.name, Folder, 'text-leaf-600 dark:text-leaf-400'))}
              </ul>
            </div>
          </nav>
          <div className="p-3 border-t border-gray-200/70 dark:border-gray-800">
            <button onClick={() => setShowFolderModal(true)}
              className="btn-secondary w-full h-9">
              <Settings2 size={15} /> 폴더 추가 · 관리
            </button>
          </div>
        </aside>

        {/* 목록 */}
        <section className="w-80 xl:w-96 flex-shrink-0 border-r border-gray-200/70 dark:border-gray-800 flex flex-col bg-white/70 dark:bg-gray-900/40">
          <div className="px-4 pt-8 pb-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <h2 className="text-base font-bold tracking-[-0.02em] text-gray-900 dark:text-white truncate">{currentLabel}</h2>
                <p className="text-xs tabular-nums text-gray-500 dark:text-gray-400">{visible.length}개의 메모</p>
              </div>
              <button onClick={newNote} aria-label="새 메모" title="새 메모"
                className="btn-primary w-9 h-9 flex-shrink-0">
                <Plus size={18} strokeWidth={2.5} />
              </button>
            </div>
            {searchBox}
          </div>
          <div className="flex-1 overflow-y-auto px-2 pb-6">{list}</div>
        </section>

        {/* 편집기 */}
        <div className="flex-1 min-w-0">
          {editor ?? (
            <div className="h-full flex flex-col items-center justify-center text-center text-gray-400">
              <FileText size={30} className="mb-3 text-gray-300 dark:text-gray-700" />
              <p className="text-sm">메모를 고르거나 새로 만들어보세요</p>
            </div>
          )}
        </div>

        {showFolderModal && <NoteFolderModal onClose={() => setShowFolderModal(false)} />}
      </div>
    );
  }

  // ── 휴대폰·태블릿: 폴더 칩 + 목록, 누르면 전체 화면 편집기 ──
  const chip = (f: FolderFilter, label: string) => (
    <button key={f} onClick={() => setFolder(f)}
      className={`flex-shrink-0 flex items-center gap-1 h-8 px-3 rounded-full text-[13px] font-semibold border transition-colors ${
        folder === f ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-transparent' : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 font-medium'
      }`}>
      {label}<span className="opacity-60">{countIn(f)}</span>
    </button>
  );

  return (
    <div className="px-4 pt-8 sm:pt-10 pb-40 max-w-2xl mx-auto">
      <div className="flex items-end justify-between mb-4">
        <div>
          <h1 className="page-title">메모</h1>
          <p className="page-subtitle">{currentLabel} · {visible.length}개</p>
        </div>
      </div>
      <div className="mb-3">{searchBox}</div>
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-1 mb-3">
        {chip('all', '전체')}
        {noteFolders.map(f => chip(f.id, f.name))}
        {chip('none', '폴더 없음')}
        <button onClick={() => setShowFolderModal(true)}
          className="flex-shrink-0 flex items-center gap-1 h-8 px-3 rounded-full text-[13px] font-medium border border-dashed border-gray-300 dark:border-gray-600 text-gray-500">
          <Settings2 size={12} /> 폴더
        </button>
      </div>
      <div className="rounded-xl surface p-1.5">{list}</div>

      <button onClick={newNote} aria-label="새 메모"
        className="fixed bottom-[78px] right-5 w-14 h-14 rounded-2xl btn-primary shadow-lg shadow-leaf-900/20">
        <Plus size={24} strokeWidth={2.5} />
      </button>

      {editor}
      {showFolderModal && <NoteFolderModal onClose={() => setShowFolderModal(false)} />}
    </div>
  );
}
