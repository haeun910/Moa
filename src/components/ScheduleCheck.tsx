import { Check } from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { ScheduleItem } from '../types';

// 일정 완료 체크 (동그라미). 손가락으로 누르기 쉽게 보이는 동그라미보다 눌리는 영역을 넓게 잡음
export default function ScheduleCheck({ schedule, size = 'md' }: { schedule: ScheduleItem; size?: 'sm' | 'md' }) {
  const { toggleSchedule } = useApp();
  const box = size === 'sm' ? 'w-4 h-4' : 'w-[18px] h-[18px]';
  return (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); toggleSchedule(schedule.id); }}
      aria-label={schedule.completed ? '일정 완료 취소' : '일정 완료'}
      aria-pressed={schedule.completed}
      className="flex-shrink-0 -m-2 p-2 rounded-full group/check"
    >
      <span className={`${box} rounded-full border-[1.5px] flex items-center justify-center transition-colors ${
        schedule.completed
          ? 'bg-blue-500 border-blue-500 dark:bg-blue-400 dark:border-blue-400'
          : 'border-blue-300 dark:border-blue-700 group-hover/check:border-blue-500'
      }`}>
        {schedule.completed && <Check size={size === 'sm' ? 10 : 11} className="text-white" strokeWidth={3.2} />}
      </span>
    </button>
  );
}
