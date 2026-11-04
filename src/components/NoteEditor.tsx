import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type React from 'react';
import { flushSync } from 'react-dom';
import { ChevronLeft, Pin, PinOff, Trash2, Folder, Check, PenLine } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useApp } from '../context/AppContext';
import type { Note } from '../types';
import { LIMITS } from '../lib/limits';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { continueList, toggleTaskAt } from '../lib/markdown';
import MarkdownView from './MarkdownView';
import MarkdownToolbar, { handleFormatShortcut, insertText } from './MarkdownToolbar';

interface Props {
  note?: Note; // 없으면 새 메모 (처음 글자를 쓰는 순간 만들어짐)
  defaultFolderId: string | null; // 새 메모를 만들 폴더
  onCreated: (note: Note) => void;
  onClose?: () => void; // 휴대폰 전체 화면에서 "뒤로"
  onDeleted: () => void;
  fullscreen?: boolean;
}

const AUTOSAVE_DELAY = 600;

// 화면의 (x, y) 지점이 글자 사이 어디인지
function caretRangeAt(x: number, y: number): Range | null {
  const doc = document as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  };
  if (doc.caretPositionFromPoint) {
    const p = doc.caretPositionFromPoint(x, y);
    if (!p) return null;
    const r = document.createRange();
    r.setStart(p.offsetNode, p.offset);
    return r;
  }
  return doc.caretRangeFromPoint?.(x, y) ?? null;
}

// 보기 화면에서 누른 자리 → 원래 글(마크다운)에서의 위치. 꾸밈 기호 때문에 정확히 1:1은 아니라서
// 누른 자리 바로 앞 몇 글자를 원문에서 찾아 맞춤 (못 찾으면 그 문단 끝)
function sourceOffsetAt(el: HTMLElement, x: number, y: number, source: string): number {
  const start = Number(el.dataset.s);
  const end = Number(el.dataset.e);
  const slice = source.slice(start, end);
  const caret = caretRangeAt(x, y);
  if (!caret || !el.contains(caret.startContainer)) return end;
  const pre = document.createRange();
  pre.selectNodeContents(el);
  pre.setEnd(caret.startContainer, caret.startOffset);
  const typed = pre.toString();
  if (!typed) {
    const head = (el.textContent ?? '').slice(0, 8);
    const i = head ? slice.indexOf(head) : -1;
    return i < 0 ? start : start + i;
  }
  for (const n of [12, 6, 3, 1]) {
    if (typed.length < n && n !== 1) continue;
    const tail = typed.slice(-n);
    const i = slice.indexOf(tail, Math.max(0, typed.length - n));
    if (i >= 0) return start + i + tail.length;
  }
  return end;
}

// 입력칸 안에서 pos 번째 글자가 위에서 몇 px 아래에 있는지 (같은 모양의 보이지 않는 복사본으로 잼)
function caretTop(ta: HTMLTextAreaElement, pos: number): number {
  const cs = getComputedStyle(ta);
  const div = document.createElement('div');
  for (const prop of ['boxSizing', 'width', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth', 'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'wordSpacing', 'tabSize'] as const) {
    div.style[prop] = cs[prop];
  }
  Object.assign(div.style, { position: 'absolute', visibility: 'hidden', top: '0', left: '-9999px', whiteSpace: 'pre-wrap', overflowWrap: 'break-word' });
  div.textContent = ta.value.slice(0, pos);
  const mark = document.createElement('span');
  mark.textContent = '\u200b';
  div.appendChild(mark);
  document.body.appendChild(div);
  const top = mark.offsetTop;
  div.remove();
  return top;
}

// 메모 편집기: 쓰는 대로 자동 저장 (저장 버튼 없음). PC에서는 오른쪽 칸, 휴대폰에서는 전체 화면으로 사용
export default function NoteEditor({ note, defaultFolderId, onCreated, onClose, onDeleted, fullscreen }: Props) {
  const { noteFolders, addNote, updateNote, deleteNote } = useApp();
  const [title, setTitle] = useState(note?.title ?? '');
  const [content, setContent] = useState(note?.content ?? '');
  const [folderId, setFolderId] = useState<string | null>(note?.folderId ?? defaultFolderId);
  const [pinned, setPinned] = useState(note?.pinned ?? false);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [confirmDelete, setConfirmDelete] = useState(false);
  // 내용이 있는 메모는 꾸며진 모양(보기)으로 열고, 글을 누르면 그 자리에서 고치기 시작
  const [mode, setMode] = useState<'view' | 'edit'>(note?.content.trim() ? 'view' : 'edit');

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
  const scrollRef = useRef<HTMLDivElement>(null);
  // 폰 전체 화면 편집기는 Esc로 목록으로 돌아감 (컴퓨터의 오른쪽 칸은 창이 아니라서 그대로)
  useEscapeKey(() => onClose?.(), !!fullscreen && !!onClose);

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

  // 입력칸 높이를 글 길이에 맞춤 (입력칸 안에 따로 스크롤이 생기지 않고 화면 전체가 스크롤됨)
  useLayoutEffect(() => {
    const ta = contentRef.current;
    const box = scrollRef.current;
    if (!ta || mode !== 'edit') return;
    const keep = box?.scrollTop ?? 0;
    ta.style.height = '0px';
    ta.style.height = `${ta.scrollHeight}px`;
    if (box) box.scrollTop = keep;
  }, [content, mode]);
  useEffect(() => {
    function onResize() {
      const ta = contentRef.current;
      if (!ta) return;
      ta.style.height = '0px';
      ta.style.height = `${ta.scrollHeight}px`;
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // 목록 줄에서 줄을 바꾸면 다음 표시(- , 2. , - [ ] )를 자동으로 붙임. 빈 항목에서 한 번 더 누르면 목록 끝
  // (휴대폰 한글 키보드는 keydown으로 Enter를 알 수 없어서 beforeinput으로 받음)
  useEffect(() => {
    const ta = contentRef.current;
    if (!ta || mode !== 'edit') return;
    function onBeforeInput(e: InputEvent) {
      if (!ta || e.isComposing || (e.inputType !== 'insertLineBreak' && e.inputType !== 'insertParagraph')) return;
      if (ta.selectionStart !== ta.selectionEnd) return;
      const v = ta.value;
      const pos = ta.selectionStart;
      const lineStart = v.lastIndexOf('\n', pos - 1) + 1;
      let lineEnd = v.indexOf('\n', pos);
      if (lineEnd < 0) lineEnd = v.length;
      const result = continueList(v.slice(lineStart, pos), v.slice(pos, lineEnd));
      if (!result) return;
      e.preventDefault();
      if ('end' in result) {
        ta.setSelectionRange(lineStart, pos);
        insertText(ta, '');
      } else {
        insertText(ta, result.insert);
      }
    }
    ta.addEventListener('beforeinput', onBeforeInput);
    return () => ta.removeEventListener('beforeinput', onBeforeInput);
  }, [mode]);

  // 고치기 시작: 입력칸을 바로 그려서(폰에서 키보드가 뜨려면 누른 순간 포커스해야 함) 커서를 놓음
  function startEditing(offset: number, keepAtY?: number) {
    flushSync(() => setMode('edit'));
    const ta = contentRef.current;
    const box = scrollRef.current;
    if (!ta) return;
    ta.style.height = '0px';
    ta.style.height = `${ta.scrollHeight}px`;
    ta.focus({ preventScroll: true });
    ta.setSelectionRange(offset, offset);
    if (!box) return;
    const lineHeight = parseFloat(getComputedStyle(ta).lineHeight) || 24;
    const y = ta.getBoundingClientRect().top + caretTop(ta, offset);
    const boxRect = box.getBoundingClientRect();
    // 누른 줄이 손가락 아래 그대로 있게, 아니면(편집 버튼) 커서가 화면 가운데쯤 오게
    const want = keepAtY ?? boxRect.top + boxRect.height / 3;
    box.scrollTop += y - want + lineHeight / 2;
  }

  function editAtPoint(e: React.MouseEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement;
    if (target.closest('a, input, button, label, summary')) return;
    // 글을 길게 눌러 고르는 중(복사 등)이면 편집으로 바꾸지 않음
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed && sel.toString().trim()) return;
    const block = target.closest<HTMLElement>('[data-s]');
    const offset = block ? sourceOffsetAt(block, e.clientX, e.clientY, content) : content.length;
    startEditing(Math.min(offset, content.length), e.clientY);
  }

  function toggleTask(offset: number) {
    const next = toggleTaskAt(content, offset);
    if (next === content) return;
    setContent(next);
    scheduleSave();
  }

  function finishEditing() {
    contentRef.current?.blur();
    titleRef.current?.blur();
    setMode('view');
  }

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
    <div className={`flex flex-col h-full min-h-0 bg-white dark:bg-gray-900 ${fullscreen ? 'fixed inset-0 top-[var(--strip-h,0px)] z-50' : ''}`}>
      {/* 도구 줄 */}
      <div className="flex-shrink-0 flex items-center gap-2 px-3 sm:px-5 h-14 border-b border-gray-100 dark:border-gray-800">
        {onClose && (
          <button onClick={onClose} className="flex items-center gap-0.5 -ml-1 pr-2 text-sm font-medium text-gray-900 dark:text-white">
            <ChevronLeft size={20} /> 메모
          </button>
        )}
        <div className="relative flex items-center">
          <Folder size={14} className="absolute left-2.5 text-gray-400 pointer-events-none" />
          <select
            value={folderId ?? ''}
            onChange={e => changeFolder(e.target.value || null)}
            aria-label="폴더"
            className="pl-8 pr-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-xs font-medium text-gray-600 dark:text-gray-300 border-0 focus:outline-none focus:ring-2 focus:ring-gray-500/20 focus:border-gray-500 max-w-[140px] truncate cursor-pointer"
          >
            <option value="">폴더 없음</option>
            {noteFolders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
        <span className="flex-1 min-w-0 text-11px text-gray-400 truncate text-right sm:text-left">
          {status === 'saving' ? '저장 중...' : status === 'saved' ? <span className="inline-flex items-center gap-0.5"><Check size={11} />저장됨</span> : ''}
        </span>
        {mode === 'edit' ? (
          <button onClick={finishEditing} title="꾸며진 모양으로 보기"
            className="h-8 px-2.5 rounded-lg flex items-center gap-1 text-13px font-semibold text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <Check size={15} />완료
          </button>
        ) : (
          <button onClick={() => startEditing(content.length)} title="고치기"
            className="h-8 px-2.5 rounded-lg flex items-center gap-1 text-13px font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <PenLine size={15} />편집
          </button>
        )}
        <button onClick={togglePin} aria-label={pinned ? '고정 해제' : '맨 위에 고정'} title={pinned ? '고정 해제' : '맨 위에 고정'}
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${pinned ? 'text-gray-900 bg-gray-100 dark:text-white dark:bg-gray-800' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
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

      {/* 글 꾸미기 도구 (고치는 중에만) */}
      {mode === 'edit' && (
        <div className="flex-shrink-0 px-2 sm:px-4 border-b border-gray-100 dark:border-gray-800">
          <div className="max-w-3xl mx-auto"><MarkdownToolbar target={contentRef} /></div>
        </div>
      )}

      {/* 본문 */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
        <div className="max-w-3xl mx-auto px-5 sm:px-8 py-5 flex flex-col min-h-full">
          <p className="text-11px text-gray-400 dark:text-gray-500 text-center mb-3">{updatedLabel}</p>
          <input maxLength={LIMITS.title}
            ref={titleRef}
            value={title}
            onChange={e => { setTitle(e.target.value); scheduleSave(); }}
            onKeyDown={e => {
              if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
              e.preventDefault();
              if (mode === 'edit') contentRef.current?.focus();
              else startEditing(0);
            }}
            placeholder="제목"
            className="w-full bg-transparent text-xl sm:text-2xl font-bold text-gray-900 dark:text-white placeholder-gray-300 dark:placeholder-gray-600 focus:outline-none mb-3"
          />
          {mode === 'edit' ? (
            <textarea maxLength={LIMITS.noteContent}
              ref={contentRef}
              value={content}
              onChange={e => { setContent(e.target.value); scheduleSave(); }}
              onKeyDown={e => { handleFormatShortcut(e); }}
              placeholder={'내용을 입력하세요\n\n# 제목   - 목록   - [ ] 체크리스트   **굵게**\n주소를 붙여 넣으면 링크가 돼요'}
              aria-label="메모 내용"
              className="flex-1 w-full min-h-[50vh] bg-transparent text-15px leading-relaxed text-gray-800 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-600 focus:outline-none resize-none overflow-hidden"
            />
          ) : (
            // 보기: 글을 누르면 그 자리에서 고치기 시작 (링크·체크박스는 그대로 동작)
            <div onClick={editAtPoint} className="flex-1 min-h-[50vh] cursor-text pb-16">
              {content.trim()
                ? <MarkdownView source={content} onToggleTask={toggleTask} />
                : <p className="text-15px leading-relaxed text-gray-300 dark:text-gray-600">내용을 입력하세요</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
