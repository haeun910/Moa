import { useState, useRef } from 'react';
import { Plus, ArrowUp, SlidersHorizontal, CalendarCheck, CalendarDays, Package, Copy, ChevronDown, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import {
  DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors, useDroppable,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { useApp } from '../context/AppContext';
import { applyListDisplaySettings } from '../lib/listDisplay';
import SortableTodoItem, { TodoRows } from '../components/SortableTodoItem';
import TodoModal from '../components/TodoModal';
import CategoryFilter from '../components/CategoryFilter';
import type { Todo, Category, Subcategory, Settings } from '../types';
import { LIMITS } from '../lib/limits';

const NO_CATEGORY_GROUP_ID = '__none__';

interface TodoGroup {
  id: string;
  categoryId: string | null;
  subcategoryId: string | null;
  todos: Todo[];
}

// 그룹 하나(카테고리 자체 / 하위카테고리)를 드롭 대상 영역으로 만듦.
// (항목이 하나도 없는 그룹에도 다른 곳의 할 일을 끌어다 놓을 수 있어야 하므로 필요)
function DroppableGroup({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`rounded-xl transition-shadow ${isOver ? 'ring-2 ring-leaf-500/60 ring-offset-2 ring-offset-gray-50 dark:ring-offset-gray-950' : ''}`}>
      {children}
    </div>
  );
}

function TodoGroupList({ group, onEdit, actions }: { group: TodoGroup; onEdit: (todo: Todo) => void; actions: (todo: Todo) => React.ReactNode }) {
  return (
    <DroppableGroup id={group.id}>
      <SortableContext id={group.id} items={group.todos.map(t => t.id)} strategy={verticalListSortingStrategy}>
        {group.todos.length > 0 ? (
          <TodoRows>
            {group.todos.map(todo => (
              <SortableTodoItem key={todo.id} todo={todo} onEdit={onEdit} actions={actions(todo)} completeMovesToToday />
            ))}
          </TodoRows>
        ) : (
          <div className="h-3" />
        )}
      </SortableContext>
    </DroppableGroup>
  );
}

// 하위카테고리 하나: 접었다 펼 수 있고, 그 안에 바로 할 일을 입력할 수 있음
function SubcategorySection({
  subcat, group, onEdit, actions, onAdd,
}: {
  subcat: Subcategory;
  group: TodoGroup;
  onEdit: (todo: Todo) => void;
  actions: (todo: Todo) => React.ReactNode;
  onAdd: (title: string, catId: string | null, subcatId: string | null) => Promise<void>;
}) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="mt-4 pl-3.5 border-l-2 border-gray-200/80 dark:border-gray-800">
      <button onClick={() => setCollapsed(v => !v)} aria-expanded={!collapsed} className="flex items-center gap-1.5 mb-2 -ml-1 px-1 py-0.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800/60 transition-colors">
        {collapsed ? <ChevronRight size={14} className="text-gray-400 flex-shrink-0" /> : <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />}
        <span className="text-[13px] font-semibold text-gray-700 dark:text-gray-200">{subcat.name}</span>
        <span className="count-pill">{group.todos.length}</span>
      </button>
      {subcat.notes && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 px-1 leading-relaxed">{subcat.notes}</p>
      )}
      {!collapsed && (
        <>
          <TodoGroupList group={group} onEdit={onEdit} actions={actions} />
          <CategoryQuickAdd categoryId={group.categoryId} subcategoryId={group.subcategoryId} onAdd={onAdd} placeholder={`${subcat.name}에 추가`} />
        </>
      )}
    </div>
  );
}

// 지난 날짜를 포함해 원하는 날짜로 바로 보낼 수 있는 버튼.
// ("오늘로"는 오늘 날짜 전용이라 지나간 날짜에 등록하려면 상세 편집을 열어야 했음)
function SendToDateButton({ todo }: { todo: Todo }) {
  const { updateTodo } = useApp();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative" onClick={e => e.stopPropagation()}>
      <button
        onClick={() => setOpen(v => !v)}
        className="row-action"
        title="날짜 지정해서 보내기 (지난 날짜도 가능)"
      >
        <CalendarDays size={11} />
        날짜
      </button>
      {open && (
        <input
          type="date"
          autoFocus
          defaultValue={todo.date ?? ''}
          className="absolute left-0 top-full mt-1 z-20 text-xs px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 shadow-lg focus:outline-none focus:ring-2 focus:ring-leaf-500/25 focus:border-leaf-500"
          onChange={e => {
            if (e.target.value) updateTodo(todo.id, { date: e.target.value });
            setOpen(false);
          }}
          onBlur={() => setOpen(false)}
        />
      )}
    </div>
  );
}

function CategoryQuickAdd({ categoryId, subcategoryId, onAdd, placeholder = '할 일 추가' }: { categoryId: string | null; subcategoryId: string | null; onAdd: (title: string, catId: string | null, subcatId: string | null) => Promise<void>; placeholder?: string }) {
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  async function submit() {
    const t = title.trim();
    if (!t || loading) return;
    setLoading(true);
    try { await onAdd(t, categoryId, subcategoryId); setTitle(''); ref.current?.focus(); }
    finally { setLoading(false); }
  }

  return (
    <div className="flex items-center gap-2 pl-2.5 pr-1.5 h-9 rounded-lg mt-1.5 text-gray-400 hover:bg-gray-100/70 dark:hover:bg-gray-900/60 focus-within:bg-white dark:focus-within:bg-gray-900 focus-within:ring-1 focus-within:ring-gray-200 dark:focus-within:ring-gray-700 focus-within:shadow-sm transition-colors group">
      <Plus size={15} className="flex-shrink-0 group-focus-within:text-leaf-600" />
      <input maxLength={LIMITS.title}
        ref={ref}
        type="text"
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder={placeholder}
        className="flex-1 min-w-0 text-[13px] bg-transparent text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none"
        onKeyDown={e => { if (e.key === 'Enter') submit(); }}
      />
      {title.trim() && (
        <button onClick={submit} disabled={loading} aria-label="추가" className="btn-primary w-6 h-6 rounded-md">
          <ArrowUp size={13} strokeWidth={2.6} />
        </button>
      )}
    </div>
  );
}

interface CategoryBlockProps {
  cat: Category;
  subGroups: { subcat: Subcategory; group: TodoGroup }[];
  bare: TodoGroup;
  onEdit: (todo: Todo) => void;
  actions: (todo: Todo) => React.ReactNode;
  onAdd: (title: string, catId: string | null, subcatId: string | null) => Promise<void>;
}

// 카테고리 하나: 하위카테고리처럼 접었다 펼 수 있음.
// "분류 없이 추가"는 항상 맨 위에 하나만 명확하게 두고, 하위카테고리별 입력은 각 섹션 안에 둬서
// 저장소에 여러 "+ 할 일 추가" 상자가 있어도 어디에 추가되는지 헷갈리지 않게 함
function CategoryBlock({ cat, subGroups, bare, onEdit, actions, onAdd }: CategoryBlockProps) {
  const [collapsed, setCollapsed] = useState(false);
  const totalCount = bare.todos.length + subGroups.reduce((n, { group }) => n + group.todos.length, 0);

  return (
    <section className="mb-9">
      <button onClick={() => setCollapsed(v => !v)} aria-expanded={!collapsed} className="group w-full flex items-center gap-2.5 mb-1 text-left">
        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
        <span className="text-[15px] font-bold tracking-[-0.02em] text-gray-900 dark:text-white">{cat.name}</span>
        <span className="count-pill">{totalCount}</span>
        <span className="flex-1 h-px bg-gray-200/80 dark:bg-gray-800 ml-1" />
        {collapsed
          ? <ChevronRight size={15} className="text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200 flex-shrink-0 transition-colors" />
          : <ChevronDown size={15} className="text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200 flex-shrink-0 transition-colors" />}
      </button>
      {/* 카테고리 설명은 저장소 화면에서만 노출 */}
      {cat.description && (
        <p className="text-xs text-gray-500 dark:text-gray-400 pl-5 leading-relaxed">{cat.description}</p>
      )}
      <div className="h-3" />

      {!collapsed && (
        subGroups.length === 0 ? (
          <>
            <TodoGroupList group={bare} onEdit={onEdit} actions={actions} />
            <CategoryQuickAdd categoryId={cat.id} subcategoryId={null} onAdd={onAdd} placeholder={`${cat.name}에 추가`} />
          </>
        ) : (
          <>
            <div>
              {bare.todos.length > 0 && (
                <>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 px-0.5">분류 없음</p>
                  <TodoGroupList group={bare} onEdit={onEdit} actions={actions} />
                </>
              )}
              <CategoryQuickAdd categoryId={cat.id} subcategoryId={null} onAdd={onAdd} placeholder="분류 없이 추가" />
            </div>
            {subGroups.map(({ subcat, group }) => (
              <SubcategorySection key={subcat.id} subcat={subcat} group={group} onEdit={onEdit} actions={actions} onAdd={onAdd} />
            ))}
          </>
        )
      )}
    </section>
  );
}

// 설정 > 목록 표시에서 고른 정렬/완료 숨기기가 지금 켜져 있으면 저장소 화면에 바로 보여줌.
// (설정 화면에서만 알 수 있으면 실제로 적용됐는지 체감이 안 돼서, 저장소에서도 눈에 보이게 함)
function ListDisplayBadges({ settings }: { settings: Pick<Settings, 'listSortBy' | 'hideCompleted'> }) {
  if (settings.listSortBy === 'manual' && !settings.hideCompleted) return null;
  return (
    <div className="flex items-center gap-1.5 mt-2">
      {settings.listSortBy !== 'manual' && (
        <span className="count-pill">
          {settings.listSortBy === 'name' ? '이름순 정렬' : '등록순 정렬'}
        </span>
      )}
      {settings.hideCompleted && (
        <span className="count-pill">
          완료 항목 숨김
        </span>
      )}
    </div>
  );
}

export default function AllTodosPage() {
  const { todos: allTodos, categories, subcategories, settings, addTodo, updateTodo, reorderTodos } = useApp();
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  // 저장소 = 날짜 없이 보관 중인 할 일만 (날짜가 정해지면 저장소에서는 사라져야 함)
  const repoTodos = allTodos.filter(t => !t.date);
  // 목록에는 설정의 "목록 표시" 옵션(정렬/완료 숨기기/카테고리 표시 여부)을 적용하되,
  // 상단 개수 표시는 항상 실제 총 개수를 보여줘서 "완료 숨기기"를 켜도 몇 개가 숨겨졌는지 알 수 있게 함
  const todos = applyListDisplaySettings(repoTodos, settings);

  const [activeCatId, setActiveCatId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editTodo, setEditTodo] = useState<Todo | undefined>();
  const [quickTitle, setQuickTitle] = useState('');
  const [quickLoading, setQuickLoading] = useState(false);
  const quickInputRef = useRef<HTMLInputElement>(null);

  const groupSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  // 상세 추가 창을 열 때 빠른 입력창에 쓰던 제목을 이어서 씀
  const [detailTitle, setDetailTitle] = useState('');

  function openEdit(todo: Todo) { setEditTodo(todo); setShowModal(true); }
  function closeModal() { setShowModal(false); setEditTodo(undefined); }
  function openNewDetail() {
    setDetailTitle(quickTitle.trim());
    setQuickTitle('');
    setEditTodo(undefined);
    setShowModal(true);
  }

  async function handleQuickAdd() {
    const title = quickTitle.trim();
    if (!title || quickLoading) return;
    setQuickLoading(true);
    try {
      await addTodo({ title, completed: false, categoryId: activeCatId, subcategoryId: null, date: null, startTime: null, notes: '' });
      setQuickTitle('');
      quickInputRef.current?.focus();
    } finally { setQuickLoading(false); }
  }

  async function addToCategoryGroup(title: string, catId: string | null, subcatId: string | null) {
    await addTodo({ title, completed: false, categoryId: catId, subcategoryId: subcatId, date: null, startTime: null, notes: '' });
  }

  async function sendToToday(todo: Todo) {
    await updateTodo(todo.id, { date: todayStr });
  }

  // 비슷한 할 일을 매번 새로 입력하지 않도록, 기존 할 일을 그대로 복제해서 저장소에 새 항목으로 추가
  async function duplicateTodo(todo: Todo) {
    await addTodo({
      title: todo.title,
      completed: false,
      categoryId: todo.categoryId,
      subcategoryId: todo.subcategoryId,
      date: null,
      startTime: todo.startTime ?? null,
      notes: todo.notes ?? '',
    });
  }

  function getTodoActions(todo: Todo) {
    return (
      <>
        <button
          onClick={e => { e.stopPropagation(); sendToToday(todo); }}
          className="row-action !bg-leaf-50 !text-leaf-700 hover:!bg-leaf-100 dark:!bg-leaf-900/30 dark:!text-leaf-300 dark:hover:!bg-leaf-900/60"
          title="오늘 날짜로 이동"
        >
          <CalendarCheck size={11} />
          오늘로
        </button>
        <SendToDateButton todo={todo} />
        <button
          onClick={e => { e.stopPropagation(); duplicateTodo(todo); }}
          className="row-action"
          title="복사해서 새로 추가"
        >
          <Copy size={11} />
          복사
        </button>
      </>
    );
  }

  const repoTodoCount = repoTodos.length;
  const completedCount = repoTodos.filter(t => t.completed).length;

  // ── 그룹 구성 헬퍼 ──────────────────────────────────────────
  function subcatGroupsOf(catId: string) {
    return subcategories
      .filter(sc => sc.categoryId === catId)
      .map(sc => ({
        subcat: sc,
        group: { id: `subcat-${sc.id}`, categoryId: catId, subcategoryId: sc.id, todos: todos.filter(t => t.subcategoryId === sc.id) } as TodoGroup,
      }));
  }
  function bareGroupOf(catId: string): TodoGroup {
    return { id: `cat-${catId}`, categoryId: catId, subcategoryId: null, todos: todos.filter(t => t.categoryId === catId && !t.subcategoryId) };
  }
  const noCategoryGroup: TodoGroup = { id: NO_CATEGORY_GROUP_ID, categoryId: null, subcategoryId: null, todos: todos.filter(t => !t.categoryId) };

  function findGroupById(id: string): TodoGroup | undefined {
    if (id === NO_CATEGORY_GROUP_ID) return noCategoryGroup;
    if (id.startsWith('subcat-')) {
      const sc = subcategories.find(s => s.id === id.slice('subcat-'.length));
      if (!sc) return undefined;
      return { id, categoryId: sc.categoryId, subcategoryId: sc.id, todos: todos.filter(t => t.subcategoryId === sc.id) };
    }
    if (id.startsWith('cat-')) {
      const catId = id.slice('cat-'.length);
      return { id, categoryId: catId, subcategoryId: null, todos: todos.filter(t => t.categoryId === catId && !t.subcategoryId) };
    }
    return undefined;
  }

  // 그룹(카테고리 자체 / 하위카테고리) 사이를 넘나드는 드래그앤드롭 처리.
  function handleGroupDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const activeTodo = todos.find(t => t.id === active.id);
    if (!activeTodo) return;

    type SortableData = { sortable?: { containerId: string } };
    const activeGroupId =
      (active.data.current as SortableData | undefined)?.sortable?.containerId
      ?? (activeTodo.subcategoryId ? `subcat-${activeTodo.subcategoryId}` : activeTodo.categoryId ? `cat-${activeTodo.categoryId}` : NO_CATEGORY_GROUP_ID);
    const overGroupId =
      (over.data.current as SortableData | undefined)?.sortable?.containerId
      ?? (over.id as string);

    if (activeGroupId !== overGroupId) {
      // 다른 그룹(카테고리/하위카테고리) 위에 놓음 → 소속 변경
      const targetGroup = findGroupById(overGroupId);
      if (!targetGroup) return;
      updateTodo(activeTodo.id, { categoryId: targetGroup.categoryId, subcategoryId: targetGroup.subcategoryId });
      return;
    }

    // 같은 그룹 안에서는 순서만 변경
    if (active.id === over.id) return;
    const group = findGroupById(activeGroupId);
    if (!group) return;
    const ids = group.todos.map(t => t.id);
    const oldIndex = ids.indexOf(active.id as string);
    const newIndex = ids.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;
    reorderTodos(arrayMove(ids, oldIndex, newIndex));
  }

  // 설정의 "카테고리별 표시"에서 숨긴 카테고리는 저장소 기본(전체) 화면에서 아예 보이지 않아야 함
  const visibleCategories = categories.filter(c => !settings.hiddenCategoryIds.includes(c.id));

  const completedPct = repoTodoCount ? Math.round((completedCount / repoTodoCount) * 100) : 0;

  function renderHeader() {
    return (
      <>
        <header className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h1 className="page-title">저장소</h1>
            <p className="page-subtitle">날짜를 정하지 않은 할 일 {repoTodoCount}개 · 완료 {completedCount}개</p>
            <ListDisplayBadges settings={settings} />
          </div>
          {repoTodoCount > 0 && (
            <div className="flex items-center gap-2 mb-1 flex-shrink-0">
              <div className="w-24 h-1 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-leaf-500 rounded-full transition-[width] duration-500" style={{ width: `${completedPct}%` }} />
              </div>
              <span className="text-xs font-semibold tabular-nums text-gray-600 dark:text-gray-300">{completedPct}%</span>
            </div>
          )}
        </header>
        <div className="mb-7">
          <CategoryFilter activeCatId={activeCatId} onChange={setActiveCatId} />
        </div>
      </>
    );
  }

  // 화면 아래에 떠 있는 빠른 추가 입력창 (데스크톱에선 사이드바 오른쪽 영역 기준으로 가운데 정렬)
  function renderQuickBar(placeholder: string) {
    return (
      <div className="fixed bottom-[62px] lg:bottom-0 left-0 lg:left-[76px] wide:left-[232px] right-0 z-40 pointer-events-none">
        <div className="max-w-3xl mx-auto px-4 lg:px-8 pb-3 lg:pb-6 pt-8 bg-gradient-to-t from-gray-50 via-gray-50/90 to-transparent dark:from-gray-950 dark:via-gray-950/90">
          <div className="pointer-events-auto bg-white dark:bg-gray-900 rounded-xl ring-1 ring-gray-200 dark:ring-gray-700 shadow-lg focus-within:ring-2 focus-within:ring-leaf-500 transition-shadow flex items-center gap-1 pl-3.5 pr-1.5 py-1.5">
            <Plus size={16} className="text-gray-400 flex-shrink-0" />
            <input maxLength={LIMITS.title} ref={quickInputRef} type="text" value={quickTitle}
              onChange={e => setQuickTitle(e.target.value)}
              placeholder={placeholder}
              className="flex-1 min-w-0 text-sm bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none py-1.5 px-1.5"
              onKeyDown={e => { if (e.key === 'Enter') handleQuickAdd(); }} />
            <button onClick={openNewDetail} aria-label="상세 옵션으로 추가" title="날짜·시간·마감일·반복 등 상세 옵션으로 추가"
              className="btn-icon w-auto px-2.5 gap-1 text-xs font-semibold whitespace-nowrap">
              <SlidersHorizontal size={14} />
              상세
            </button>
            <button onClick={handleQuickAdd} disabled={!quickTitle.trim() || quickLoading} aria-label="추가" className="btn-primary w-8 h-8">
              <ArrowUp size={16} strokeWidth={2.4} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (activeCatId !== null) {
    const cat = categories.find(c => c.id === activeCatId);
    const filteredCount = todos.filter(t => t.categoryId === activeCatId).length;

    return (
      <div className="max-w-3xl mx-auto px-4 lg:px-8 pt-8 sm:pt-10 pb-36">
        {renderHeader()}

        {filteredCount === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 rounded-xl bg-white dark:bg-gray-900 shadow-card flex items-center justify-center mb-3">
              <Package size={22} className="text-gray-400" />
            </div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-300">이 카테고리에 보관 중인 할 일이 없어요</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">아래 입력창에서 바로 추가할 수 있어요</p>
          </div>
        ) : (
          <DndContext sensors={groupSensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={handleGroupDragEnd}>
            {cat && (
              <CategoryBlock
                cat={cat}
                subGroups={subcatGroupsOf(cat.id)}
                bare={bareGroupOf(cat.id)}
                onEdit={openEdit}
                actions={getTodoActions}
                onAdd={addToCategoryGroup}
              />
            )}
          </DndContext>
        )}

        {renderQuickBar(`${cat?.name ?? ''}에 할 일 추가`)}
        {showModal && <TodoModal todo={editTodo} defaultCategoryId={activeCatId} defaultTitle={detailTitle} onClose={closeModal} />}
      </div>
    );
  }

  const isEmpty = visibleCategories.length === 0 && noCategoryGroup.todos.length === 0;

  return (
    <div className="max-w-3xl mx-auto px-4 lg:px-8 pt-8 sm:pt-10 pb-36">
      {renderHeader()}

      {isEmpty && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-2xl bg-white dark:bg-gray-900 shadow-card flex items-center justify-center mb-4">
            <Package size={24} className="text-gray-400" />
          </div>
          <p className="text-gray-700 dark:text-gray-200 font-semibold">저장소가 비어 있어요</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">언젠가 할 일을 날짜 없이 모아두는 곳이에요</p>
        </div>
      )}

      <DndContext
        sensors={groupSensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis]}
        onDragEnd={handleGroupDragEnd}
      >
        <div>
          {visibleCategories.map(cat => (
            <CategoryBlock
              key={cat.id}
              cat={cat}
              subGroups={subcatGroupsOf(cat.id)}
              bare={bareGroupOf(cat.id)}
              onEdit={openEdit}
              actions={getTodoActions}
              onAdd={addToCategoryGroup}
            />
          ))}
          {noCategoryGroup.todos.length > 0 && (
            <section className="mb-9">
              <div className="flex items-center gap-2.5 mb-4">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-gray-300 dark:bg-gray-600" />
                <span className="text-[15px] font-bold tracking-[-0.02em] text-gray-600 dark:text-gray-300">분류 없음</span>
                <span className="count-pill">{noCategoryGroup.todos.length}</span>
                <span className="flex-1 h-px bg-gray-200/80 dark:bg-gray-800 ml-1" />
              </div>
              <TodoGroupList group={noCategoryGroup} onEdit={openEdit} actions={getTodoActions} />
              <CategoryQuickAdd categoryId={null} subcategoryId={null} onAdd={addToCategoryGroup} />
            </section>
          )}
        </div>
      </DndContext>

      {visibleCategories.length === 0 && noCategoryGroup.todos.length === 0 && (
        <CategoryQuickAdd categoryId={null} subcategoryId={null} onAdd={addToCategoryGroup} />
      )}

      {renderQuickBar('할 일 추가 (날짜 없이 보관)')}

      {showModal && <TodoModal todo={editTodo} defaultTitle={detailTitle} onClose={closeModal} />}
    </div>
  );
}
