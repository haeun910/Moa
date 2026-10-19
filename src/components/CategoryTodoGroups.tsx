import type React from 'react';
import { useApp } from '../context/AppContext';
import TodoList from './TodoList';
import type { Todo } from '../types';

// 할 일을 카테고리별로 묶어서 카테고리 이름이 목록 사이에 끼어들도록 보여줌 (홈 · 달력 날짜 패널 공통).
// 카테고리 안에서 다시 하위카테고리별로 나눔 (저장소에서 완료 체크해 오늘로 넘어온
// 항목도 하위카테고리가 그대로 보이도록). 하위카테고리가 없는 항목은 그대로 위에 나열.
export default function CategoryTodoGroups({ todos, onEdit, getActions, className = 'space-y-5' }: {
  todos: Todo[];
  onEdit: (todo: Todo) => void;
  getActions?: (todo: Todo) => React.ReactNode;
  className?: string;
}) {
  const { categories, subcategories } = useApp();

  const groups = [
    ...categories.map(cat => ({ cat, groupTodos: todos.filter(t => t.categoryId === cat.id) })),
    { cat: null, groupTodos: todos.filter(t => !t.categoryId || !categories.some(c => c.id === t.categoryId)) },
  ].filter(g => g.groupTodos.length > 0);

  return (
    <div className={className}>
      {groups.map(({ cat, groupTodos }) => {
        const bareTodos = cat ? groupTodos.filter(t => !t.subcategoryId) : groupTodos;
        const subGroups = cat
          ? subcategories
              .filter(sc => sc.categoryId === cat.id)
              .map(sc => ({ subcat: sc, subTodos: groupTodos.filter(t => t.subcategoryId === sc.id) }))
              .filter(g => g.subTodos.length > 0)
          : [];
        // 지워진 하위카테고리를 가리키는 할 일이 목록에서 사라지지 않게 위쪽 목록에 같이 둠
        const orphanTodos = cat
          ? groupTodos.filter(t => t.subcategoryId && !subGroups.some(g => g.subcat.id === t.subcategoryId))
          : [];
        const topTodos = [...bareTodos, ...orphanTodos];
        return (
          <section key={cat?.id ?? '__none__'}>
            <div className="flex items-center gap-2 mb-2 px-0.5">
              {cat ? (
                <>
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">{cat.name}</span>
                </>
              ) : (
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">분류 없음</span>
              )}
              <span className="count-pill">{groupTodos.length}</span>
            </div>
            <TodoList todos={topTodos} onEdit={onEdit} getActions={getActions} />
            {subGroups.map(({ subcat, subTodos }) => (
              <div key={subcat.id} className={`${topTodos.length ? 'mt-3' : ''} pl-3 border-l-2 border-gray-200/80 dark:border-gray-800`}>
                <p className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 px-0.5">
                  {subcat.name}
                  <span className="count-pill">{subTodos.length}</span>
                </p>
                <TodoList todos={subTodos} onEdit={onEdit} getActions={getActions} />
              </div>
            ))}
          </section>
        );
      })}
    </div>
  );
}
