// 입력 글자 수 상한. DB에도 같은 값의 제약이 있음 (supabase/migrations/018_hardening.sql)
// 입력칸에서 먼저 막아야 DB에서 거절당해 "저장하지 못했어요"가 뜨는 일이 없음
export const LIMITS = {
  title: 500,          // 할 일 · 일정 · 목표 · D-Day · 타임박스 · 메모 · 공지 제목
  categoryName: 100,
  subcategoryName: 200,
  folderName: 50,      // 014_note_folders.sql
  longText: 20000,     // 할 일 메모 · 일정 메모 · 카테고리 설명 · 하위카테고리 메모 · 공지 내용
  noteContent: 200000,
  feedback: 2000,      // 013_feedback_and_sync.sql
} as const;
