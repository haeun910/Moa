import { useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronLeft, Check, Milestone, Package } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useApp } from '../context/AppContext';
import type { Todo } from '../types';

// 간단한 버전의 프로젝트 관리: 카테고리 하나를 "프로젝트"처럼 골라서,
// 그 안의 할 일들을 날짜순 타임라인(로드맵)으로 보여줌.
// 별도의 프로젝트 테이블 없이 기존 카테고리 데이터를 다른 방식으로 보여주는 화면이라
// 새 데이터 구조 없이도 바로 쓸 수 있음.
export default function ProjectPage() {
  const { categories, subcategories, todos, toggleTodo, setCurrentScreen } = useApp();
  const [projectCatId, setProjectCatId] = useState<string | null>(categories[0]?.id ?? null);

  const category = categories.find(c => c.id === projectCatId);
  const projectTodos = projectCatId ? todos.filter(t => t.categoryId === projectCatId) : [];

  // 날짜(작업할 날짜 우선, 없으면 마감일)가 있는 것만 타임라인에 순서대로 올리고,
  // 날짜가 아예 없는 저장소 항목은 "날짜 미정"으로 따로 모아 보여줌
  const dated = projectTodos
    .filter(t => t.date || t.dueDate)
    .sort((a, b) => (a.date || a.dueDate!).localeCompare(b.date || b.dueDate!));
  const undated = projectTodos.filter(t => !t.date && !t.dueDate);

  const completedCount = projectTodos.filter(t => t.completed).length;

  function monthLabel(dateStr: string) {
    return format(parseISO(dateStr), 'yyyy년 M월', { locale: ko });
  }

  function TimelineItem({ todo }: { todo: Todo }) {
    const cat = categories.find(c => c.id === todo.categoryId);
    const subcat = subcategories.find(s => s.id === todo.subcategoryId);
    return (
      <div className="flex gap-3">
        <div className="flex flex-col items-center flex-shrink-0 pt-1">
          <button
            onClick={() => toggleTodo(todo.id)}
            aria-label={todo.completed ? '완료 취소' : '완료 처리'}
            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
              todo.completed ? 'bg-leaf-400 border-leaf-400' : 'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600'
            }`}
            style={!todo.completed && cat ? { borderColor: cat.color } : undefined}
          >
            {todo.completed && <Check size={9} className="text-white" strokeWidth={3} />}
          </button>
          <div className="w-px flex-1 bg-gray-200 dark:bg-gray-700 mt-1" />
        </div>
        <div className="flex-1 min-w-0 pb-5">
          <p className={`text-sm font-medium ${todo.completed ? 'line-through text-gray-400 dark:text-gray-600' : 'text-gray-800 dark:text-gray-100'}`}>
            {todo.title}
          </p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {todo.date && <span className="text-[11px] text-gray-400">{format(parseISO(todo.date), 'M/d (EEE)', { locale: ko })}</span>}
            {!todo.date && todo.dueDate && <span className="text-[11px] text-gray-400">마감 {format(parseISO(todo.dueDate), 'M/d', { locale: ko })}</span>}
            {subcat && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                {subcat.name}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 월이 바뀔 때마다 구분 헤더를 끼워 넣음
  const timelineRows: ReactNode[] = [];
  let lastMonth = '';
  dated.forEach(t => {
    const key = t.date || t.dueDate!;
    const m = monthLabel(key);
    if (m !== lastMonth) {
      timelineRows.push(
        <p key={`month-${m}-${t.id}`} className="text-xs font-bold text-gray-400 dark:text-gray-500 mb-2 mt-1 first:mt-0">{m}</p>
      );
      lastMonth = m;
    }
    timelineRows.push(<TimelineItem key={t.id} todo={t} />);
  });

  return (
    <div className="min-h-screen pb-24 lg:pb-12">
      <div className="max-w-2xl mx-auto flex items-center gap-2 px-4 lg:px-8 pt-8 sm:pt-10 pb-5">
        <button onClick={() => setCurrentScreen('settings')} aria-label="설정으로 돌아가기"
          className="btn-icon w-9 h-9 -ml-2">
          <ChevronLeft size={20} />
        </button>
        <h1 className="page-title text-[22px] flex-1">프로젝트 로드맵</h1>
      </div>

      <div className="px-4 lg:px-8 max-w-2xl mx-auto">
        {categories.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-16">먼저 카테고리를 만들어주세요</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 mb-5">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setProjectCatId(cat.id)}
                  className={`flex items-center gap-1.5 h-8 px-3 rounded-full text-[13px] font-medium transition-colors ${
                    projectCatId === cat.id ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-semibold' : 'bg-white dark:bg-gray-900 ring-1 ring-inset ring-gray-200 dark:ring-gray-700 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                  {cat.name}
                </button>
              ))}
            </div>

            {category && (
              <div className="mb-5 flex items-center gap-2">
                <Milestone size={16} className="text-leaf-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-bold text-gray-800 dark:text-gray-100">{category.name}</p>
                  <p className="text-xs text-gray-400">{projectTodos.length}개 · 완료 {completedCount}개</p>
                </div>
              </div>
            )}

            {projectTodos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
                  <Package size={24} className="text-gray-400" />
                </div>
                <p className="text-sm font-medium text-gray-500">이 카테고리에 할 일이 없어요</p>
              </div>
            ) : (
              <>
                {timelineRows.length > 0 && <div>{timelineRows}</div>}

                {undated.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-bold text-gray-400 dark:text-gray-500 mb-2">날짜 미정</p>
                    <div className="space-y-2">
                      {undated.map(t => (
                        <div key={t.id} className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                          <button
                            onClick={() => toggleTodo(t.id)}
                            aria-label={t.completed ? '완료 취소' : '완료 처리'}
                            className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                              t.completed ? 'bg-leaf-600 border-leaf-600' : 'border-gray-300 dark:border-gray-600'
                            }`}
                          >
                            {t.completed && <Check size={9} className="text-white" strokeWidth={3} />}
                          </button>
                          <span className={`text-sm ${t.completed ? 'line-through text-gray-400' : 'text-gray-700 dark:text-gray-300'}`}>{t.title}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
