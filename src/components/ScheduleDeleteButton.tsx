import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import SeriesDeleteChoice from './SeriesDeleteChoice';
import type { ScheduleItem } from '../types';

// 일정 목록의 휴지통 버튼. 반복 일정이면 이것만 / 이후 모두 / 전체 를 고르게 하고, 아니면 바로 지움 (예전 동작 그대로)
export default function ScheduleDeleteButton({ schedule, size = 13, className }: { schedule: ScheduleItem; size?: number; className: string }) {
  const { schedules, deleteSchedule, deleteScheduleSeries } = useApp();
  const [choosing, setChoosing] = useState(false);
  const seriesItems = schedule.seriesId ? schedules.filter(s => s.seriesId === schedule.seriesId) : [];
  const inSeries = seriesItems.length > 1;

  if (choosing && inSeries) {
    return (
      <SeriesDeleteChoice
        seriesCount={seriesItems.length}
        followingCount={seriesItems.filter(s => s.date >= schedule.date).length}
        onCancel={() => setChoosing(false)}
        onDelete={scope => {
          setChoosing(false);
          if (scope === 'one' || !schedule.seriesId) deleteSchedule(schedule.id);
          else deleteScheduleSeries(schedule.seriesId, scope === 'following' ? schedule.date : null);
        }}
      />
    );
  }

  return (
    <button
      onClick={e => { e.stopPropagation(); if (inSeries) setChoosing(true); else deleteSchedule(schedule.id); }}
      aria-label="일정 삭제"
      className={className}
    >
      <Trash2 size={size} />
    </button>
  );
}
