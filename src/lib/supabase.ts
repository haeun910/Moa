import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// .env가 없거나 잘못돼도 앱 자체는 로드되어야 하므로(흰 화면 방지),
// 여기서 throw하지 않고 App.tsx가 이 플래그를 보고 안내 화면을 보여줍니다.
export const isSupabaseConfigured = Boolean(url && key);

// 공지사항을 작성/수정/삭제할 수 있는 관리자 계정.
// supabase/migrations/003_notices.sql의 RLS 정책과 반드시 같은 값이어야 합니다.
export const ADMIN_USER_ID = '17478ff6-7e7a-419e-ba64-7bb9db8bbcea';

export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  key || 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  }
);

// ────────────────────────────────────────────────
// DB 타입 (Supabase 반환 행 기준)
// ────────────────────────────────────────────────
export interface DbCategory {
  id: string;
  user_id: string;
  name: string;
  color: string;
  description: string | null;
  is_default: boolean;
  sort_order: number;
  created_at: string;
}

export interface DbSubcategory {
  id: string;
  user_id: string;
  category_id: string;
  name: string;
  notes: string | null;
  sort_order: number;
  created_at: string;
}

export interface DbTodo {
  id: string;
  user_id: string;
  title: string;
  completed: boolean;
  category_id: string | null;
  subcategory_id: string | null;
  date: string | null;
  due_date: string | null;
  is_dday: boolean;
  start_time: string | null;
  notes: string | null;
  sort_order: number;
  series_id?: string | null; // 012 마이그레이션 전에는 컬럼이 없을 수 있음
  created_at: string;
  updated_at: string;
}

export interface DbNote {
  id: string;
  user_id: string;
  title: string;
  content: string;
  folder_id?: string | null; // 014 마이그레이션 전에는 컬럼이 없을 수 있음
  pinned?: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbNoteFolder {
  id: string;
  user_id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

export interface DbMonthlyGoal {
  id: string;
  user_id: string;
  month: string;
  title: string;
  completed: boolean;
  sort_order: number;
  created_at: string;
}

export interface DbDDay {
  id: string;
  user_id: string;
  title: string;
  target_date: string;
  created_at: string;
}

// 일정: 날짜(+선택적 시간)가 정해진 이벤트. 날짜/시간이 없는 "할 일"과 구분되는 별도 항목으로,
// 홈 화면 달력에는 제목이 보이는 칩으로, 할 일은 그대로 색깔 점으로 표시됨.
export interface DbSchedule {
  id: string;
  user_id: string;
  title: string;
  date: string;
  start_time: string | null;
  notes: string | null;
  series_id?: string | null; // 012 마이그레이션 전에는 컬럼이 없을 수 있음
  created_at: string;
}

// 타임박스 블록. 시각은 기기 시간대 기준으로 만든 절대 시각(timestamptz)
export interface DbTimeBlock {
  id: string;
  user_id: string;
  todo_id: string | null;
  title: string;
  color: string | null;
  start_at: string;
  end_at: string;
  completed: boolean;
  remind_minutes: number | null;
  notified_at: string | null;
  created_at: string;
}

export interface DbNotice {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface DbSettings {
  user_id: string;
  theme: 'light' | 'dark' | 'system';
  default_screen: 'today' | 'calendar' | 'all' | 'notes' | 'timebox';
  notifications: boolean;
  list_sort_by: 'manual' | 'date' | 'name';
  hide_completed: boolean;
  hidden_category_ids: string[];
  calendar_text_size: 'small' | 'medium' | 'large';
  updated_at: string;
}

// 관리자 통계 (get_admin_stats RPC 반환값) - 개인정보 없이 집계된 숫자만
export interface AdminStats {
  totalUsers: number;
  newUsersToday: number;
  newUsersThisWeek: number;
  activeUsers7d: number;
  activeUsers30d: number;
  totalTodos: number;
  completedTodos: number;
  totalNotes: number;
  totalCategories: number;
}
