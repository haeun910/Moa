import { describe, expect, it } from 'vitest';
import { findMatch, matches, normalizeQuery, search, snippet, toChosung } from './search';
import type { Note, ScheduleItem, Todo } from '../types';

const todo = (id: string, extra: Partial<Todo>): Todo => ({
  id, title: id, completed: false, categoryId: null, subcategoryId: null, date: null, createdAt: '', ...extra,
});

describe('matches', () => {
  it('대소문자 무시, 한글 그대로', () => {
    expect(matches('Weekly Report 쓰기', normalizeQuery('report'))).toBe(true);
    expect(matches('보고서 쓰기', normalizeQuery('보고'))).toBe(true);
    expect(matches('보고서 쓰기', normalizeQuery('회의'))).toBe(false);
  });
  it('초성으로 찾기', () => {
    expect(toChosung('보고서')).toBe('ㅂㄱㅅ');
    expect(matches('주간 보고서 쓰기', normalizeQuery('ㅂㄱㅅ'))).toBe(true);
    expect(matches('주간 보고서 쓰기', normalizeQuery('ㅈㄱ ㅂㄱ'))).toBe(true);
    expect(matches('장보기', normalizeQuery('ㅂㄱㅅ'))).toBe(false);
  });
});

describe('search', () => {
  it('할 일은 안 끝낸 것 → 저장소·다가오는 날 → 지난 날 순', () => {
    const todos = [
      todo('운동 지난주', { date: '2026-10-10' }),
      todo('운동 끝냄', { date: '2026-10-20', completed: true }),
      todo('운동 다음주', { date: '2026-10-24' }),
      todo('운동 저장소', { date: null }),
      todo('운동 내일', { date: '2026-10-18' }),
      todo('장보기', { date: '2026-10-18', notes: '운동화 사기' }),
    ];
    const r = search('운동', { todos, schedules: [], notes: [] }, '2026-10-17');
    expect(r.todos.map(t => t.id)).toEqual(['운동 저장소', '운동 내일', '장보기', '운동 다음주', '운동 지난주', '운동 끝냄']);
  });
  it('일정·메모도 찾음', () => {
    const schedules: ScheduleItem[] = [
      { id: 's1', title: '팀 회의', date: '2026-10-16', createdAt: '', completed: false },
      { id: 's2', title: '팀 회의', date: '2026-10-20', createdAt: '', completed: false },
    ];
    const notes: Note[] = [
      { id: 'n1', title: '아이디어', content: '회의 때 말할 것', folderId: null, pinned: false, createdAt: '', updatedAt: '2026-10-01' },
      { id: 'n2', title: '회의록', content: '', folderId: null, pinned: false, createdAt: '', updatedAt: '2026-10-05' },
    ];
    const r = search('회의', { todos: [], schedules, notes }, '2026-10-17');
    expect(r.schedules.map(s => s.id)).toEqual(['s2', 's1']);
    expect(r.notes.map(n => n.id)).toEqual(['n2', 'n1']);
  });
  it('빈 검색어는 결과 없음', () => {
    expect(search('   ', { todos: [todo('a', {})], schedules: [], notes: [] }, '2026-10-17').todos).toEqual([]);
  });
});

describe('snippet', () => {
  it('검색어 주변만', () => {
    const text = '가'.repeat(100) + '찾는말' + '나'.repeat(100);
    const s = snippet(text, '찾는말', 5);
    expect(s).toBe('…가가가가가찾는말나나나나나…');
  });
  it('초성으로 찾은 자리도 표시', () => {
    expect(findMatch('주간 보고서 쓰기', 'ㅂㄱㅅ')).toEqual([3, 6]);
    expect(findMatch('Weekly Report', 'REP')).toEqual([7, 10]);
    expect(findMatch('장보기', '회의')).toBeNull();
  });
});
