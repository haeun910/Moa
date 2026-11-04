import { useEffect, useMemo, useRef, useState } from 'react';
import type React from 'react';
import { Search, X, Check, Minus, Repeat, CalendarClock, StickyNote, Archive, CornerDownLeft } from 'lucide-react';
import { format, parseISO, differenceInCalendarDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useApp } from '../context/AppContext';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { findMatch, search, snippet, matches, normalizeQuery } from '../lib/search';
import { closeSearch, openSearch, subscribeSearch } from '../lib/searchStore';
import { requestOpenNote } from '../lib/openNote';
import { timeRangeLabel } from '../lib/timeRange';
import { markdownToPlain, noteHeading } from '../lib/markdown';
import type { Note, ScheduleItem, Todo } from '../types';
import TodoModal from './TodoModal';
import ScheduleModal from './ScheduleModal';

// 한 묶음에 처음 보여줄 개수 (더 있으면 "더 보기")
const PAGE = 8;

type Hit =
  | { kind: 'todo'; item: Todo }
  | { kind: 'schedule'; item: ScheduleItem }
  | { kind: 'note'; item: Note };

// 검색어가 걸린 부분을 굵게
function Highlight({ text, query }: { text: string; query: string }) {
  const hit = findMatch(text, query);
  if (!hit) return <>{text}</>;
  return (
    <>
      {text.slice(0, hit[0])}
      <mark className="bg-transparent text-gray-900 dark:text-white font-bold underline decoration-gray-300 dark:decoration-gray-600 underline-offset-2">{text.slice(hit[0], hit[1])}</mark>
      {text.slice(hit[1])}
    </>
  );
}

function dayLabel(date: string, todayKey: string) {
  const diff = differenceInCalendarDays(parseISO(date), parseISO(todayKey));
  if (diff === 0) return '오늘';
  if (diff === 1) return '내일';
  if (diff === -1) return '어제';
  const sameYear = date.slice(0, 4) === todayKey.slice(0, 4);
  return format(parseISO(date), sameYear ? 'M월 d일 (EEE)' : 'yyyy년 M월 d일', { locale: ko });
}


// 어느 화면에서든 띄우는 검색 창 (Layout에 하나만 둠). Ctrl/⌘+K 로도 열림.
// 결과를 눌러 할 일·일정을 고치고 닫으면 검색 결과로 돌아옴
export default function SearchHost() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Hit | null>(null);
  useEffect(() => subscribeSearch(setOpen), []);

  // Ctrl+K / ⌘+K
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openSearch();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  if (!open) return null;
  if (editing?.kind === 'todo') return <TodoModal todo={editing.item} onClose={() => setEditing(null)} />;
  if (editing?.kind === 'schedule') return <ScheduleModal schedule={editing.item} onClose={() => setEditing(null)} />;
  return <SearchPanel query={query} setQuery={setQuery} onPick={setEditing} />;
}

function SearchPanel({ query, setQuery, onPick }: { query: string; setQuery: (q: string) => void; onPick: (hit: Hit) => void }) {
  const { todos, schedules, notes, categories, noteFolders, settings, setCurrentScreen } = useApp();
  useEscapeKey(closeSearch);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [expanded, setExpanded] = useState<Record<Hit['kind'], boolean>>({ todo: false, schedule: false, note: false });
  const todayKey = format(new Date(), 'yyyy-MM-dd');
  const notesHidden = settings.hiddenFeatures.includes('notes');

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const results = useMemo(
    () => search(query, { todos, schedules, notes: notesHidden ? [] : notes }, todayKey),
    [query, todos, schedules, notes, notesHidden, todayKey],
  );
  const groups: { kind: Hit['kind']; label: string; hits: Hit[] }[] = [
    { kind: 'todo' as const, label: '할 일', hits: results.todos.map(item => ({ kind: 'todo' as const, item })) },
    { kind: 'schedule' as const, label: '일정', hits: results.schedules.map(item => ({ kind: 'schedule' as const, item })) },
    { kind: 'note' as const, label: '메모', hits: results.notes.map(item => ({ kind: 'note' as const, item })) },
  ].filter(g => g.hits.length > 0);
  const shown = groups.map(g => ({ ...g, visible: expanded[g.kind] ? g.hits : g.hits.slice(0, PAGE) }));
  const flat = shown.flatMap(g => g.visible);
  const total = groups.reduce((n, g) => n + g.hits.length, 0);
  const q = normalizeQuery(query);

  // 검색어가 바뀌면 맨 위 결과부터
  useEffect(() => { setActive(0); setExpanded({ todo: false, schedule: false, note: false }); }, [query]);
  // 키보드로 고른 줄이 보이게 스크롤
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  function pick(hit: Hit) {
    if (hit.kind === 'note') {
      requestOpenNote(hit.item.id);
      closeSearch();
      setCurrentScreen('notes');
      return;
    }
    onPick(hit);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.nativeEvent.isComposing) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(flat.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(0, i - 1)); }
    else if (e.key === 'Enter' && flat[active]) { e.preventDefault(); pick(flat[active]); }
  }

  const category = (id: string | null) => categories.find(c => c.id === id);
  let index = -1;

  const renderTodo = (t: Todo, i: number) => {
    const cat = category(t.categoryId);
    const notesHit = !matches(t.title, q) && t.notes ? snippet(t.notes, query, 24) : null;
    return (
      <>
        <span className={`flex-shrink-0 mt-0.5 w-[18px] h-[18px] rounded-[6px] flex items-center justify-center ${
          t.completed ? 'bg-leaf-500 text-white' : t.skipped ? 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400' : 'border-[1.5px] border-gray-300 dark:border-gray-600'
        }`} aria-hidden>
          {t.completed ? <Check size={12} strokeWidth={3} /> : t.skipped ? <Minus size={12} strokeWidth={3} /> : null}
        </span>
        <span className="flex-1 min-w-0">
          <span className={`block text-14px leading-snug truncate ${t.completed || t.skipped ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-800 dark:text-gray-100'}`}>
            <Highlight text={t.title} query={query} />
          </span>
          {notesHit && <span className="block mt-0.5 text-12px text-gray-500 dark:text-gray-400 truncate"><Highlight text={notesHit} query={query} /></span>}
          <span className="flex items-center gap-1.5 mt-0.5 text-11.5px text-gray-500 dark:text-gray-400">
            {t.date ? (
              <span className={t.date < todayKey && !t.completed && !t.skipped ? 'text-amber-700 dark:text-amber-400' : ''}>{dayLabel(t.date, todayKey)}{t.startTime ? ` ${timeRangeLabel(t.startTime, t.endTime)}` : ''}</span>
            ) : (
              <span className="inline-flex items-center gap-0.5"><Archive size={10} />저장소</span>
            )}
            {cat && <><span className="text-gray-300 dark:text-gray-600">·</span><span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cat.color }} />{cat.name}</>}
            {t.seriesId && <><span className="text-gray-300 dark:text-gray-600">·</span><Repeat size={10} /></>}
            {t.skipped && <><span className="text-gray-300 dark:text-gray-600">·</span>안 함</>}
          </span>
        </span>
        {i === active && <CornerDownLeft size={13} className="hidden lg:block flex-shrink-0 mt-1 text-gray-400" aria-hidden />}
      </>
    );
  };

  const renderSchedule = (s: ScheduleItem, i: number) => (
    <>
      <CalendarClock size={16} className="flex-shrink-0 mt-0.5 text-gray-400" aria-hidden />
      <span className="flex-1 min-w-0">
        <span className={`block text-14px leading-snug truncate ${s.completed ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-800 dark:text-gray-100'}`}>
          <Highlight text={s.title} query={query} />
        </span>
        <span className="block mt-0.5 text-11.5px text-gray-500 dark:text-gray-400 truncate">
          {dayLabel(s.date, todayKey)}
          {s.endDate && s.endDate > s.date ? ` – ${dayLabel(s.endDate, todayKey)}` : ''}
          {s.startTime ? ` · ${timeRangeLabel(s.startTime, s.endTime)}` : ''}
          {s.seriesId ? ' · 반복' : ''}
        </span>
      </span>
      {i === active && <CornerDownLeft size={13} className="hidden lg:block flex-shrink-0 mt-1 text-gray-400" aria-hidden />}
    </>
  );

  const renderNote = (n: Note, i: number) => {
    const folder = noteFolders.find(f => f.id === n.folderId);
    const body = snippet(markdownToPlain(n.content), query, 30);
    return (
      <>
        <StickyNote size={16} className="flex-shrink-0 mt-0.5 text-gray-400" aria-hidden />
        <span className="flex-1 min-w-0">
          <span className="block text-14px leading-snug text-gray-800 dark:text-gray-100 truncate"><Highlight text={noteHeading(n)} query={query} /></span>
          {body && <span className="block mt-0.5 text-12px text-gray-500 dark:text-gray-400 line-clamp-2 break-words"><Highlight text={body} query={query} /></span>}
          {folder && <span className="block mt-0.5 text-11px text-gray-400 dark:text-gray-500 truncate">{folder.name}</span>}
        </span>
        {i === active && <CornerDownLeft size={13} className="hidden lg:block flex-shrink-0 mt-1 text-gray-400" aria-hidden />}
      </>
    );
  };

  return (
    <div className="fixed inset-0 z-[60] flex justify-center bg-gray-950/40 backdrop-blur-[3px] animate-fade-in sm:p-4 sm:pt-[10vh]"
      onClick={e => { if (e.target === e.currentTarget) closeSearch(); }}>
      <div role="dialog" aria-modal="true" aria-label="검색"
        className="w-full sm:max-w-xl h-full sm:h-auto sm:max-h-[75vh] flex flex-col bg-white dark:bg-gray-900 sm:rounded-2xl shadow-2xl ring-1 ring-gray-900/5 dark:ring-white/10 overflow-hidden pt-[env(safe-area-inset-top)] sm:pt-0">
        <div className="flex items-center gap-2 px-4 h-14 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
          <Search size={17} className="text-gray-400 flex-shrink-0" aria-hidden />
          <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} onKeyDown={onKeyDown}
            type="search" enterKeyHint="search" autoComplete="off" spellCheck={false}
            placeholder={notesHidden ? '할 일 · 일정 검색 (초성도 돼요: ㅂㄱㅅ)' : '할 일 · 일정 · 메모 검색 (초성도 돼요: ㅂㄱㅅ)'}
            aria-label="검색어" aria-controls="search-results" aria-activedescendant={flat[active] ? `search-hit-${active}` : undefined}
            className="flex-1 min-w-0 h-full bg-transparent text-15px text-gray-900 dark:text-white placeholder:text-gray-400 outline-none [&::-webkit-search-cancel-button]:hidden" />
          {query && (
            <button onClick={() => { setQuery(''); inputRef.current?.focus(); }} aria-label="검색어 지우기" className="btn-icon w-7 h-7"><X size={15} /></button>
          )}
          <button onClick={closeSearch} className="sm:hidden h-8 px-2 text-14px font-medium text-gray-600 dark:text-gray-300">닫기</button>
          <kbd className="hidden sm:inline-flex items-center h-5 px-1.5 rounded border border-gray-200 dark:border-gray-700 text-10px font-semibold text-gray-400">Esc</kbd>
        </div>

        <div ref={listRef} id="search-results" role="listbox" aria-label="검색 결과" className="flex-1 overflow-y-auto overscroll-contain px-2 py-2">
          {!q && (
            <div className="px-3 py-10 text-center">
              <p className="text-14px text-gray-500 dark:text-gray-400">찾을 말을 입력하세요</p>
              <p className="mt-1 text-12px text-gray-400 dark:text-gray-500">제목과 메모 내용에서 찾아요. 지난 일, 끝낸 일, 저장소의 일도 모두 찾아요</p>
            </div>
          )}
          {q && total === 0 && (
            <div className="px-3 py-10 text-center">
              <p className="text-14px text-gray-500 dark:text-gray-400">‘{query.trim()}’와(과) 맞는 결과가 없어요</p>
              <p className="mt-1 text-12px text-gray-400 dark:text-gray-500">다른 말이나 더 짧은 말로 찾아보세요</p>
            </div>
          )}
          {shown.map(g => (
            <section key={g.kind} className="mb-2 last:mb-0">
              <h3 className="flex items-center gap-1.5 px-3 pt-2 pb-1 text-11px font-semibold text-gray-500 dark:text-gray-400">
                {g.label}<span className="tabular-nums text-gray-400 dark:text-gray-500 font-medium">{g.hits.length}</span>
              </h3>
              {g.visible.map(hit => {
                index += 1;
                const i = index;
                return (
                  <button key={`${hit.kind}-${hit.item.id}`} id={`search-hit-${i}`} data-index={i} role="option" aria-selected={i === active}
                    onClick={() => pick(hit)} onMouseMove={() => { if (active !== i) setActive(i); }}
                    className={`w-full flex items-start gap-2.5 px-3 py-2.5 rounded-xl text-left transition-colors ${i === active ? 'bg-gray-100 dark:bg-gray-800' : ''}`}>
                    {hit.kind === 'todo' ? renderTodo(hit.item, i) : hit.kind === 'schedule' ? renderSchedule(hit.item, i) : renderNote(hit.item, i)}
                  </button>
                );
              })}
              {!expanded[g.kind] && g.hits.length > PAGE && (
                <button onClick={() => setExpanded(x => ({ ...x, [g.kind]: true }))}
                  className="w-full px-3 py-2 rounded-xl text-left text-12.5px font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/60">
                  {g.label} {g.hits.length - PAGE}개 더 보기
                </button>
              )}
            </section>
          ))}
        </div>

        <div className="hidden lg:flex items-center gap-3 px-4 h-9 border-t border-gray-100 dark:border-gray-800 text-11px text-gray-400 flex-shrink-0">
          <span><kbd className="font-sans font-semibold">↑↓</kbd> 이동</span>
          <span><kbd className="font-sans font-semibold">Enter</kbd> 열기</span>
          <span className="ml-auto">어디서든 <kbd className="font-sans font-semibold">{/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl'}+K</kbd> 로 검색</span>
        </div>
      </div>
    </div>
  );
}
