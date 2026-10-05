import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import TodoItem from './TodoItem';
import type { Todo } from '../types';

interface Props {
  todo: Todo;
  onEdit: (todo: Todo) => void;
  actions?: React.ReactNode;
  completeMovesToToday?: boolean;
}

export default function SortableTodoItem({ todo, onEdit, actions, completeMovesToToday }: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: todo.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  // 목록 묶음(TodoRows) 안의 한 줄. 첫/마지막 줄은 묶음의 둥근 모서리를 따라감
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative group/drag bg-white dark:bg-gray-900 first:rounded-t-xl last:rounded-b-xl ${
        isDragging ? 'rounded-xl shadow-xl ring-1 ring-gray-900/5 dark:ring-white/10' : ''
      }`}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute left-0 top-0 bottom-0 w-5 flex items-center justify-center cursor-grab active:cursor-grabbing opacity-0 group-hover/drag:opacity-100 transition-opacity z-10 touch-none"
      >
        <GripVertical size={13} className="text-gray-300 dark:text-gray-600" />
      </div>
      <div className="pl-2">
        <TodoItem todo={todo} onEdit={onEdit} actions={actions} completeMovesToToday={completeMovesToToday} />
      </div>
    </div>
  );
}

// 할 일 여러 줄을 하나의 면으로 묶어서 보여주는 컨테이너 (줄 사이는 얇은 구분선)
export function TodoRows({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-white dark:bg-gray-900 shadow-card dark:shadow-none dark:ring-1 dark:ring-gray-800 divide-y divide-gray-100 dark:divide-gray-800/80">
      {children}
    </div>
  );
}
