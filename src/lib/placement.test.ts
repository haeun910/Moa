import { describe, expect, it } from 'vitest';
import { placementLists } from './placement';
import { groupTodosByCategory } from './todoGroups';
import type { Category, Subcategory, Todo } from '../types';

const todo = (id: string, extra: Partial<Todo> = {}): Todo => ({
  id, title: id, completed: false, categoryId: null, subcategoryId: null, date: null, createdAt: '', ...extra,
});
const TODAY = '2026-11-20';

describe('placementLists', () => {
  it('저장소: 날짜 없고 안 끝낸 할 일만 (반복·숨긴 카테고리 제외)', () => {
    const { storage } = placementLists([
      todo('a'),
      todo('done', { completed: true }),
      todo('dated', { date: TODAY }),
      todo('series', { seriesId: 's1' }),
      todo('hidden', { categoryId: 'h' }),
      todo('shown', { categoryId: 'c' }),
    ], TODAY, ['h']);
    expect(storage.map(t => t.id)).toEqual(['a', 'shown']);
  });

  it('밀린 할 일: 지난 날짜·안 끝낸 것, 오래된 것부터, 반복은 따로 셈', () => {
    const { overdue, recurringOverdue } = placementLists([
      todo('new', { date: '2026-11-19' }),
      todo('old', { date: '2026-10-01' }),
      todo('today', { date: TODAY }),
      todo('done', { date: '2026-11-18', completed: true }),
      todo('skip', { date: '2026-11-18', skipped: true }),
      todo('rep', { date: '2026-11-18', seriesId: 's1' }),
      todo('hidden', { date: '2026-11-18', categoryId: 'h' }),
    ], TODAY, ['h']);
    expect(overdue.map(t => t.id)).toEqual(['old', 'new']);
    expect(recurringOverdue).toBe(1);
  });
});

describe('groupTodosByCategory', () => {
  const cats: Category[] = [{ id: 'c1', name: '학교', color: '#000' }, { id: 'c2', name: '회사', color: '#111' }];
  const subs: Subcategory[] = [{ id: 's1', categoryId: 'c1', name: '논문' }];

  it('카테고리 순서 → 하위 카테고리, 분류 없음·지워진 카테고리는 맨 뒤', () => {
    const groups = groupTodosByCategory([
      todo('none'),
      todo('work', { categoryId: 'c2' }),
      todo('paper', { categoryId: 'c1', subcategoryId: 's1' }),
      todo('school', { categoryId: 'c1' }),
      todo('orphan', { categoryId: 'gone' }),
    ], cats, subs);
    expect(groups.map(g => [g.cat?.id ?? null, g.bare.map(t => t.id), g.subGroups.map(s => [s.subcat.id, s.items.map(t => t.id)]), g.count])).toEqual([
      ['c1', ['school'], [['s1', ['paper']]], 2],
      ['c2', ['work'], [], 1],
      [null, ['none', 'orphan'], [], 2],
    ]);
  });
});
