export interface Todo {
  id: string;
  title: string;
  completed: boolean;
  categoryId: string | null;
  subcategoryId: string | null; // 카테고리 하위의 그룹 (예: "프로젝트" 안의 "재가센터 관리앱")
  date: string | null; // ISO date string YYYY-MM-DD or null
  dueDate?: string | null; // 마감일(작업할 날짜 date와는 별개) YYYY-MM-DD or null
  isDday?: boolean; // 체크하면 홈 화면 D-Day 목록에도 자동으로 나타남 (dueDate 또는 date를 기준일로 사용)
  startTime?: string | null; // HH:MM
  createdAt: string;
  notes?: string;
  seriesId?: string | null; // 반복으로 만든 할 일이면 같은 반복끼리 공유하는 id
}

export interface Category {
  id: string;
  name: string;
  color: string;
  description?: string | null; // 저장소 화면에서만 노출되는 설명
  isDefault?: boolean;
}

export interface Subcategory {
  id: string;
  categoryId: string;
  name: string;
  notes?: string | null; // 하위카테고리 메모 (저장소 화면에서만 노출)
}

export interface Note {
  id: string;
  title: string;
  content: string;
  folderId: string | null; // 메모 폴더 (없으면 "폴더 없음")
  pinned: boolean; // 목록 맨 위에 고정
  createdAt: string;
  updatedAt: string;
}

export interface NoteFolder {
  id: string;
  name: string;
}

export interface Settings {
  theme: 'light' | 'dark' | 'system';
  defaultScreen: 'today' | 'calendar' | 'all' | 'notes' | 'timebox';
  notifications: boolean;
  listSortBy: 'manual' | 'date' | 'name'; // 목록 정렬 기준
  hideCompleted: boolean; // 완료된 항목 목록에서 숨기기
  hiddenCategoryIds: string[]; // 목록에서 숨길 카테고리
  calendarTextSize: 'small' | 'medium' | 'large'; // 홈 화면 월 달력 칸에 뜨는 일정 글자 크기
}

export type Screen = 'today' | 'calendar' | 'all' | 'notes' | 'timebox' | 'settings' | 'categories' | 'terms' | 'privacy' | 'project';

export interface MonthlyGoal {
  id: string;
  month: string; // YYYY-MM
  title: string;
  completed: boolean;
}

export interface DDay {
  id: string;
  title: string;
  targetDate: string; // YYYY-MM-DD
  fromTodoId?: string; // 이 값이 있으면 할 일에서 자동으로 연동된 가상 D-Day (직접 수정/삭제 불가, 할 일 쪽에서 관리)
}

// 일정: 날짜(+선택적 시간)가 정해진 이벤트. 날짜/시간이 없는 "할 일"과는 별개로 관리되고,
// 홈 화면 달력에는 할 일(색깔 점)과 달리 제목이 보이는 칩으로 표시됨.
export interface ScheduleItem {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  startTime?: string | null; // HH:MM
  notes?: string | null;
  createdAt: string;
  seriesId?: string | null; // 반복으로 만든 일정이면 같은 반복끼리 공유하는 id
}

// 타임박스: "이 시간엔 이걸 하겠다"는 시간 블록. 정해진 약속(일정)과 달리 자유롭게 옮기고 늘리고 줄임.
// 할 일과 연결하면 제목/색/완료 체크가 그 할 일을 따라감.
export interface TimeBlock {
  id: string;
  title: string; // 할 일과 연결된 블록은 연결 당시 제목(할 일이 지워졌을 때 대신 보여줄 용도)
  todoId: string | null;
  color: string | null; // 할 일과 연결 안 된 블록의 색 (연결된 블록은 할 일 카테고리 색)
  startAt: string; // ISO timestamp
  endAt: string; // ISO timestamp
  completed: boolean; // 할 일과 연결 안 된 블록의 완료 여부
  remindMinutes: number | null; // 시작 몇 분 전에 알릴지 (0 = 시작 시각, null = 알림 없음)
  createdAt: string;
  seriesId: string | null; // 반복(매주 고정 등)으로 만든 블록 묶음
}

export interface Notice {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}
