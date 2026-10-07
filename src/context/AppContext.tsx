import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase, ADMIN_USER_ID } from '../lib/supabase';
import type { DbTodo, DbCategory, DbSubcategory, DbNote, DbNoteFolder, DbSettings, DbMonthlyGoal, DbDDay, DbSchedule, DbTimeBlock, DbNotice } from '../lib/supabase';
import * as db from '../lib/db';
import { useAuth } from './AuthContext';
import { format, parseISO, startOfWeek, subWeeks } from 'date-fns';
import { newSeriesId } from '../lib/recurrence';
import { showSaveError, markSaveErrorHandled } from '../lib/toast';
import type { Todo, Category, Subcategory, Note, NoteFolder, Settings, Screen, MonthlyGoal, DDay, ScheduleItem, TimeBlock, Notice } from '../types';

// ── DB 행 → 앱 타입 변환 ──────────────────────────────────
function toTodo(t: DbTodo): Todo {
  return {
    id: t.id,
    title: t.title,
    completed: t.completed,
    categoryId: t.category_id,
    subcategoryId: t.subcategory_id,
    date: t.date,
    dueDate: t.due_date,
    isDday: t.is_dday,
    startTime: t.start_time,
    notes: t.notes ?? '',
    createdAt: t.created_at,
    seriesId: t.series_id ?? null,
  };
}

function toCategory(c: DbCategory): Category {
  return { id: c.id, name: c.name, color: c.color, description: c.description, isDefault: c.is_default };
}

function toSubcategory(s: DbSubcategory): Subcategory {
  return { id: s.id, categoryId: s.category_id, name: s.name, notes: s.notes };
}

function toNote(n: DbNote): Note {
  return { id: n.id, title: n.title, content: n.content, folderId: n.folder_id ?? null, pinned: n.pinned ?? false, createdAt: n.created_at, updatedAt: n.updated_at };
}

function toNoteFolder(f: DbNoteFolder): NoteFolder {
  return { id: f.id, name: f.name };
}

function toMonthlyGoal(g: DbMonthlyGoal): MonthlyGoal {
  return { id: g.id, month: g.month, title: g.title, completed: g.completed };
}

function toDDay(d: DbDDay): DDay {
  return { id: d.id, title: d.title, targetDate: d.target_date };
}

function toSchedule(s: DbSchedule): ScheduleItem {
  return { id: s.id, title: s.title, date: s.date, startTime: s.start_time, notes: s.notes, createdAt: s.created_at, seriesId: s.series_id ?? null };
}

function toTimeBlock(b: DbTimeBlock): TimeBlock {
  return {
    id: b.id, title: b.title, todoId: b.todo_id, color: b.color, startAt: b.start_at, endAt: b.end_at,
    completed: b.completed, remindMinutes: b.remind_minutes, createdAt: b.created_at,
  };
}

function sortTimeBlocks(list: TimeBlock[]): TimeBlock[] {
  return [...list].sort((a, b) => a.startAt.localeCompare(b.startAt));
}

// 알림을 누르고 들어오면 ?screen=timebox 로 열림 → 그 화면부터 보여줌
function screenFromUrl(): Screen | null {
  const screen = new URLSearchParams(window.location.search).get('screen');
  return screen === 'timebox' ? 'timebox' : null;
}

export type TimeBlockFields = Omit<TimeBlock, 'id' | 'createdAt'>;

function toNotice(n: DbNotice): Notice {
  return { id: n.id, title: n.title, content: n.content, createdAt: n.created_at, updatedAt: n.updated_at };
}

function toSettings(s: DbSettings): Settings {
  return {
    theme: s.theme,
    defaultScreen: s.default_screen,
    notifications: s.notifications,
    listSortBy: s.list_sort_by,
    hideCompleted: s.hide_completed,
    hiddenCategoryIds: s.hidden_category_ids ?? [],
    calendarTextSize: s.calendar_text_size ?? 'medium',
  };
}

// ── Context 타입 ──────────────────────────────────────────
interface AppContextType {
  todos: Todo[];
  categories: Category[];
  subcategories: Subcategory[];
  notes: Note[];
  noteFolders: NoteFolder[];
  settings: Settings;
  monthlyGoals: MonthlyGoal[];
  ddays: DDay[];
  schedules: ScheduleItem[];
  timeblocks: TimeBlock[];
  notices: Notice[];
  isAdmin: boolean;
  currentScreen: Screen;
  selectedDate: string;
  dataLoading: boolean;
  loadError: boolean; // 처음 불러오기 실패
  retryLoad: () => void;
  // 만든 할 일을 돌려줌 (타임박스에서 새 할 일을 만들고 바로 블록에 연결하려면 id가 필요)
  addTodo: (fields: Omit<Todo, 'id' | 'createdAt'>) => Promise<Todo | undefined>;
  // existingId가 있으면 그 할 일(이미 있는 항목)도 같은 반복으로 묶음. dates는 새로 만들 날짜만 (기존 항목 날짜 제외)
  addTodoSeries: (fields: Omit<Todo, 'id' | 'createdAt' | 'date' | 'seriesId'>, dates: string[], existingId?: string) => Promise<void>;
  updateTodoSeries: (seriesId: string, fromDate: string | null, updates: TodoSeriesUpdates) => Promise<void>;
  deleteTodoSeries: (seriesId: string, fromDate: string | null) => Promise<void>;
  updateTodo: (id: string, updates: Partial<Omit<Todo, 'id' | 'createdAt'>>) => Promise<void>;
  deleteTodo: (id: string) => Promise<void>;
  toggleTodo: (id: string) => Promise<void>;
  reorderTodos: (orderedIds: string[]) => Promise<void>;
  addCategory: (name: string, color: string, description?: string) => Promise<void>;
  updateCategory: (id: string, updates: { name?: string; color?: string; description?: string | null }) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  reorderCategories: (orderedIds: string[]) => Promise<void>;
  addSubcategory: (categoryId: string, name: string) => Promise<void>;
  updateSubcategory: (id: string, updates: { name?: string; notes?: string | null }) => Promise<void>;
  deleteSubcategory: (id: string) => Promise<void>;
  reorderSubcategories: (orderedIds: string[]) => Promise<void>;
  // 만든 메모를 돌려줌 (메모 편집기에서 새 메모를 만든 뒤 이어서 자동 저장하려면 id가 필요)
  addNote: (title: string, content: string, folderId?: string | null) => Promise<Note | undefined>;
  updateNote: (id: string, updates: NoteUpdates) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  addNoteFolder: (name: string) => Promise<NoteFolder | undefined>;
  renameNoteFolder: (id: string, name: string) => Promise<void>;
  deleteNoteFolder: (id: string) => Promise<void>;
  updateSettings: (updates: Partial<Settings>) => Promise<void>;
  addMonthlyGoal: (month: string, title: string) => Promise<void>;
  updateMonthlyGoal: (id: string, updates: { title?: string }) => Promise<void>;
  toggleMonthlyGoal: (id: string) => Promise<void>;
  deleteMonthlyGoal: (id: string) => Promise<void>;
  addDDay: (title: string, targetDate: string) => Promise<void>;
  updateDDay: (id: string, updates: { title?: string; targetDate?: string }) => Promise<void>;
  deleteDDay: (id: string) => Promise<void>;
  addSchedule: (fields: { title: string; date: string; startTime?: string | null; notes?: string | null }) => Promise<void>;
  updateSchedule: (id: string, updates: { title?: string; date?: string; startTime?: string | null; notes?: string | null }) => Promise<void>;
  deleteSchedule: (id: string) => Promise<void>;
  addScheduleSeries: (fields: { title: string; startTime?: string | null; notes?: string | null }, dates: string[], existingId?: string) => Promise<void>;
  updateScheduleSeries: (seriesId: string, fromDate: string | null, updates: { title?: string; startTime?: string | null; notes?: string | null }) => Promise<void>;
  deleteScheduleSeries: (seriesId: string, fromDate: string | null) => Promise<void>;
  addTimeBlock: (fields: Omit<TimeBlockFields, 'completed'> & { completed?: boolean }) => Promise<TimeBlock | null | undefined>;
  updateTimeBlock: (id: string, updates: Partial<TimeBlockFields>) => Promise<void>;
  deleteTimeBlock: (id: string) => Promise<void>;
  toggleTimeBlock: (id: string) => Promise<void>;
  ensureTimeBlocksFrom: (dateKey: string) => Promise<void>;
  addNotice: (title: string, content: string) => Promise<void>;
  updateNotice: (id: string, updates: { title?: string; content?: string }) => Promise<void>;
  deleteNotice: (id: string) => Promise<void>;
  setCurrentScreen: (screen: Screen) => void;
  setSelectedDate: (date: string) => void;
}

// 반복 할 일 묶음 수정 시 함께 바꿀 수 있는 항목 (날짜/완료/마감일은 회차마다 다르므로 제외)
export type NoteUpdates = Partial<Pick<Note, 'title' | 'content' | 'folderId' | 'pinned'>>;

export type TodoSeriesUpdates = Partial<Pick<Todo, 'title' | 'categoryId' | 'subcategoryId' | 'startTime' | 'notes'>>;

// fromDate가 있으면 그 날짜(포함) 이후 회차만, 없으면 반복 전체 (DB 쿼리와 같은 기준)
function inSeries(item: { seriesId?: string | null; date: string | null }, seriesId: string, fromDate: string | null): boolean {
  if (item.seriesId !== seriesId) return false;
  return fromDate ? !!item.date && item.date >= fromDate : true;
}

// 서버에서 다시 불러올 수 있는 데이터 종류
type Resource = 'todos' | 'categories' | 'subcategories' | 'notes' | 'noteFolders' | 'settings' | 'monthlyGoals' | 'ddays' | 'schedules' | 'timeblocks' | 'notices';

// 실시간 동기화 대상 테이블 → 다시 불러올 데이터 종류 (notices는 모든 사용자 공용이라 따로 처리)
const REALTIME_TABLES: [string, Resource][] = [
  ['todos', 'todos'],
  ['categories', 'categories'],
  ['subcategories', 'subcategories'],
  ['notes', 'notes'],
  ['note_folders', 'noteFolders'],
  ['monthly_goals', 'monthlyGoals'],
  ['ddays', 'ddays'],
  ['schedules', 'schedules'],
  ['timeblocks', 'timeblocks'],
  ['user_settings', 'settings'],
];

const AppContext = createContext<AppContextType | null>(null);

const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  defaultScreen: 'today',
  notifications: false,
  listSortBy: 'manual',
  hideCompleted: false,
  hiddenCategoryIds: [],
  calendarTextSize: 'medium',
};

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  const [todos, setTodos] = useState<Todo[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteFolders, setNoteFolders] = useState<NoteFolder[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [monthlyGoals, setMonthlyGoals] = useState<MonthlyGoal[]>([]);
  const [ddays, setDDays] = useState<DDay[]>([]);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [timeblocks, setTimeblocks] = useState<TimeBlock[]>([]);
  // 타임박스는 매일 쌓이므로 이 시각 이후 것만 불러와 둠. 더 예전 주를 보면 그때 더 불러옴(ensureTimeBlocksFrom)
  const timeblocksFromRef = useRef<Date>(startOfWeek(subWeeks(new Date(), 2)));
  const [notices, setNotices] = useState<Notice[]>([]);
  const isAdmin = user?.id === ADMIN_USER_ID;
  const [currentScreen, setCurrentScreen] = useState<Screen>('today');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dataLoading, setDataLoading] = useState(true);
  // 처음 불러오기가 실패하면(네트워크 등) 빈 화면 대신 "다시 시도" 화면을 보여주기 위함
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const retryLoad = useCallback(() => setReloadKey(k => k + 1), []);

  const channelRef = useRef<RealtimeChannel | null>(null);

  // ── 서버에서 다시 불러오기 (여러 기기 동기화 / 저장 실패 시 원상복구에 공통 사용) ──
  // 화면은 저장 전에 먼저 바뀌므로(낙관적 업데이트), 저장이 실패하면 서버 내용으로 다시 맞춤
  const fetchersRef = useRef<Record<Resource, () => Promise<void>> | null>(null);
  fetchersRef.current = user ? {
    todos: async () => setTodos((await db.fetchTodos(user.id)).map(toTodo)),
    categories: async () => setCategories((await db.fetchCategories(user.id)).map(toCategory)),
    subcategories: async () => setSubcategories((await db.fetchSubcategories(user.id)).map(toSubcategory)),
    notes: async () => setNotes((await db.fetchNotes(user.id)).map(toNote)),
    noteFolders: async () => setNoteFolders((await db.fetchNoteFolders(user.id)).map(toNoteFolder)),
    settings: async () => { const s = await db.fetchSettings(user.id); if (s) setSettings(toSettings(s)); },
    monthlyGoals: async () => setMonthlyGoals((await db.fetchMonthlyGoals(user.id)).map(toMonthlyGoal)),
    ddays: async () => setDDays((await db.fetchDDays(user.id)).map(toDDay)),
    schedules: async () => setSchedules((await db.fetchSchedules(user.id)).map(toSchedule)),
    timeblocks: async () => setTimeblocks(sortTimeBlocks((await db.fetchTimeBlocks(user.id, timeblocksFromRef.current.toISOString())).map(toTimeBlock))),
    notices: async () => setNotices((await db.fetchNotices()).map(toNotice)),
  } : null;

  // 같은 종류를 짧은 시간에 여러 번 요청하면 한 번만 불러옴
  // (예: 반복으로 한 번에 100개를 만들면 실시간 알림도 100번 오기 때문)
  const resyncTimersRef = useRef<Partial<Record<Resource, ReturnType<typeof setTimeout>>>>({});
  const resync = useCallback((kind: Resource, delayMs = 300) => {
    clearTimeout(resyncTimersRef.current[kind]);
    resyncTimersRef.current[kind] = setTimeout(() => {
      fetchersRef.current?.[kind]().catch(err => console.error(`resync ${kind} failed`, err));
    }, delayMs);
  }, []);
  const resyncAll = useCallback(() => {
    for (const kind of Object.keys(fetchersRef.current ?? {}) as Resource[]) resync(kind, 0);
  }, [resync]);

  // 실시간 "삭제" 알림은 user_id로 거를 수 없어서(Supabase 제약) 내 화면에 있는 id인지로 판단
  const localIdsRef = useRef<Partial<Record<Resource, { id: string }[]>>>({});
  localIdsRef.current = { todos, categories, subcategories, notes, noteFolders, monthlyGoals, ddays, schedules, timeblocks, notices };
  // 앱 진입 시 defaultScreen으로 딱 한 번만 이동하기 위한 플래그.
  // (예전엔 user 객체 참조가 바뀔 때마다(토큰 자동 갱신 등) 이 효과가 다시 돌면서
  //  사용자가 어느 화면에 있든 자꾸 홈 화면으로 튕기는 버그가 있었음)
  const didSetInitialScreenRef = useRef(false);

  // ── 초기 데이터 로드 ────────────────────────────────────
  useEffect(() => {
    if (!user) {
      setTodos([]); setCategories([]); setSubcategories([]); setNotes([]); setNoteFolders([]);
      setSettings(DEFAULT_SETTINGS); setMonthlyGoals([]); setDDays([]); setSchedules([]); setTimeblocks([]); setNotices([]);
      setDataLoading(false);
      didSetInitialScreenRef.current = false;
      return;
    }

    setDataLoading(true);
    setLoadError(false);
    Promise.all([
      db.fetchTodos(user.id),
      db.fetchCategories(user.id),
      db.fetchSubcategories(user.id),
      db.fetchNotes(user.id),
      db.fetchSettings(user.id),
      db.fetchMonthlyGoals(user.id),
      db.fetchDDays(user.id),
      db.fetchSchedules(user.id).catch(() => []), // schedules 테이블이 아직 없어도(마이그레이션 전) 나머지는 정상 로드되도록
      db.fetchNotices().catch(() => []), // notices 테이블이 아직 없어도(마이그레이션 전) 나머지는 정상 로드되도록
      db.fetchNoteFolders(user.id).catch(() => []), // note_folders 테이블이 아직 없어도(014 전) 나머지는 정상 로드되도록
      db.fetchTimeBlocks(user.id, timeblocksFromRef.current.toISOString()).catch(() => []), // timeblocks 테이블이 아직 없어도(016 전) 나머지는 정상 로드되도록
    ]).then(([rawTodos, rawCats, rawSubcats, rawNotes, rawSettings, rawGoals, rawDDays, rawSchedules, rawNotices, rawNoteFolders, rawTimeBlocks]) => {
      setTodos(rawTodos.map(toTodo));
      setCategories(rawCats.map(toCategory));
      setSubcategories(rawSubcats.map(toSubcategory));
      setNotes(rawNotes.map(toNote));
      setNoteFolders(rawNoteFolders.map(toNoteFolder));
      setMonthlyGoals(rawGoals.map(toMonthlyGoal));
      setDDays(rawDDays.map(toDDay));
      setSchedules(rawSchedules.map(toSchedule));
      setNotices(rawNotices.map(toNotice));
      setTimeblocks(sortTimeBlocks(rawTimeBlocks.map(toTimeBlock)));
      const urlScreen = screenFromUrl();
      if (urlScreen) {
        window.history.replaceState(null, '', window.location.pathname);
        setCurrentScreen(urlScreen);
        didSetInitialScreenRef.current = true;
      }
      if (rawSettings) {
        const s = toSettings(rawSettings);
        setSettings(s);
        if (!didSetInitialScreenRef.current) {
          setCurrentScreen(s.defaultScreen as Screen);
          didSetInitialScreenRef.current = true;
        }
      }
    }).catch(err => {
      // 예전엔 실패해도 그냥 빈 화면이 떠서 "데이터가 사라졌다"고 오해할 수 있었음
      console.error('initial load failed', err);
      setLoadError(true);
    }).finally(() => setDataLoading(false));
    // user.id만 의존성으로 둬서, 토큰 자동 갱신처럼 user "객체"만 새로 생성되고
    // 실제 로그인 계정은 그대로인 경우에는 이 무거운 재조회 + 화면 이동이 일어나지 않게 함
    // (reloadKey는 "다시 시도" 버튼용)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, reloadKey]);

  // ── 테마 적용 ───────────────────────────────────────────
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'dark') root.classList.add('dark');
    else if (settings.theme === 'light') root.classList.remove('dark');
    else {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) root.classList.add('dark');
      else root.classList.remove('dark');
    }
  }, [settings.theme]);

  // ── 이미 열린 앱에서 알림을 누르면 서비스워커가 보내는 메시지로 화면 이동 ──
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    function handleMessage(e: MessageEvent) {
      if (e.data?.type === 'moa:navigate' && e.data.screen === 'timebox') setCurrentScreen('timebox');
    }
    navigator.serviceWorker.addEventListener('message', handleMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleMessage);
  }, []);

  // ── Realtime 구독 ────────────────────────────────────────
  useEffect(() => {
    if (!user) {
      channelRef.current?.unsubscribe();
      return;
    }

    // 다른 기기(폰 ↔ PC)에서 바꾼 내용을 바로 반영. 모든 데이터 종류를 구독함.
    let channel = supabase.channel(`user-${user.id}`);
    for (const [table, kind] of REALTIME_TABLES) {
      // 추가/수정: 내 데이터만 오도록 user_id로 거름
      channel = channel
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table, filter: `user_id=eq.${user.id}` }, () => resync(kind))
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table, filter: `user_id=eq.${user.id}` }, () => resync(kind))
        // 삭제: Supabase는 삭제 알림을 user_id로 거르지 못해서, 지워진 id가 내 화면에 있을 때만 다시 불러옴
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table }, payload => {
          const id = (payload.old as { id?: string } | null)?.id;
          if (id && localIdsRef.current[kind]?.some(item => item.id === id)) resync(kind);
        });
    }
    channel = channel.on('postgres_changes', { event: '*', schema: 'public', table: 'notices' }, () => resync('notices'));

    // 연결이 끊겼다가 다시 붙으면(폰 잠금 해제, 네트워크 전환 등) 그 사이 놓친 변경을 전부 다시 불러옴
    let subscribedOnce = false;
    channel.subscribe(status => {
      if (status !== 'SUBSCRIBED') return;
      if (subscribedOnce) resyncAll();
      subscribedOnce = true;
    });

    channelRef.current = channel;
    return () => { channel.unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // 앱으로 다시 돌아오거나(백그라운드 → 화면 켜짐) 인터넷이 다시 연결되면 최신 내용으로 맞춤.
  // 모바일은 백그라운드에서 실시간 연결이 끊기는 경우가 많아서 이게 없으면 다른 기기 변경이 늦게 보임
  useEffect(() => {
    if (!user) return;
    let lastSync = Date.now();
    const syncIfStale = () => {
      if (Date.now() - lastSync < 5000) return; // 너무 자주 불러오지 않도록
      lastSync = Date.now();
      resyncAll();
    };
    const onVisible = () => { if (document.visibilityState === 'visible') syncIfStale(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', syncIfStale);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', syncIfStale);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // ── Todos ────────────────────────────────────────────────
  const addTodo = useCallback(async (fields: Omit<Todo, 'id' | 'createdAt'>) => {
    if (!user) return;
    const row = await db.createTodo(user.id, {
      title: fields.title,
      completed: fields.completed,
      category_id: fields.categoryId,
      subcategory_id: fields.subcategoryId ?? null,
      date: fields.date,
      due_date: fields.dueDate ?? null,
      is_dday: fields.isDday ?? false,
      start_time: fields.startTime ?? null,
      notes: fields.notes,
      // 새 항목은 항상 맨 끝에 오도록 sort_order를 명시적으로 지정.
      // (지정하지 않으면 DB 기본값 0이 겹쳐서 "입력 순서가 제멋대로" 보이는 문제가 있었음)
      sort_order: todos.length,
    });
    const todo = toTodo(row);
    setTodos(prev => [...prev, todo]);
    return todo;
  }, [user, todos.length]);

  // 반복 할 일: 각 날짜마다 독립된 할 일을 한 번에 만들고 같은 seriesId로 묶음
  const addTodoSeries = useCallback(async (fields: Omit<Todo, 'id' | 'createdAt' | 'date' | 'seriesId'>, dates: string[], existingId?: string) => {
    if (!user) return;
    const seriesId = newSeriesId();
    if (existingId) {
      // dates에는 기존 항목 날짜를 빼고 넘겨야 함 (호출하는 쪽에서 방금 바꾼 날짜를 알고 있으므로)
      await db.setSeriesId('todos', existingId, seriesId);
      setTodos(prev => prev.map(t => t.id === existingId ? { ...t, seriesId } : t));
    }
    if (dates.length === 0) return;
    const rows = await db.createTodos(user.id, dates.map((date, i) => ({
      title: fields.title,
      completed: fields.completed,
      category_id: fields.categoryId,
      subcategory_id: fields.subcategoryId ?? null,
      date,
      due_date: fields.dueDate ?? null,
      is_dday: fields.isDday ?? false,
      start_time: fields.startTime ?? null,
      notes: fields.notes,
      sort_order: todos.length + i,
    })), seriesId);
    setTodos(prev => [...prev, ...rows.map(toTodo)]);
  }, [user, todos.length]);

  const updateTodoSeries = useCallback(async (seriesId: string, fromDate: string | null, updates: TodoSeriesUpdates) => {
    const dbUpdates: Parameters<typeof db.updateTodoSeries>[2] = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if ('categoryId' in updates) dbUpdates.category_id = updates.categoryId ?? null;
    if ('subcategoryId' in updates) dbUpdates.subcategory_id = updates.subcategoryId ?? null;
    if ('startTime' in updates) dbUpdates.start_time = updates.startTime ?? null;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
    setTodos(prev => prev.map(t => inSeries(t, seriesId, fromDate) ? { ...t, ...updates } : t));
    await db.updateTodoSeries(seriesId, fromDate, dbUpdates);
  }, []);

  const deleteTodoSeries = useCallback(async (seriesId: string, fromDate: string | null) => {
    setTodos(prev => prev.filter(t => !inSeries(t, seriesId, fromDate)));
    await db.deleteTodoSeries(seriesId, fromDate);
  }, []);

  const updateTodo = useCallback(async (id: string, updates: Partial<Omit<Todo, 'id' | 'createdAt'>>) => {
    if (!user) return;
    const dbUpdates: Parameters<typeof db.updateTodo>[1] = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.completed !== undefined) dbUpdates.completed = updates.completed;
    if ('categoryId' in updates) dbUpdates.category_id = updates.categoryId ?? null;
    if ('subcategoryId' in updates) dbUpdates.subcategory_id = updates.subcategoryId ?? null;
    if ('date' in updates) dbUpdates.date = updates.date ?? null;
    if ('dueDate' in updates) dbUpdates.due_date = updates.dueDate ?? null;
    if (updates.isDday !== undefined) dbUpdates.is_dday = updates.isDday;
    if ('startTime' in updates) dbUpdates.start_time = updates.startTime ?? null;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;

    setTodos(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    await db.updateTodo(id, dbUpdates);
  }, [user]);

  const deleteTodo = useCallback(async (id: string) => {
    setTodos(prev => prev.filter(t => t.id !== id));
    await db.deleteTodo(id);
  }, []);

  const toggleTodo = useCallback(async (id: string) => {
    setTodos(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
    const todo = todos.find(t => t.id === id);
    if (todo) await db.updateTodo(id, { completed: !todo.completed });
  }, [todos]);

  const reorderTodos = useCallback(async (orderedIds: string[]) => {
    setTodos(prev => {
      const map = new Map(prev.map(t => [t.id, t]));
      const reordered = orderedIds.map(id => map.get(id)!).filter(Boolean);
      const rest = prev.filter(t => !orderedIds.includes(t.id));
      return [...reordered, ...rest];
    });
    await Promise.all(orderedIds.map((id, i) => db.updateTodo(id, { sort_order: i })));
  }, []);

  // ── Categories ───────────────────────────────────────────
  const addCategory = useCallback(async (name: string, color: string, description?: string) => {
    if (!user) return;
    const row = await db.createCategory(user.id, name, color, categories.length, description ?? null);
    setCategories(prev => [...prev, toCategory(row)]);
  }, [user, categories.length]);

  const updateCategory = useCallback(async (id: string, updates: { name?: string; color?: string; description?: string | null }) => {
    setCategories(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    await db.updateCategory(id, updates);
  }, []);

  const deleteCategory = useCallback(async (id: string) => {
    setCategories(prev => prev.filter(c => c.id !== id));
    const removedSubcatIds = new Set(subcategories.filter(s => s.categoryId === id).map(s => s.id));
    setSubcategories(prev => prev.filter(s => s.categoryId !== id));
    setTodos(prev => prev.map(t => {
      if (t.categoryId === id) return { ...t, categoryId: null, subcategoryId: null };
      if (t.subcategoryId && removedSubcatIds.has(t.subcategoryId)) return { ...t, subcategoryId: null };
      return t;
    }));
    await db.deleteCategory(id); // 하위카테고리는 DB에서 category 삭제 시 cascade로 함께 정리됨
  }, [subcategories]);

  const reorderCategories = useCallback(async (orderedIds: string[]) => {
    setCategories(prev => {
      const map = new Map(prev.map(c => [c.id, c]));
      return orderedIds.map(id => map.get(id)!).filter(Boolean);
    });
    await Promise.all(orderedIds.map((id, i) => db.updateCategory(id, { sort_order: i })));
  }, []);

  // ── Subcategories (카테고리 하위 그룹) ──────────────────────
  const addSubcategory = useCallback(async (categoryId: string, name: string) => {
    if (!user) return;
    const sortOrder = subcategories.filter(s => s.categoryId === categoryId).length;
    const row = await db.createSubcategory(user.id, categoryId, name, sortOrder);
    setSubcategories(prev => [...prev, toSubcategory(row)]);
  }, [user, subcategories]);

  const updateSubcategory = useCallback(async (id: string, updates: { name?: string; notes?: string | null }) => {
    setSubcategories(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
    await db.updateSubcategory(id, updates);
  }, []);

  const deleteSubcategory = useCallback(async (id: string) => {
    setSubcategories(prev => prev.filter(s => s.id !== id));
    setTodos(prev => prev.map(t => t.subcategoryId === id ? { ...t, subcategoryId: null } : t));
    await db.deleteSubcategory(id);
  }, []);

  const reorderSubcategories = useCallback(async (orderedIds: string[]) => {
    setSubcategories(prev => {
      const map = new Map(prev.map(s => [s.id, s]));
      const reordered = orderedIds.map(id => map.get(id)!).filter(Boolean);
      const rest = prev.filter(s => !orderedIds.includes(s.id));
      return [...reordered, ...rest];
    });
    await Promise.all(orderedIds.map((id, i) => db.updateSubcategory(id, { sort_order: i })));
  }, []);

  // ── Notes ────────────────────────────────────────────────
  const addNote = useCallback(async (title: string, content: string, folderId: string | null = null): Promise<Note | undefined> => {
    if (!user) return undefined;
    const note = toNote(await db.createNote(user.id, title, content, folderId));
    setNotes(prev => [note, ...prev]);
    return note;
  }, [user]);

  const updateNote = useCallback(async (id: string, updates: NoteUpdates) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, ...updates, updatedAt: new Date().toISOString() } : n));
    const dbUpdates: Parameters<typeof db.updateNote>[1] = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.content !== undefined) dbUpdates.content = updates.content;
    if ('folderId' in updates) dbUpdates.folder_id = updates.folderId ?? null;
    if (updates.pinned !== undefined) dbUpdates.pinned = updates.pinned;
    await db.updateNote(id, dbUpdates);
  }, []);

  const deleteNote = useCallback(async (id: string) => {
    setNotes(prev => prev.filter(n => n.id !== id));
    await db.deleteNote(id);
  }, []);

  // ── 메모 폴더 ─────────────────────────────────────
  const addNoteFolder = useCallback(async (name: string): Promise<NoteFolder | undefined> => {
    if (!user) return undefined;
    const folder = toNoteFolder(await db.createNoteFolder(user.id, name, noteFolders.length));
    setNoteFolders(prev => [...prev, folder]);
    return folder;
  }, [user, noteFolders.length]);

  const renameNoteFolder = useCallback(async (id: string, name: string) => {
    setNoteFolders(prev => prev.map(f => f.id === id ? { ...f, name } : f));
    await db.updateNoteFolder(id, { name });
  }, []);

  // 폴더를 지워도 안의 메모는 남고 "폴더 없음"으로 이동 (DB도 on delete set null)
  const deleteNoteFolder = useCallback(async (id: string) => {
    setNoteFolders(prev => prev.filter(f => f.id !== id));
    setNotes(prev => prev.map(n => n.folderId === id ? { ...n, folderId: null } : n));
    await db.deleteNoteFolder(id);
  }, []);

  // ── Monthly Goals ────────────────────────────────
  const addMonthlyGoal = useCallback(async (month: string, title: string) => {
    if (!user) return;
    const row = await db.createMonthlyGoal(user.id, month, title);
    setMonthlyGoals(prev => [...prev, toMonthlyGoal(row)]);
  }, [user]);

  const updateMonthlyGoal = useCallback(async (id: string, updates: { title?: string }) => {
    setMonthlyGoals(prev => prev.map(g => g.id === id ? { ...g, ...updates } : g));
    await db.updateMonthlyGoal(id, updates);
  }, []);

  const toggleMonthlyGoal = useCallback(async (id: string) => {
    setMonthlyGoals(prev => prev.map(g => g.id === id ? { ...g, completed: !g.completed } : g));
    const goal = monthlyGoals.find(g => g.id === id);
    if (goal) await db.updateMonthlyGoal(id, { completed: !goal.completed });
  }, [monthlyGoals]);

  const deleteMonthlyGoal = useCallback(async (id: string) => {
    setMonthlyGoals(prev => prev.filter(g => g.id !== id));
    await db.deleteMonthlyGoal(id);
  }, []);

  // ── D-Days ───────────────────────────────────────
  const addDDay = useCallback(async (title: string, targetDate: string) => {
    if (!user) return;
    const row = await db.createDDay(user.id, title, targetDate);
    setDDays(prev => [...prev, toDDay(row)].sort((a, b) => a.targetDate.localeCompare(b.targetDate)));
  }, [user]);

  const updateDDay = useCallback(async (id: string, updates: { title?: string; targetDate?: string }) => {
    setDDays(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d).sort((a, b) => a.targetDate.localeCompare(b.targetDate)));
    const dbUpdates: Parameters<typeof db.updateDDay>[1] = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.targetDate !== undefined) dbUpdates.target_date = updates.targetDate;
    await db.updateDDay(id, dbUpdates);
  }, []);

  const deleteDDay = useCallback(async (id: string) => {
    setDDays(prev => prev.filter(d => d.id !== id));
    await db.deleteDDay(id);
  }, []);

  // ── 일정 (날짜/시간이 정해진 이벤트 - 할 일과 별개) ───────────
  function sortSchedules(list: ScheduleItem[]): ScheduleItem[] {
    return [...list].sort((a, b) => a.date.localeCompare(b.date) || (a.startTime ?? '99:99').localeCompare(b.startTime ?? '99:99'));
  }

  const addSchedule = useCallback(async (fields: { title: string; date: string; startTime?: string | null; notes?: string | null }) => {
    if (!user) return;
    const row = await db.createSchedule(user.id, { title: fields.title, date: fields.date, start_time: fields.startTime ?? null, notes: fields.notes ?? null });
    setSchedules(prev => sortSchedules([...prev, toSchedule(row)]));
  }, [user]);

  const updateSchedule = useCallback(async (id: string, updates: { title?: string; date?: string; startTime?: string | null; notes?: string | null }) => {
    setSchedules(prev => sortSchedules(prev.map(s => s.id === id ? { ...s, ...updates } : s)));
    const dbUpdates: Parameters<typeof db.updateSchedule>[1] = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.date !== undefined) dbUpdates.date = updates.date;
    if ('startTime' in updates) dbUpdates.start_time = updates.startTime ?? null;
    if ('notes' in updates) dbUpdates.notes = updates.notes ?? null;
    await db.updateSchedule(id, dbUpdates);
  }, []);

  const deleteSchedule = useCallback(async (id: string) => {
    setSchedules(prev => prev.filter(s => s.id !== id));
    await db.deleteSchedule(id);
  }, []);

  // 반복 일정: 각 날짜마다 독립된 일정을 한 번에 만들고 같은 seriesId로 묶음
  const addScheduleSeries = useCallback(async (fields: { title: string; startTime?: string | null; notes?: string | null }, dates: string[], existingId?: string) => {
    if (!user) return;
    const seriesId = newSeriesId();
    if (existingId) {
      // dates에는 기존 일정 날짜를 빼고 넘겨야 함 (호출하는 쪽에서 방금 바꾼 날짜를 알고 있으므로)
      await db.setSeriesId('schedules', existingId, seriesId);
      setSchedules(prev => prev.map(s => s.id === existingId ? { ...s, seriesId } : s));
    }
    if (dates.length === 0) return;
    const rows = await db.createSchedules(user.id, dates.map(date => ({
      title: fields.title, date, start_time: fields.startTime ?? null, notes: fields.notes ?? null,
    })), seriesId);
    setSchedules(prev => sortSchedules([...prev, ...rows.map(toSchedule)]));
  }, [user]);

  const updateScheduleSeries = useCallback(async (seriesId: string, fromDate: string | null, updates: { title?: string; startTime?: string | null; notes?: string | null }) => {
    const dbUpdates: Parameters<typeof db.updateScheduleSeries>[2] = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if ('startTime' in updates) dbUpdates.start_time = updates.startTime ?? null;
    if ('notes' in updates) dbUpdates.notes = updates.notes ?? null;
    setSchedules(prev => sortSchedules(prev.map(s => inSeries(s, seriesId, fromDate) ? { ...s, ...updates } : s)));
    await db.updateScheduleSeries(seriesId, fromDate, dbUpdates);
  }, []);

  const deleteScheduleSeries = useCallback(async (seriesId: string, fromDate: string | null) => {
    setSchedules(prev => prev.filter(s => !inSeries(s, seriesId, fromDate)));
    await db.deleteScheduleSeries(seriesId, fromDate);
  }, []);

  // ── 타임박스 (시간 블록) ──────────────────────────────
  // 저장소(날짜 없음)에 있던 할 일을 블록에 넣으면 그 날 할 일로 옮겨서 홈 화면 그 날짜에도 보이게 함
  const scheduleLinkedTodo = useCallback(async (todoId: string | null | undefined, startAt: string) => {
    if (!todoId) return;
    const todo = todos.find(t => t.id === todoId);
    if (todo && !todo.date) await updateTodo(todoId, { date: format(parseISO(startAt), 'yyyy-MM-dd') });
  }, [todos, updateTodo]);

  const addTimeBlock = useCallback(async (fields: Omit<TimeBlockFields, 'completed'> & { completed?: boolean }) => {
    if (!user) return null;
    const row = await db.createTimeBlock(user.id, {
      title: fields.title,
      todo_id: fields.todoId,
      color: fields.color,
      start_at: fields.startAt,
      end_at: fields.endAt,
      remind_minutes: fields.remindMinutes,
      completed: fields.completed ?? false,
    });
    const block = toTimeBlock(row);
    setTimeblocks(prev => sortTimeBlocks([...prev, block]));
    await scheduleLinkedTodo(fields.todoId, fields.startAt);
    return block;
  }, [user, scheduleLinkedTodo]);

  const updateTimeBlock = useCallback(async (id: string, updates: Partial<TimeBlockFields>) => {
    setTimeblocks(prev => sortTimeBlocks(prev.map(b => b.id === id ? { ...b, ...updates } : b)));
    const dbUpdates: Parameters<typeof db.updateTimeBlock>[1] = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if ('todoId' in updates) dbUpdates.todo_id = updates.todoId ?? null;
    if ('color' in updates) dbUpdates.color = updates.color ?? null;
    if (updates.startAt !== undefined) dbUpdates.start_at = updates.startAt;
    if (updates.endAt !== undefined) dbUpdates.end_at = updates.endAt;
    if (updates.completed !== undefined) dbUpdates.completed = updates.completed;
    if ('remindMinutes' in updates) dbUpdates.remind_minutes = updates.remindMinutes ?? null;
    // 시작 시각이나 알림 시점이 바뀌면 새 시간에 다시 울리도록 "보냄" 표시를 지움
    if (updates.startAt !== undefined || 'remindMinutes' in updates) dbUpdates.notified_at = null;
    await db.updateTimeBlock(id, dbUpdates);
    const block = timeblocks.find(b => b.id === id);
    if (updates.todoId) await scheduleLinkedTodo(updates.todoId, updates.startAt ?? block?.startAt ?? new Date().toISOString());
  }, [timeblocks, scheduleLinkedTodo]);

  const deleteTimeBlock = useCallback(async (id: string) => {
    setTimeblocks(prev => prev.filter(b => b.id !== id));
    await db.deleteTimeBlock(id);
  }, []);

  // 할 일과 연결된 블록이면 그 할 일을 완료 처리, 아니면 블록 자체를 완료 처리
  const toggleTimeBlock = useCallback(async (id: string) => {
    const block = timeblocks.find(b => b.id === id);
    if (!block) return;
    if (block.todoId && todos.some(t => t.id === block.todoId)) {
      await toggleTodo(block.todoId);
      return;
    }
    setTimeblocks(prev => prev.map(b => b.id === id ? { ...b, completed: !b.completed } : b));
    await db.updateTimeBlock(id, { completed: !block.completed });
  }, [timeblocks, todos, toggleTodo]);

  const ensureTimeBlocksFrom = useCallback(async (dateKey: string) => {
    if (!user) return;
    const from = parseISO(dateKey);
    const loadedFrom = timeblocksFromRef.current;
    if (from >= loadedFrom) return;
    timeblocksFromRef.current = from;
    const rows = await db.fetchTimeBlocks(user.id, from.toISOString(), loadedFrom.toISOString()).catch(() => []);
    setTimeblocks(prev => {
      const known = new Set(prev.map(b => b.id));
      return sortTimeBlocks([...prev, ...rows.map(toTimeBlock).filter(b => !known.has(b.id))]);
    });
  }, [user]);

  // ── 공지사항 ───────────────────────────────────────
  const addNotice = useCallback(async (title: string, content: string) => {
    const row = await db.createNotice(title, content);
    setNotices(prev => [toNotice(row), ...prev]);
  }, []);

  const updateNotice = useCallback(async (id: string, updates: { title?: string; content?: string }) => {
    setNotices(prev => prev.map(n => n.id === id ? { ...n, ...updates, updatedAt: new Date().toISOString() } : n));
    await db.updateNotice(id, updates);
  }, []);

  const deleteNotice = useCallback(async (id: string) => {
    setNotices(prev => prev.filter(n => n.id !== id));
    await db.deleteNotice(id);
  }, []);

  // ── Settings ─────────────────────────────────────────────
  const updateSettings = useCallback(async (updates: Partial<Settings>) => {
    if (!user) return;
    setSettings(prev => ({ ...prev, ...updates }));
    const dbUpdates: Parameters<typeof db.upsertSettings>[1] = {};
    if (updates.theme) dbUpdates.theme = updates.theme;
    if (updates.defaultScreen) dbUpdates.default_screen = updates.defaultScreen;
    if (updates.notifications !== undefined) dbUpdates.notifications = updates.notifications;
    if (updates.listSortBy) dbUpdates.list_sort_by = updates.listSortBy;
    if (updates.hideCompleted !== undefined) dbUpdates.hide_completed = updates.hideCompleted;
    if (updates.hiddenCategoryIds !== undefined) dbUpdates.hidden_category_ids = updates.hiddenCategoryIds;
    if (updates.calendarTextSize) dbUpdates.calendar_text_size = updates.calendarTextSize;
    await db.upsertSettings(user.id, dbUpdates);
  }, [user]);

  // ── 저장 실패 처리 ─────────────────────────────────────
  // 모든 추가/수정/삭제를 감싸서, 실패하면 알림을 띄우고 관련 데이터를 서버 내용으로 다시 맞춤.
  // 추가(create)는 실패를 다시 던져서 입력 창이 닫히지 않고 쓰던 내용이 남아 있게 함.
  function guard<A extends unknown[], R>(fn: (...args: A) => Promise<R>, kinds: Resource[], rethrow = false) {
    return async (...args: A): Promise<R | undefined> => {
      try {
        return await fn(...args);
      } catch (err) {
        console.error('save failed', err);
        showSaveError();
        for (const kind of kinds) resync(kind, 0);
        if (rethrow) throw markSaveErrorHandled(err);
        return undefined;
      }
    };
  }
  const T: Resource[] = ['todos'];
  const S: Resource[] = ['schedules'];
  // 연결된 할 일 완료 체크/날짜 이동도 함께 일어나므로 실패하면 할 일도 다시 맞춤
  const B: Resource[] = ['timeblocks', 'todos'];

  return (
    <AppContext.Provider value={{
      todos, categories, subcategories, notes, noteFolders, settings, monthlyGoals, ddays, schedules, timeblocks, notices, isAdmin, currentScreen, selectedDate, dataLoading,
      loadError, retryLoad,
      addTodo: guard(addTodo, T, true),
      addTodoSeries: guard(addTodoSeries, T, true),
      updateTodoSeries: guard(updateTodoSeries, T),
      deleteTodoSeries: guard(deleteTodoSeries, T),
      updateTodo: guard(updateTodo, T),
      deleteTodo: guard(deleteTodo, T),
      toggleTodo: guard(toggleTodo, T),
      reorderTodos: guard(reorderTodos, T),
      addCategory: guard(addCategory, ['categories'], true),
      updateCategory: guard(updateCategory, ['categories']),
      deleteCategory: guard(deleteCategory, ['categories', 'subcategories', 'todos']),
      reorderCategories: guard(reorderCategories, ['categories']),
      addSubcategory: guard(addSubcategory, ['subcategories'], true),
      updateSubcategory: guard(updateSubcategory, ['subcategories']),
      deleteSubcategory: guard(deleteSubcategory, ['subcategories', 'todos']),
      reorderSubcategories: guard(reorderSubcategories, ['subcategories']),
      addNote: guard(addNote, ['notes'], true),
      updateNote: guard(updateNote, ['notes']),
      deleteNote: guard(deleteNote, ['notes']),
      addNoteFolder: guard(addNoteFolder, ['noteFolders'], true),
      renameNoteFolder: guard(renameNoteFolder, ['noteFolders']),
      deleteNoteFolder: guard(deleteNoteFolder, ['noteFolders', 'notes']),
      updateSettings: guard(updateSettings, ['settings']),
      addMonthlyGoal: guard(addMonthlyGoal, ['monthlyGoals'], true),
      updateMonthlyGoal: guard(updateMonthlyGoal, ['monthlyGoals']),
      toggleMonthlyGoal: guard(toggleMonthlyGoal, ['monthlyGoals']),
      deleteMonthlyGoal: guard(deleteMonthlyGoal, ['monthlyGoals']),
      addDDay: guard(addDDay, ['ddays'], true),
      updateDDay: guard(updateDDay, ['ddays']),
      deleteDDay: guard(deleteDDay, ['ddays']),
      addSchedule: guard(addSchedule, S, true),
      updateSchedule: guard(updateSchedule, S),
      deleteSchedule: guard(deleteSchedule, S),
      addScheduleSeries: guard(addScheduleSeries, S, true),
      updateScheduleSeries: guard(updateScheduleSeries, S),
      deleteScheduleSeries: guard(deleteScheduleSeries, S),
      addTimeBlock: guard(addTimeBlock, B, true),
      updateTimeBlock: guard(updateTimeBlock, B),
      deleteTimeBlock: guard(deleteTimeBlock, B),
      toggleTimeBlock: guard(toggleTimeBlock, B),
      ensureTimeBlocksFrom,
      addNotice: guard(addNotice, ['notices'], true),
      updateNotice: guard(updateNotice, ['notices']),
      deleteNotice: guard(deleteNotice, ['notices']),
      setCurrentScreen, setSelectedDate,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
