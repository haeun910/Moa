import type { Category, Subcategory, Todo } from '../types';

// 홈·저장소 목록처럼 할 일을 카테고리 → 하위 카테고리별로 묶음 (카테고리 순서대로, 분류 없음은 맨 뒤).
// 타임박스의 할 일 고르기(TodoPicker)와 달력의 할 일 배치(PlanPanel)가 같이 씀.
export interface TodoGroup {
  cat: Category | null;
  bare: Todo[]; // 하위 카테고리 없이 카테고리에 바로 든 할 일
  subGroups: { subcat: Subcategory; items: Todo[] }[];
  count: number;
}

export function groupTodosByCategory(list: Todo[], categories: Category[], subcategories: Subcategory[]): TodoGroup[] {
  const groups: TodoGroup[] = [...categories, null]
    .map(cat => {
      const inCat = list.filter(t => (t.categoryId ?? null) === (cat?.id ?? null));
      const subGroups = cat
        ? subcategories
            .filter(sc => sc.categoryId === cat.id)
            .map(subcat => ({ subcat, items: inCat.filter(t => t.subcategoryId === subcat.id) }))
            .filter(g => g.items.length > 0)
        : [];
      const grouped = new Set(subGroups.flatMap(g => g.items.map(t => t.id)));
      return { cat, bare: inCat.filter(t => !grouped.has(t.id)), subGroups, count: inCat.length };
    })
    .filter(g => g.count > 0);
  // 지워진 카테고리를 가리키는 할 일은 "분류 없음"에 모음
  const knownCats = new Set(categories.map(c => c.id));
  const orphans = list.filter(t => t.categoryId && !knownCats.has(t.categoryId));
  if (orphans.length) {
    const none = groups.find(g => !g.cat);
    if (none) { none.bare.push(...orphans); none.count += orphans.length; }
    else groups.push({ cat: null, bare: orphans, subGroups: [], count: orphans.length });
  }
  return groups;
}
