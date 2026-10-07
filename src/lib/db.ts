import { supabase } from './supabase';
import type { DbCategory, DbSubcategory, DbTodo, DbNote, DbSettings, DbMonthlyGoal, DbDDay, DbSchedule, DbTimeBlock, DbNotice, AdminStats } from './supabase';

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
// 계정 삭제 - 본인 데이터 전체 삭제
// ────────────────────────────────────────────────
export async function deleteAllUserData(userId: string): Promise<void> {
  const tables = ['timeblocks', 'push_subscriptions', 'todos', 'subcategories', 'categories', 'notes', 'monthly_goals', 'ddays', 'schedules', 'user_settings'] as const;
  for (const table of tables) {
    const { error } = await supabase.from(table).delete().eq('user_id', userId);
    if (error) throw error;
  }
}

// ────────────────────────────────────────────────
// Categories
// ────────────────────────────────────────────────
export async function fetchCategories(userId: string): Promise<DbCategory[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('user_id', userId)
    .order('sort_order');
  if (error) throw error;
  return data ?? [];
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
  const { data, error } = await supabase
    .from('subcategories')
    .select('*')
    .eq('user_id', userId)
    .order('sort_order');
  if (error) throw error;
  return data ?? [];
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
  const { data, error } = await supabase
    .from('todos')
    .select('*')
    .eq('user_id', userId)
    // sort_order가 같은(주로 기본값 0인 새 항목들) 행이 많아서 sort_order만으로는
    // 순서가 매번 뒤바뀌어 보이는 문제가 있었음 → created_at을 2차 정렬 기준으로 추가해 항상 안정적인 순서를 보장
    .order('sort_order')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
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

// ────────────────────────────────────────────────
// Notes
// ────────────────────────────────────────────────
export async function fetchNotes(userId: string): Promise<DbNote[]> {
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createNote(userId: string, title: string, content: string): Promise<DbNote> {
  const { data, error } = await supabase
    .from('notes')
    .insert({ user_id: userId, title, content })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateNote(id: string, updates: Partial<Pick<DbNote, 'title' | 'content'>>): Promise<void> {
  const { error } = await supabase.from('notes').update(updates).eq('id', id);
  if (error) throw error;
}

export async function deleteNote(id: string): Promise<void> {
  const { error } = await supabase.from('notes').delete().eq('id', id);
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
  const { data, error } = await supabase
    .from('monthly_goals')
    .select('*')
    .eq('user_id', userId)
    .order('month')
    .order('sort_order');
  if (error) throw error;
  return data ?? [];
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
  const { data, error } = await supabase
    .from('ddays')
    .select('*')
    .eq('user_id', userId)
    .order('target_date');
  if (error) throw error;
  return data ?? [];
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
  const { data, error } = await supabase
    .from('schedules')
    .select('*')
    .eq('user_id', userId)
    .order('date')
    .order('start_time', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data ?? [];
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

// ────────────────────────────────────────────────
// Timeblocks (타임박스 - "언제 무엇을 하겠다"는 시간 블록)
// ────────────────────────────────────────────────
// 블록은 매일 쌓이므로 전부 불러오지 않고 fromIso 이후(필요하면 toIso 이전)만 가져옴
export async function fetchTimeBlocks(userId: string, fromIso: string, toIso?: string): Promise<DbTimeBlock[]> {
  let query = supabase
    .from('timeblocks')
    .select('*')
    .eq('user_id', userId)
    .gte('start_at', fromIso);
  if (toIso) query = query.lt('start_at', toIso);
  const { data, error } = await query.order('start_at');
  if (error) throw error;
  return data ?? [];
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
