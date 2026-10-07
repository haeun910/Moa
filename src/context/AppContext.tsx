import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase, ADMIN_USER_ID } from '../lib/supabase';
import type { DbTodo, DbCategory, DbSubcategory, DbNote, DbSettings, DbMonthlyGoal, DbDDay, DbSchedule, DbTimeBlock, DbNotice } from '../lib/supabase';
import * as db from '../lib/db';
import { useAuth } from './AuthContext';
import { format, parseISO, startOfWeek, subWeeks } from 'date-fns';
import type { Todo, Category, Subcategory, Note, Settings, Screen, MonthlyGoal, DDay, ScheduleItem, TimeBlock, Notice } from '../types';

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
  };
}

function toCategory(c: DbCategory): Category {
  return { id: c.id, name: c.name, color: c.color, description: c.description, isDefault: c.is_default };
}

function toSubcategory(s: DbSubcategory): Subcategory {
  return { id: s.id, categoryId: s.category_id, name: s.name, notes: s.notes };
}

function toNote(n: DbNote): Note {
  return { id: n.id, title: n.title, content: n.content, createdAt: n.created_at, updatedAt: n.updated_at };
}

function toMonthlyGoal(g: DbMonthlyGoal): MonthlyGoal {
  return { id: g.id, month: g.month, title: g.title, completed: g.completed };
}

function toDDay(d: DbDDay): DDay {
  return { id: d.id, title: d.title, targetDate: d.target_date };
}

function toSchedule(s: DbSchedule): ScheduleItem {
  return { id: s.id, title: s.title, date: s.date, startTime: s.start_time, notes: s.notes, createdAt: s.created_at };
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
  addTodo: (fields: Omit<Todo, 'id' | 'createdAt'>) => Promise<void>;
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
  addNote: (title: string, content: string) => Promise<void>;
  updateNote: (id: string, updates: { title?: string; content?: string }) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  updateSettings: (updates: Partial<Settings>) => Promise<void>;
  addMonthlyGoal: (month: string, title: string) => Promise<void>;
  toggleMonthlyGoal: (id: string) => Promise<void>;
  deleteMonthlyGoal: (id: string) => Promise<void>;
  addDDay: (title: string, targetDate: string) => Promise<void>;
  updateDDay: (id: string, updates: { title?: string; targetDate?: string }) => Promise<void>;
  deleteDDay: (id: string) => Promise<void>;
  addSchedule: (fields: { title: string; date: string; startTime?: string | null; notes?: string | null }) => Promise<void>;
  updateSchedule: (id: string, updates: { title?: string; date?: string; startTime?: string | null; notes?: string | null }) => Promise<void>;
  deleteSchedule: (id: string) => Promise<void>;
  addTimeBlock: (fields: Omit<TimeBlockFields, 'completed'> & { completed?: boolean }) => Promise<TimeBlock | null>;
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

  const channelRef = useRef<RealtimeChannel | null>(null);
  // 앱 진입 시 defaultScreen으로 딱 한 번만 이동하기 위한 플래그.
  // (예전엔 user 객체 참조가 바뀔 때마다(토큰 자동 갱신 등) 이 효과가 다시 돌면서
  //  사용자가 어느 화면에 있든 자꾸 홈 화면으로 튕기는 버그가 있었음)
  const didSetInitialScreenRef = useRef(false);

  // ── 초기 데이터 로드 ────────────────────────────────────
  useEffect(() => {
    if (!user) {
      setTodos([]); setCategories([]); setSubcategories([]); setNotes([]);
      setSettings(DEFAULT_SETTINGS); setMonthlyGoals([]); setDDays([]); setSchedules([]); setTimeblocks([]); setNotices([]);
      setDataLoading(false);
      didSetInitialScreenRef.current = false;
      return;
    }

    setDataLoading(true);
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
      db.fetchTimeBlocks(user.id, timeblocksFromRef.current.toISOString()).catch(() => []), // timeblocks도 마찬가지
    ]).then(([rawTodos, rawCats, rawSubcats, rawNotes, rawSettings, rawGoals, rawDDays, rawSchedules, rawNotices, rawTimeBlocks]) => {
      setTodos(rawTodos.map(toTodo));
      setCategories(rawCats.map(toCategory));
      setSubcategories(rawSubcats.map(toSubcategory));
      setNotes(rawNotes.map(toNote));
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
    }).finally(() => setDataLoading(false));
    // user.id만 의존성으로 둬서, 토큰 자동 갱신처럼 user "객체"만 새로 생성되고
    // 실제 로그인 계정은 그대로인 경우에는 이 무거운 재조회 + 화면 이동이 일어나지 않게 함
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

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

    const channel = supabase
      .channel(`user-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'todos', filter: `user_id=eq.${user.id}` },
        async () => {
          const rows = await db.fetchTodos(user.id);
          setTodos(rows.map(toTodo));
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories', filter: `user_id=eq.${user.id}` },
        async () => {
          const rows = await db.fetchCategories(user.id);
          setCategories(rows.map(toCategory));
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subcategories', filter: `user_id=eq.${user.id}` },
        async () => {
          const rows = await db.fetchSubcategories(user.id);
          setSubcategories(rows.map(toSubcategory));
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notes', filter: `user_id=eq.${user.id}` },
        async () => {
          const rows = await db.fetchNotes(user.id);
          setNotes(rows.map(toNote));
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'timeblocks', filter: `user_id=eq.${user.id}` },
        async () => {
          const rows = await db.fetchTimeBlocks(user.id, timeblocksFromRef.current.toISOString()).catch(() => null);
          if (rows) setTimeblocks(sortTimeBlocks(rows.map(toTimeBlock)));
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notices' },
        async () => {
          const rows = await db.fetchNotices().catch(() => []);
          setNotices(rows.map(toNotice));
        })
      .subscribe();

    channelRef.current = channel;
    return () => { channel.unsubscribe(); };
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
    setTodos(prev => [...prev, toTodo(row)]);
  }, [user, todos.length]);

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
  const addNote = useCallback(async (title: string, content: string) => {
    if (!user) return;
    const row = await db.createNote(user.id, title, content);
    setNotes(prev => [toNote(row), ...prev]);
  }, [user]);

  const updateNote = useCallback(async (id: string, updates: { title?: string; content?: string }) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, ...updates, updatedAt: new Date().toISOString() } : n));
    await db.updateNote(id, updates);
  }, []);

  const deleteNote = useCallback(async (id: string) => {
    setNotes(prev => prev.filter(n => n.id !== id));
    await db.deleteNote(id);
  }, []);

  // ── Monthly Goals ────────────────────────────────
  const addMonthlyGoal = useCallback(async (month: string, title: string) => {
    if (!user) return;
    const row = await db.createMonthlyGoal(user.id, month, title);
    setMonthlyGoals(prev => [...prev, toMonthlyGoal(row)]);
  }, [user]);

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

  return (
    <AppContext.Provider value={{
      todos, categories, subcategories, notes, settings, monthlyGoals, ddays, schedules, timeblocks, notices, isAdmin, currentScreen, selectedDate, dataLoading,
      addTodo, updateTodo, deleteTodo, toggleTodo, reorderTodos,
      addCategory, updateCategory, deleteCategory, reorderCategories,
      addSubcategory, updateSubcategory, deleteSubcategory, reorderSubcategories,
      addNote, updateNote, deleteNote,
      updateSettings,
      addMonthlyGoal, toggleMonthlyGoal, deleteMonthlyGoal,
      addDDay, updateDDay, deleteDDay,
      addSchedule, updateSchedule, deleteSchedule,
      addTimeBlock, updateTimeBlock, deleteTimeBlock, toggleTimeBlock, ensureTimeBlocksFrom,
      addNotice, updateNotice, deleteNotice,
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
