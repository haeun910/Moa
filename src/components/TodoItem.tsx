import { useState, useRef, useEffect } from 'react';
import { Check, Trash2, Clock, Flag, StickyNote, Repeat } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { Todo } from '../types';
import { useApp } from '../context/AppContext';

interface Props {
  todo: Todo;
  onEdit: (todo: Todo) => void;
  actions?: React.ReactNode;
  // 저장소에서만: 체크박스를 눌러 완료 처리하면 자동으로 오늘 날짜로 이동시킴
  completeMovesToToday?: boolean;
}

export default function TodoItem({ todo, onEdit, actions, completeMovesToToday }: Props) {
  const { toggleTodo, updateTodo, deleteTodo, categories } = useApp();
  const [showDelete, setShowDelete] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState('');
  // 한 번 누르면 상세 편집 모달, 두 번 누르면(더블클릭) 목록에서 바로 이름만 빠르게 수정.
  // 두 클릭을 구분하기 위해 첫 클릭을 잠깐 미뤄뒀다가, 그 사이 두 번째 클릭이 오면 취소함.
  const titleClickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (titleClickTimer.current) clearTimeout(titleClickTimer.current); }, []);

  const category = categories.find(c => c.id === todo.categoryId);
  const isOverdue = Boolean(todo.dueDate) && !todo.completed && todo.dueDate! < format(new Date(), 'yyyy-MM-dd');

  function handleTitleClick() {
    if (titleClickTimer.current) return; // 더블클릭의 두 번째 클릭이면 무시(아래 handleTitleDoubleClick이 처리)
    titleClickTimer.current = setTimeout(() => {
      titleClickTimer.current = null;
      onEdit(todo);
    }, 220);
  }

  function handleTitleDoubleClick() {
    if (titleClickTimer.current) { clearTimeout(titleClickTimer.current); titleClickTimer.current = null; }
    setEditTitleValue(todo.title);
    setEditingTitle(true);
  }

  async function saveTitleEdit() {
    const trimmed = editTitleValue.trim();
    if (trimmed && trimmed !== todo.title) await updateTodo(todo.id, { title: trimmed });
    setEditingTitle(false);
  }

  // 체크박스 클릭 처리: 저장소에서는 완료 체크 시 자동으로 오늘 날짜로 이동
  async function handleCheckboxClick() {
    if (completeMovesToToday && !todo.completed) {
      await updateTodo(todo.id, { completed: true, date: format(new Date(), 'yyyy-MM-dd') });
      return;
    }
    await toggleTodo(todo.id);
  }

  return (
    <div
      className="relative"
      onMouseEnter={() => setShowDelete(true)}
      onMouseLeave={() => { setShowDelete(false); setConfirmDelete(false); }}
    >
      <div className="flex items-start gap-3 pl-2 pr-2.5 py-2.5">
        {/* Checkbox (카테고리 색을 테두리에 살짝 반영) */}
        <button
          onClick={handleCheckboxClick}
          aria-label={todo.completed ? '완료 취소' : '완료 처리'}
          className={`flex-shrink-0 mt-px w-[18px] h-[18px] rounded-[6px] border-[1.5px] flex items-center justify-center transition-all duration-150 active:scale-90 ${
            todo.completed
              ? 'bg-leaf-600 border-leaf-600 dark:bg-leaf-500 dark:border-leaf-500'
              : 'border-gray-300 dark:border-gray-600 hover:border-leaf-500 hover:bg-leaf-50 dark:hover:bg-leaf-900/30'
          }`}
          style={!todo.completed && category ? { borderColor: `${category.color}99` } : undefined}
        >
          {todo.completed && <Check size={12} className="text-white" strokeWidth={3} />}
        </button>

        {/* Title + meta */}
        <div className="flex-1 min-w-0">
          {editingTitle ? (
            <input
              autoFocus
              type="text"
              value={editTitleValue}
              onChange={e => setEditTitleValue(e.target.value)}
              onClick={e => e.stopPropagation()}
              onKeyDown={e => {
                if (e.key === 'Enter') saveTitleEdit();
                if (e.key === 'Escape') setEditingTitle(false);
              }}
              onBlur={saveTitleEdit}
              className="block w-full text-[14px] leading-snug bg-transparent border-b border-leaf-400 text-gray-800 dark:text-gray-100 focus:outline-none"
            />
          ) : (
            <span
              onClick={handleTitleClick}
              onDoubleClick={handleTitleDoubleClick}
              title="한 번: 자세히 편집 · 두 번: 이름만 바로 수정"
              className={`block text-[14px] leading-[1.45] transition-colors cursor-pointer ${
                todo.completed
                  ? 'line-through decoration-gray-300 dark:decoration-gray-600 text-gray-400 dark:text-gray-500'
                  : 'text-gray-900 dark:text-gray-100'
              }`}
            >
              {todo.title}
            </span>
          )}
          {(todo.startTime || todo.dueDate || todo.notes || todo.seriesId) && (
            <div className="flex items-center gap-2.5 mt-1 cursor-pointer tabular-nums" onClick={handleTitleClick}>
              {todo.seriesId && (
                <span className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400 font-medium" title="반복 할 일">
                  <Repeat size={10} />
                  반복
                </span>
              )}
              {todo.startTime && (
                <span className="flex items-center gap-1 text-[11px] text-leaf-600 dark:text-leaf-400 font-semibold">
                  <Clock size={10} />
                  {todo.startTime}
                </span>
              )}
              {todo.dueDate && (
                <span className={`flex items-center gap-1 text-[11px] font-medium ${
                  isOverdue ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'
                }`}>
                  <Flag size={10} />
                  {format(parseISO(todo.dueDate), 'M/d')} 마감
                </span>
              )}
              {todo.notes && (
                <span className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400 font-medium" title={todo.notes}>
                  <StickyNote size={10} />
                  메모
                </span>
              )}
            </div>
          )}
        </div>

        {/* Delete (실수로 지우지 않도록 한 번 더 확인) */}
        {confirmDelete ? (
          <div className={`flex items-center gap-1 flex-shrink-0 transition-opacity duration-200 ${showDelete ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <button onClick={() => setConfirmDelete(false)}
              className="text-[11px] font-medium px-2 py-1 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 whitespace-nowrap">취소</button>
            <button onClick={() => deleteTodo(todo.id)} aria-label="삭제 확정"
              className="text-[11px] px-2 py-1 rounded-md bg-red-600 hover:bg-red-700 text-white font-semibold whitespace-nowrap">삭제</button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            aria-label="삭제"
            className={`flex-shrink-0 -my-1 w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-150 ${
              showDelete ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {/* Actions row: "오늘로"/"날짜"/"복사" 등 - 제목 줄에 끼워 넣으면 아이콘들과
          비좁게 겹쳐서 위치가 애매했던 문제라, 아이콘 줄과 분리된 자기 줄로 내려서 배치함.
          목록이 너무 커 보이지 않도록 평소엔 접어두고 마우스 올렸을 때만 펼침 */}
      {actions && (
        <div className={`flex flex-wrap items-center gap-1.5 pl-[38px] pr-2.5 overflow-hidden transition-all duration-150 ${
          showDelete ? 'max-h-10 pb-2.5 opacity-100' : 'max-h-0 pb-0 opacity-0'
        }`}>
          {actions}
        </div>
      )}
    </div>
  );
}
