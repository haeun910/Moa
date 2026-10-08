import { supabase } from './supabase';
import type { DbCategory, DbSubcategory, DbTodo, DbNote, DbNoteFolder, DbSettings, DbMonthlyGoal, DbDDay, DbSchedule, DbTimeBlock, DbNotice, AdminStats } from './supabase';

// ────────────────────────────────────────────────
// 여러 번 나눠서 전부 가져오기
// Supabase API는 한 번에 최대 1,000줄(대시보드 API 설정의 Max rows 기본값)만 돌려줘서,
// 할 일·일정처럼 계속 쌓이는 데이터는 이걸 넘으면 뒤쪽이 아무 오류 없이 잘렸음.
// 같은 정렬로 1,000줄씩 이어서 받고, 정렬값이 같은 줄이 페이지 경계에서 섞이지 않도록 id를 마지막 정렬 기준으로 씀.
// ────────────────────────────────────────────────
export const PAGE_SIZE = 1000;

export async function fetchAllPages<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < PAGE_SIZE) return all;
  }
}

// ────────────────────────────────────────────────
// 관리자 통계 (관리자 계정만 실제 값을 받을 수 있음 - DB 함수에서 강제)
// ────────────────────────────────────────────────
export async function fetchAdminStats(): Promise<AdminStats> {
  const { data, error } = await supabase.rpc('get_admin_stats');
  if (error) throw error;
  return data as AdminStats;
}

// ────────────────────────────────────────────────
// 공지사항 (관리자만 작성 가능, 로그인한 모두가 읽음)
// ────────────────────────────────────────────────
export async function fetchNotices(): Promise<DbNotice[]> {
  const { data, error } = await supabase
    .from('notices')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createNotice(title: string, content: string): Promise<DbNotice> {
  const { data, error } = await supabase
    .from('notices')
    .insert({ title, content })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateNotice(id: string, updates: Partial<Pick<DbNotice, 'title' | 'content'>>): Promise<void> {
  const { error } = await supabase.from('notices').update(updates).eq('id', id);
  if (error) throw error;
}

export async function deleteNotice(id: string): Promise<void> {
  const { error } = await supabase.from('notices').delete().eq('id', id);
  if (error) throw error;
}

// ────────────────────────────────────────────────
// 회원 탈퇴 - 로그인 계정까지 완전히 삭제 (015 마이그레이션의 delete_my_account 함수)
// 계정이 지워지면 모든 테이블의 본인 데이터도 DB에서 함께 삭제됨 (on delete cascade)
// ────────────────────────────────────────────────
export async function deleteMyAccount(userId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_my_account');
  if (!error) return;
  // 015를 아직 실행하지 않은 DB: 함수가 없으면 예전처럼 데이터라도 지움 (로그인 계정은 남음)
  const missingFunction = error.code === 'PGRST202' || /delete_my_account/.test(error.message ?? '');
  if (!missingFunction) throw error;
  console.warn('delete_my_account 함수가 없어 데이터만 삭제합니다. 015 마이그레이션을 실행해주세요.');
  const tables = ['timeblocks', 'push_subscriptions', 'todos', 'subcategories', 'categories', 'notes', 'note_folders', 'monthly_goals', 'ddays', 'schedules', 'feedback', 'user_settings'] as const;
  for (const table of tables) {
    const { error: e } = await supabase.from(table).delete().eq('user_id', userId);
    // feedback은 본인도 삭제 권한이 없고, 아직 없는 테이블일 수도 있어서 해당 오류는 무시
    if (e && table !== 'feedback' && table !== 'note_folders' && table !== 'timeblocks' && table !== 'push_subscriptions') throw e;
  }
}

// ────────────────────────────────────────────────
// Categories
// ────────────────────────────────────────────────
export async function fetchCategories(userId: string): Promise<DbCategory[]> {
  return fetchAllPages<DbCategory>((from, to) => supabase
    .from('categories')
    .select('*')
    .eq('user_id', userId)
    .order('sort_order')
    .order('id')
    .range(from, to));
}

export async function createCategory(userId: string, name: string, color: string, sortOrder = 0, description?: string | null): Promise<DbCategory> {
  const { data, error } = await supabase
    .from('categories')
    .insert({ user_id: userId, name, color, sort_order: sortOrder, description: description ?? null })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateCategory(id: string, updates: Partial<Pick<DbCategory, 'name' | 'color' | 'sort_order' | 'description'>>): Promise<void> {
  const { error } = await supabase.from('categories').update(updates).eq('id', id);
  if (error) throw error;
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase.from('categories').delete().eq('id', id);
  if (error) throw error;
}

// ────────────────────────────────────────────────
// Subcategories (카테고리 하위 그룹)
// ────────────────────────────────────────────────
export async function fetchSubcategories(userId: string): Promise<DbSubcategory[]> {
  return fetchAllPages<DbSubcategory>((from, to) => supabase
    .from('subcategories')
    .select('*')
    .eq('user_id', userId)
    .order('sort_order')
    .order('id')
    .range(from, to));
}

export async function createSubcategory(userId: string, categoryId: string, name: string, sortOrder = 0): Promise<DbSubcategory> {
  const { data, error } = await supabase
    .from('subcategories')
    .insert({ user_id: userId, category_id: categoryId, name, sort_order: sortOrder })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateSubcategory(id: string, updates: Partial<Pick<DbSubcategory, 'name' | 'notes' | 'sort_order'>>): Promise<void> {
  const { error } = await supabase.from('subcategories').update(updates).eq('id', id);
  if (error) throw error;
}

export async function deleteSubcategory(id: string): Promise<void> {
  const { error } = await supabase.from('subcategories').delete().eq('id', id);
  if (error) throw error;
}

// ────────────────────────────────────────────────
// Todos
// ────────────────────────────────────────────────
export async function fetchTodos(userId: string): Promise<DbTodo[]> {
  return fetchAllPages<DbTodo>((from, to) => supabase
    .from('todos')
    .select('*')
    .eq('user_id', userId)
    // sort_order가 같은(주로 기본값 0인 새 항목들) 행이 많아서 sort_order만으로는
    // 순서가 매번 뒤바뀌어 보이는 문제가 있었음 → created_at을 2차 정렬 기준으로 추가해 항상 안정적인 순서를 보장
    .order('sort_order')
    .order('created_at', { ascending: true })
    .order('id')
    .range(from, to));
}

export async function createTodo(
  userId: string,
  fields: { title: string; completed?: boolean; category_id?: string | null; subcategory_id?: string | null; date?: string | null; due_date?: string | null; start_time?: string | null; notes?: string; sort_order?: number; is_dday?: boolean }
): Promise<DbTodo> {
  const { data, error } = await supabase
    .from('todos')
    .insert({ user_id: userId, ...fields })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function updateTodo(
  id: string,
  updates: Partial<Pick<DbTodo, 'title' | 'completed' | 'category_id' | 'subcategory_id' | 'date' | 'due_date' | 'start_time' | 'notes' | 'sort_order' | 'is_dday'>>
): Promise<void> {
  const { error } = await supabase.from('todos').update(updates).eq('id', id);
  if (error) throw error;
}

export async function deleteTodo(id: string): Promise<void> {
  const { error } = await supabase.from('todos').delete().eq('id', id);
  if (error) throw error;
}

// ── 반복(series) 공통 ──────────────────────────────
// 012 마이그레이션(series_id 컬럼)을 아직 실행하지 않은 DB에서도 반복 생성 자체는 되도록,
// series_id 컬럼이 없다는 오류면 series_id 없이 다시 저장함 (이 경우 묶음 수정/삭제만 안 됨)
function isMissingSeriesColumn(error: { message?: string } | null): boolean {
  return !!error?.message && error.message.includes('series_id');
}

async function insertMany<T>(table: 'todos' | 'schedules', rows: Record<string, unknown>[]): Promise<T[]> {
  if (rows.length === 0) return [];
  const first = await supabase.from(table).insert(rows).select('*');
  if (!first.error) return (first.data ?? []) as T[];
  if (!isMissingSeriesColumn(first.error)) throw first.error;
  const retry = await supabase.from(table).insert(rows.map(({ series_id: _omit, ...rest }) => rest)).select('*');
  if (retry.error) throw retry.error;
  return (retry.data ?? []) as T[];
}

// fromDate가 있으면 그 날짜 이후(포함) 회차만, 없으면 반복 전체
function seriesQuery<Q extends { eq: (col: string, v: string) => Q; gte: (col: string, v: string) => Q }>(q: Q, seriesId: string, fromDate: string | null): Q {
  const scoped = q.eq('series_id', seriesId);
  return fromDate ? scoped.gte('date', fromDate) : scoped;
}

// 기존 항목 하나를 반복 묶음에 넣음 (반복으로 바꾸기). series_id 컬럼이 없으면(012 전) 묶음만 생략
export async function setSeriesId(table: 'todos' | 'schedules', id: string, seriesId: string): Promise<void> {
  const { error } = await supabase.from(table).update({ series_id: seriesId }).eq('id', id);
  if (error && !isMissingSeriesColumn(error)) throw error;
}

export async function createTodos(userId: string, rows: Parameters<typeof createTodo>[1][], seriesId: string): Promise<DbTodo[]> {
  return insertMany<DbTodo>('todos', rows.map(r => ({ user_id: userId, ...r, series_id: seriesId })));
}

export async function updateTodoSeries(
  seriesId: string, fromDate: string | null,
  updates: Partial<Pick<DbTodo, 'title' | 'category_id' | 'subcategory_id' | 'start_time' | 'notes'>>
): Promise<void> {
  const { error } = await seriesQuery(supabase.from('todos').update(updates), seriesId, fromDate);
  if (error) throw error;
}

export async function deleteTodoSeries(seriesId: string, fromDate: string | null): Promise<void> {
  const { error } = await seriesQuery(supabase.from('todos').delete(), seriesId, fromDate);
  if (error) throw error;
}

// ────────────────────────────────────────────────
// Notes
// ────────────────────────────────────────────────
export async function fetchNotes(userId: string): Promise<DbNote[]> {
  return fetchAllPages<DbNote>((from, to) => supabase
    .from('notes')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .order('id')
    .range(from, to));
}

export async function createNote(userId: string, title: string, content: string, folderId: string | null = null): Promise<DbNote> {
  const { data, error } = await supabase
    .from('notes')
    // folder_id는 폴더를 고른 경우에만 보냄 (014 마이그레이션 전에도 폴더 없는 메모는 저장되도록)
    .insert({ user_id: userId, title, content, ...(folderId ? { folder_id: folderId } : {}) })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateNote(id: string, updates: Partial<Pick<DbNote, 'title' | 'content' | 'folder_id' | 'pinned'>>): Promise<void> {
  const { error } = await supabase.from('notes').update(updates).eq('id', id);
  if (error) throw error;
}

export async function deleteNote(id: string): Promise<void> {
  const { error } = await supabase.from('notes').delete().eq('id', id);
  if (error) throw error;
}

// 메모 폴더
export async function fetchNoteFolders(userId: string): Promise<DbNoteFolder[]> {
  return fetchAllPages<DbNoteFolder>((from, to) => supabase
    .from('note_folders')
    .select('*')
    .eq('user_id', userId)
    .order('sort_order')
    .order('created_at')
    .order('id')
    .range(from, to));
}

export async function createNoteFolder(userId: string, name: string, sortOrder: number): Promise<DbNoteFolder> {
  const { data, error } = await supabase
    .from('note_folders')
    .insert({ user_id: userId, name, sort_order: sortOrder })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateNoteFolder(id: string, updates: Partial<Pick<DbNoteFolder, 'name' | 'sort_order'>>): Promise<void> {
  const { error } = await supabase.from('note_folders').update(updates).eq('id', id);
  if (error) throw error;
}

// 폴더를 지워도 메모는 남음 (DB에서 folder_id가 null로 바뀜)
export async function deleteNoteFolder(id: string): Promise<void> {
  const { error } = await supabase.from('note_folders').delete().eq('id', id);
  if (error) throw error;
}

// ────────────────────────────────────────────────
// Settings
// ────────────────────────────────────────────────
export async function fetchSettings(userId: string): Promise<DbSettings | null> {
  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data ?? null;
}

export async function upsertSettings(userId: string, updates: Partial<Pick<DbSettings, 'theme' | 'default_screen' | 'notifications' | 'list_sort_by' | 'hide_completed' | 'hidden_category_ids' | 'calendar_text_size'>>): Promise<void> {
  const { error } = await supabase
    .from('user_settings')
    .upsert({ user_id: userId, ...updates }, { onConflict: 'user_id' });
  if (error) throw error;
}

// ────────────────────────────────────────────────
// Monthly Goals
// ────────────────────────────────────────────────
export async function fetchMonthlyGoals(userId: string): Promise<DbMonthlyGoal[]> {
  return fetchAllPages<DbMonthlyGoal>((from, to) => supabase
    .from('monthly_goals')
    .select('*')
    .eq('user_id', userId)
    .order('month')
    .order('sort_order')
    .order('id')
    .range(from, to));
}

export async function createMonthlyGoal(userId: string, month: string, title: string): Promise<DbMonthlyGoal> {
  const { data, error } = await supabase
    .from('monthly_goals')
    .insert({ user_id: userId, month, title })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateMonthlyGoal(id: string, updates: Partial<Pick<DbMonthlyGoal, 'title' | 'completed'>>): Promise<void> {
  const { error } = await supabase.from('monthly_goals').update(updates).eq('id', id);
  if (error) throw error;
}

export async function deleteMonthlyGoal(id: string): Promise<void> {
  const { error } = await supabase.from('monthly_goals').delete().eq('id', id);
  if (error) throw error;
}

// ────────────────────────────────────────────────
// D-Days
// ────────────────────────────────────────────────
export async function fetchDDays(userId: string): Promise<DbDDay[]> {
  return fetchAllPages<DbDDay>((from, to) => supabase
    .from('ddays')
    .select('*')
    .eq('user_id', userId)
    .order('target_date')
    .order('id')
    .range(from, to));
}

export async function createDDay(userId: string, title: string, targetDate: string): Promise<DbDDay> {
  const { data, error } = await supabase
    .from('ddays')
    .insert({ user_id: userId, title, target_date: targetDate })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateDDay(id: string, updates: Partial<Pick<DbDDay, 'title' | 'target_date'>>): Promise<void> {
  const { error } = await supabase.from('ddays').update(updates).eq('id', id);
  if (error) throw error;
}

export async function deleteDDay(id: string): Promise<void> {
  const { error } = await supabase.from('ddays').delete().eq('id', id);
  if (error) throw error;
}

// ────────────────────────────────────────────────
// Schedules (날짜/시간이 정해진 일정 - 할 일과는 별개)
// ────────────────────────────────────────────────
export async function fetchSchedules(userId: string): Promise<DbSchedule[]> {
  return fetchAllPages<DbSchedule>((from, to) => supabase
    .from('schedules')
    .select('*')
    .eq('user_id', userId)
    .order('date')
    .order('start_time', { ascending: true, nullsFirst: false })
    .order('id')
    .range(from, to));
}

export async function createSchedule(
  userId: string,
  fields: { title: string; date: string; start_time?: string | null; notes?: string | null }
): Promise<DbSchedule> {
  const { data, error } = await supabase
    .from('schedules')
    .insert({ user_id: userId, ...fields })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateSchedule(id: string, updates: Partial<Pick<DbSchedule, 'title' | 'date' | 'start_time' | 'notes'>>): Promise<void> {
  const { error } = await supabase.from('schedules').update(updates).eq('id', id);
  if (error) throw error;
}

export async function deleteSchedule(id: string): Promise<void> {
  const { error } = await supabase.from('schedules').delete().eq('id', id);
  if (error) throw error;
}

export async function createSchedules(
  userId: string,
  rows: { title: string; date: string; start_time?: string | null; notes?: string | null }[],
  seriesId: string
): Promise<DbSchedule[]> {
  return insertMany<DbSchedule>('schedules', rows.map(r => ({ user_id: userId, ...r, series_id: seriesId })));
}

export async function updateScheduleSeries(
  seriesId: string, fromDate: string | null,
  updates: Partial<Pick<DbSchedule, 'title' | 'start_time' | 'notes'>>
): Promise<void> {
  const { error } = await seriesQuery(supabase.from('schedules').update(updates), seriesId, fromDate);
  if (error) throw error;
}

export async function deleteScheduleSeries(seriesId: string, fromDate: string | null): Promise<void> {
  const { error } = await seriesQuery(supabase.from('schedules').delete(), seriesId, fromDate);
  if (error) throw error;
}

// ────────────────────────────────────────────────
// 의견 보내기 (사용자는 보내기만, 목록 조회/삭제는 관리자만 — RLS로 강제)
// ────────────────────────────────────────────────
export interface DbFeedback {
  id: string;
  user_id: string;
  content: string;
  app_version: string | null;
  created_at: string;
}

export async function createFeedback(userId: string, content: string, appVersion: string): Promise<void> {
  const { error } = await supabase.from('feedback').insert({ user_id: userId, content, app_version: appVersion });
  if (error) throw error;
}

export async function fetchFeedback(): Promise<DbFeedback[]> {
  const { data, error } = await supabase.from('feedback').select('*').order('created_at', { ascending: false }).limit(200);
  if (error) throw error;
  return data ?? [];
}

export async function deleteFeedback(id: string): Promise<void> {
  const { error } = await supabase.from('feedback').delete().eq('id', id);
  if (error) throw error;
}

// ────────────────────────────────────────────────
// Timeblocks (타임박스 - "언제 무엇을 하겠다"는 시간 블록)
// ────────────────────────────────────────────────
// 블록은 매일 쌓이므로 전부 불러오지 않고 fromIso 이후(필요하면 toIso 이전)만 가져옴
export async function fetchTimeBlocks(userId: string, fromIso: string, toIso?: string): Promise<DbTimeBlock[]> {
  return fetchAllPages<DbTimeBlock>((from, to) => {
    let query = supabase
      .from('timeblocks')
      .select('*')
      .eq('user_id', userId)
      .gte('start_at', fromIso);
    if (toIso) query = query.lt('start_at', toIso);
    return query.order('start_at').order('id').range(from, to);
  });
}

// 백업용: 화면에 불러온 2주치만이 아니라 전체 타임박스
export async function fetchAllTimeBlocks(userId: string): Promise<DbTimeBlock[]> {
  return fetchTimeBlocks(userId, '1970-01-01T00:00:00Z');
}

export async function createTimeBlock(
  userId: string,
  fields: Pick<DbTimeBlock, 'title' | 'todo_id' | 'color' | 'start_at' | 'end_at' | 'remind_minutes'> & { completed?: boolean }
): Promise<DbTimeBlock> {
  const { data, error } = await supabase
    .from('timeblocks')
    .insert({ user_id: userId, ...fields })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateTimeBlock(
  id: string,
  updates: Partial<Pick<DbTimeBlock, 'title' | 'todo_id' | 'color' | 'start_at' | 'end_at' | 'completed' | 'remind_minutes' | 'notified_at'>>
): Promise<void> {
  const { error } = await supabase.from('timeblocks').update(updates).eq('id', id);
  if (error) throw error;
}

export async function deleteTimeBlock(id: string): Promise<void> {
  const { error } = await supabase.from('timeblocks').delete().eq('id', id);
  if (error) throw error;
}

// 테이블이 아직 없는 DB(해당 마이그레이션 실행 전)인지. 일시적인 네트워크·서버 오류와 구분하기 위함
export function isMissingTableError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const { code, message } = err as { code?: unknown; message?: unknown };
  if (code === 'PGRST205' || code === '42P01') return true;
  return typeof message === 'string' && /Could not find the table|relation .* does not exist/i.test(message);
}

// 테이블이 없을 때만 빈 목록으로 보고, 그 밖의 실패는 그대로 던짐 (빠진 채로 백업이 '성공'하면 안 되므로)
export async function emptyIfMissingTable<T>(promise: Promise<T[]>): Promise<T[]> {
  try {
    return await promise;
  } catch (err) {
    if (isMissingTableError(err)) return [];
    throw err;
  }
}

// ────────────────────────────────────────────────
// 데이터 내보내기(백업) - 화면에 불러온 것이 아니라 서버에 있는 본인 데이터 전체
// (예전엔 화면 상태를 그대로 저장해서, 2주보다 오래된 타임박스 등이 백업에서 빠졌음)
// ────────────────────────────────────────────────
export async function exportAllUserData(userId: string) {
  const [todos, categories, subcategories, notes, noteFolders, monthlyGoals, ddays, schedules, timeblocks, settings] = await Promise.all([
    fetchTodos(userId),
    fetchCategories(userId),
    fetchSubcategories(userId),
    fetchNotes(userId),
    emptyIfMissingTable(fetchNoteFolders(userId)),
    fetchMonthlyGoals(userId),
    fetchDDays(userId),
    emptyIfMissingTable(fetchSchedules(userId)),
    emptyIfMissingTable(fetchAllTimeBlocks(userId)),
    fetchSettings(userId),
  ]);
  return {
    exportedAt: new Date().toISOString(),
    // 서버에 저장된 그대로의 형식(컬럼 이름 snake_case)
    format: 'moa-db-rows-v1',
    todos, categories, subcategories, notes, noteFolders, monthlyGoals, ddays, schedules, timeblocks, settings,
  };
}

// ────────────────────────────────────────────────
// 순서 바꾸기 - 한 번의 요청으로 sort_order를 목록 순서(0, 1, 2, ...)대로 저장 (018 마이그레이션의 reorder_items)
// 예전엔 항목 수만큼 따로 요청을 보내서, 50개를 옮기면 요청 50번 + 실시간 알림 50번이 생겼음
// ────────────────────────────────────────────────
export type ReorderTable = 'todos' | 'categories' | 'subcategories';

export async function reorderItems(table: ReorderTable, orderedIds: string[]): Promise<void> {
  if (orderedIds.length === 0) return;
  const { error } = await supabase.rpc('reorder_items', { p_table: table, p_ids: orderedIds });
  if (!error) return;
  // 018을 아직 실행하지 않은 DB: 예전처럼 한 줄씩 저장
  const missingFunction = error.code === 'PGRST202' || /reorder_items/.test(error.message ?? '');
  if (!missingFunction) throw error;
  const results = await Promise.all(orderedIds.map((id, i) => supabase.from(table).update({ sort_order: i }).eq('id', id)));
  const failed = results.find(r => r.error);
  if (failed?.error) throw failed.error;
}
