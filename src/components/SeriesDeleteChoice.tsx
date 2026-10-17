import type { SeriesScope } from './SeriesScopePicker';

interface Props {
  seriesCount: number; // 같은 반복에 속한 항목 수
  followingCount: number; // 이 항목 포함 이후 항목 수
  onDelete: (scope: SeriesScope) => void;
  onCancel: () => void;
}

// 반복 항목을 목록에서 바로 지울 때: 이것만 / 이후 모두 / 전체 를 한 번에 고르기
export default function SeriesDeleteChoice({ seriesCount, followingCount, onDelete, onCancel }: Props) {
  const btn = 'text-[11px] px-2 py-1 rounded-md font-semibold whitespace-nowrap';
  return (
    <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
      <button onClick={onCancel} className={`${btn} font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800`}>취소</button>
      <button onClick={() => onDelete('one')} aria-label="이 항목만 삭제"
        className={`${btn} text-red-600 dark:text-red-400 ring-1 ring-inset ring-red-200 dark:ring-red-900/60 hover:bg-red-50 dark:hover:bg-red-900/20`}>이것만</button>
      {followingCount > 1 && followingCount < seriesCount && (
        <button onClick={() => onDelete('following')} aria-label="이후 반복 모두 삭제"
          className={`${btn} text-red-600 dark:text-red-400 ring-1 ring-inset ring-red-200 dark:ring-red-900/60 hover:bg-red-50 dark:hover:bg-red-900/20`}>이후 {followingCount}개</button>
      )}
      <button onClick={() => onDelete('all')} aria-label="반복 전체 삭제"
        className={`${btn} bg-red-600 hover:bg-red-700 text-white`}>전체 {seriesCount}개</button>
    </div>
  );
}
