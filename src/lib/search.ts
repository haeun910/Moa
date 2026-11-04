// 검색: 할 일 · 일정 · 메모에서 글자로 찾기 (대소문자 무시, 한글 초성 검색 지원: "ㅂㄱㅅ" → 보고서)
import type { Note, ScheduleItem, Todo } from '../types';

const CHOSUNG = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
const HANGUL_START = 0xac00;
const HANGUL_END = 0xd7a3;

// 글자마다 초성으로 바꿈 (한글 음절이 아니면 그대로)
export function toChosung(text: string): string {
  let out = '';
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    out += code >= HANGUL_START && code <= HANGUL_END ? CHOSUNG[Math.floor((code - HANGUL_START) / 588)] : ch;
  }
  return out;
}

// 검색어가 자음(초성)으로만 되어 있는지 (공백 제외)
function isChosungQuery(q: string): boolean {
  const compact = q.replace(/\s+/g, '');
  return compact.length > 0 && /^[ㄱ-ㅎ]+$/.test(compact);
}

export function normalizeQuery(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, ' ');
}

// 이 글에 검색어가 들어 있는지
export function matches(text: string | null | undefined, query: string): boolean {
  if (!text || !query) return false;
  const hay = text.toLowerCase();
  if (hay.includes(query)) return true;
  if (isChosungQuery(query)) {
    const q = query.replace(/\s+/g, '');
    return toChosung(hay).replace(/\s+/g, '').includes(q);
  }
  return false;
}

export interface SearchResults {
  todos: Todo[];
  schedules: ScheduleItem[];
  notes: Note[];
}

// 검색 결과 순서
// - 할 일: 아직 안 끝낸 것 먼저 → 날짜 없는(저장소) 것과 오늘 이후 것을 가까운 순 → 지난 것은 최근 순
// - 일정: 오늘 이후를 가까운 순 → 지난 것은 최근 순
// - 메모: 최근에 고친 순
export function search(query: string, data: { todos: Todo[]; schedules: ScheduleItem[]; notes: Note[] }, todayKey: string): SearchResults {
  const q = normalizeQuery(query);
  if (!q) return { todos: [], schedules: [], notes: [] };
  const upcomingFirst = (a: string | null, b: string | null) => {
    const fa = !a || a >= todayKey;
    const fb = !b || b >= todayKey;
    if (fa !== fb) return fa ? -1 : 1;
    if (fa) return (a ?? '').localeCompare(b ?? ''); // 저장소('')가 맨 앞, 그다음 가까운 날
    return (b ?? '').localeCompare(a ?? '');
  };
  const todos = data.todos
    .filter(t => matches(t.title, q) || matches(t.notes, q))
    .sort((a, b) => Number(a.completed || !!a.skipped) - Number(b.completed || !!b.skipped) || upcomingFirst(a.date, b.date));
  const schedules = data.schedules
    .filter(s => matches(s.title, q) || matches(s.notes, q))
    .sort((a, b) => upcomingFirst(a.date, b.date) || (a.startTime ?? '').localeCompare(b.startTime ?? ''));
  const notes = data.notes
    .filter(n => matches(n.title, q) || matches(n.content, q))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return { todos, schedules, notes };
}

// 글 안에서 검색어가 걸린 자리 [시작, 끝) (굵게 표시용). 초성 검색은 띄어쓰기까지 같을 때만 자리를 찾음
export function findMatch(text: string, query: string): [number, number] | null {
  const q = normalizeQuery(query);
  if (!text || !q) return null;
  const hay = text.toLowerCase();
  const i = hay.indexOf(q);
  if (i >= 0) return [i, i + q.length];
  if (isChosungQuery(q)) {
    const j = toChosung(hay).indexOf(q);
    if (j >= 0) return [j, j + q.length];
  }
  return null;
}

// 메모 본문에서 검색어 주변만 잘라 보여주기
export function snippet(text: string, query: string, radius = 36): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  const hit = findMatch(flat, query);
  if (!hit) return flat.length > radius * 2 ? `${flat.slice(0, radius * 2)}…` : flat;
  const start = Math.max(0, hit[0] - radius);
  const end = Math.min(flat.length, hit[1] + radius);
  return `${start > 0 ? '…' : ''}${flat.slice(start, end)}${end < flat.length ? '…' : ''}`;
}
