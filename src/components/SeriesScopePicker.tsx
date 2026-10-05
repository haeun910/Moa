import { Repeat } from 'lucide-react';

// 반복으로 만든 항목을 수정/삭제할 때 적용 범위
export type SeriesScope = 'one' | 'following' | 'all';

const OPTIONS: [SeriesScope, string][] = [
  ['one', '이 항목만'],
  ['following', '이후 모두'],
  ['all', '전체'],
];

interface Props {
  scope: SeriesScope;
  onChange: (scope: SeriesScope) => void;
  seriesCount: number; // 같은 반복에 속한 항목 수
  followingCount: number; // 이 항목 포함 이후 항목 수
  accent?: 'leaf' | 'blue';
}

export default function SeriesScopePicker({ scope, onChange, seriesCount, followingCount, accent = 'leaf' }: Props) {
  const on = accent === 'blue' ? 'bg-blue-500 text-white' : 'bg-leaf-600 text-white';
  const counts: Record<SeriesScope, number> = { one: 1, following: followingCount, all: seriesCount };
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-2.5 space-y-2">
      <p className="flex items-center gap-1 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
        <Repeat size={11} />
        반복 항목이에요 · 저장/삭제를 어디까지 적용할까요?
      </p>
      <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 text-xs font-semibold">
        {OPTIONS.map(([value, label]) => (
          <button key={value} type="button" onClick={() => onChange(value)}
            className={`flex-1 py-1.5 transition-colors ${scope === value ? on : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
            {label} <span className="opacity-70">({counts[value]})</span>
          </button>
        ))}
      </div>
      {scope !== 'one' && (
        <p className="text-[11px] text-gray-400">날짜 변경은 이 항목에만 적용되고, 나머지 내용은 선택한 범위에 모두 적용돼요.</p>
      )}
    </div>
  );
}
