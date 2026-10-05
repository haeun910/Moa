import { useApp } from '../context/AppContext';

interface Props {
  activeCatId: string | null;
  onChange: (id: string | null) => void;
}

const base = 'flex-shrink-0 flex items-center gap-1.5 h-8 px-3 rounded-full text-[13px] font-medium transition-colors';
const idle = 'bg-white dark:bg-gray-900 ring-1 ring-inset ring-gray-200 dark:ring-gray-700 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:ring-gray-300 dark:hover:ring-gray-600';
const active = 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-semibold';

export default function CategoryFilter({ activeCatId, onChange }: Props) {
  const { categories } = useApp();

  return (
    <div className="flex flex-wrap gap-1.5 pb-1">
      <button
        onClick={() => onChange(null)}
        aria-pressed={activeCatId === null}
        className={`${base} ${activeCatId === null ? active : idle}`}
      >
        전체
      </button>
      {categories.map(cat => (
        <button
          key={cat.id}
          onClick={() => onChange(activeCatId === cat.id ? null : cat.id)}
          aria-pressed={activeCatId === cat.id}
          className={`${base} ${activeCatId === cat.id ? active : idle}`}
        >
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
          {cat.name}
        </button>
      ))}
    </div>
  );
}
