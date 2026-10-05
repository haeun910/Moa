import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, Pin, PinOff, Trash2, Folder, Check } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useApp } from '../context/AppContext';
import type { Note } from '../types';

interface Props {
  note?: Note; // 없으면 새 메모 (처음 글자를 쓰는 순간 만들어짐)
  defaultFolderId: string | null; // 새 메모를 만들 폴더
  onCreated: (note: Note) => void;
  onClose?: () => void; // 휴대폰 전체 화면에서 "뒤로"
  onDeleted: () => void;
  fullscreen?: boolean;
}

const AUTOSAVE_DELAY = 600;

// 메모 편집기: 쓰는 대로 자동 저장 (저장 버튼 없음). PC에서는 오른쪽 칸, 휴대폰에서는 전체 화면으로 사용
export default function NoteEditor({ note, defaultFolderId, onCreated, onClose, onDeleted, fullscreen }: Props) {
  const { noteFolders, addNote, updateNote, deleteNote } = useApp();
  const [title, setTitle] = useState(note?.title ?? '');
  const [content, setContent] = useState(note?.content ?? '');
  const [folderId, setFolderId] = useState<string | null>(note?.folderId ?? defaultFolderId);
  const [pinned, setPinned] = useState(note?.pinned ?? false);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [confirmDelete, setConfirmDelete] = useState(false);

  // 비동기 저장 중에도 최신 값을 읽기 위한 ref
  const idRef = useRef<string | null>(note?.id ?? null);
  const latest = useRef({ title, content, folderId, pinned });
  latest.current = { title, content, folderId, pinned };
  const dirtyRef = useRef(false);
  const editedRef = useRef(false); // 이번에 열어서 실제로 고쳤는지 (안 고친 메모는 닫을 때 건드리지 않음)
  const creatingRef = useRef<Promise<void> | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);

  // 새 메모는 제목부터 바로 쓸 수 있게
  useEffect(() => { if (!note) titleRef.current?.focus(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    if (!dirtyRef.current) return;
    const { title: t, content: c, folderId: f, pinned: p } = latest.current;
    // 새 메모인데 아직 아무것도 안 썼으면 만들지 않음
    if (!idRef.current && !t.trim() && !c.trim()) return;
    dirtyRef.current = false;
    setStatus('saving');
    try {
      if (!idRef.current) {
        // 만드는 도중 또 저장이 불리면 중복 생성되지 않도록 기다렸다가 수정으로 처리
        if (creatingRef.current) { await creatingRef.current; dirtyRef.current = true; return save(); }
        creatingRef.current = (async () => {
          const created = await addNote(t, c, f);
          if (created) {
            idRef.current = created.id;
            if (p) await updateNote(created.id, { pinned: true });
            onCreated(created);
          }
        })();
        await creatingRef.current;
        creatingRef.current = null;
      } else {
        await updateNote(idRef.current, { title: t, content: c });
      }
      setStatus('saved');
    } catch {
      // 실패 알림은 공통 처리(AppContext)에서 띄움. 다음 입력 때 다시 저장 시도
      dirtyRef.current = true;
      setStatus('idle');
    }
  }

  function scheduleSave() {
    dirtyRef.current = true;
    editedRef.current = true;
    setStatus('idle');
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(save, AUTOSAVE_DELAY);
  }

  // 다른 메모로 넘어가거나 닫을 때: 남은 변경은 바로 저장, 내용을 다 지운 메모는 삭제
  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const { title: t, content: c } = latest.current;
    if (idRef.current && editedRef.current && !t.trim() && !c.trim()) { deleteNote(idRef.current); return; }
    save();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function changeFolder(next: string | null) {
    setFolderId(next);
    if (idRef.current) updateNote(idRef.current, { folderId: next });
  }

  function togglePin() {
    const next = !pinned;
    setPinned(next);
    if (idRef.current) updateNote(idRef.current, { pinned: next });
  }

  function handleDelete() {
    if (timerRef.current) clearTimeout(timerRef.current);
    dirtyRef.current = false;
    if (idRef.current) deleteNote(idRef.current);
    idRef.current = null;
    latest.current = { ...latest.current, title: '', content: '' };
    onDeleted();
  }

  const updatedLabel = note ? format(new Date(note.updatedAt), 'yyyy년 M월 d일 a h:mm', { locale: ko }) : '새 메모';

  return (
    <div className={`flex flex-col h-full min-h-0 bg-white dark:bg-gray-900 ${fullscreen ? 'fixed inset-0 z-50' : ''}`}>
      {/* 도구 줄 */}
      <div className="flex-shrink-0 flex items-center gap-2 px-3 sm:px-5 h-14 border-b border-gray-100 dark:border-gray-800">
        {onClose && (
          <button onClick={onClose} className="flex items-center gap-0.5 -ml-1 pr-2 text-sm font-medium text-leaf-600 dark:text-leaf-400">
            <ChevronLeft size={20} /> 메모
          </button>
        )}
        <div className="relative flex items-center">
          <Folder size={14} className="absolute left-2.5 text-gray-400 pointer-events-none" />
          <select
            value={folderId ?? ''}
            onChange={e => changeFolder(e.target.value || null)}
            aria-label="폴더"
            className="pl-8 pr-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-xs font-medium text-gray-600 dark:text-gray-300 border-0 focus:outline-none focus:ring-2 focus:ring-leaf-500/25 focus:border-leaf-500 max-w-[140px] truncate cursor-pointer"
          >
            <option value="">폴더 없음</option>
            {noteFolders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
        <span className="flex-1 min-w-0 text-[11px] text-gray-400 truncate text-right sm:text-left">
          {status === 'saving' ? '저장 중...' : status === 'saved' ? <span className="inline-flex items-center gap-0.5"><Check size={11} />저장됨</span> : ''}
        </span>
        <button onClick={togglePin} aria-label={pinned ? '고정 해제' : '맨 위에 고정'} title={pinned ? '고정 해제' : '맨 위에 고정'}
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${pinned ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/20' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
          {pinned ? <PinOff size={16} /> : <Pin size={16} />}
        </button>
        {confirmDelete ? (
          <div className="flex items-center gap-1">
            <button onClick={() => setConfirmDelete(false)} className="px-2 py-1.5 rounded-lg text-xs text-gray-500 bg-gray-100 dark:bg-gray-800">취소</button>
            <button onClick={handleDelete} className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-red-500">삭제</button>
          </div>
        ) : (
          <button onClick={() => setConfirmDelete(true)} aria-label="메모 삭제" title="메모 삭제"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
            <Trash2 size={16} />
          </button>
        )}
      </div>

      {/* 본문 */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-5 sm:px-8 py-5 flex flex-col min-h-full">
          <p className="text-[11px] text-gray-400 dark:text-gray-500 text-center mb-3">{updatedLabel}</p>
          <input
            ref={titleRef}
            value={title}
            onChange={e => { setTitle(e.target.value); scheduleSave(); }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); contentRef.current?.focus(); } }}
            placeholder="제목"
            className="w-full bg-transparent text-xl sm:text-2xl font-bold text-gray-900 dark:text-white placeholder-gray-300 dark:placeholder-gray-600 focus:outline-none mb-3"
          />
          <textarea
            ref={contentRef}
            value={content}
            onChange={e => { setContent(e.target.value); scheduleSave(); }}
            placeholder="내용을 입력하세요"
            className="flex-1 w-full min-h-[50vh] bg-transparent text-[15px] leading-relaxed text-gray-800 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-600 focus:outline-none resize-none"
          />
        </div>
      </div>
    </div>
  );
}
