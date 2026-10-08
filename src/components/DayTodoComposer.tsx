import { useState, useRef, useEffect } from 'react';
import { ArrowUp, SlidersHorizontal, Plus, ChevronRight, ChevronLeft, X, Check } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useApp } from '../context/AppContext';
import type { Category } from '../types';
import { LIMITS } from '../lib/limits';

const LAST_CATEGORY_KEY = 'day-composer-last-category';

function readLastCategory(): string | null {
  try { return localStorage.getItem(LAST_CATEGORY_KEY); } catch { return null; }
}
function writeLastCategory(id: string) {
  try { localStorage.setItem(LAST_CATEGORY_KEY, id); } catch { /* 저장 못 해도 동작에는 지장 없음 */ }
}

interface Props {
  date: string; // YYYY-MM-DD, 홈에서 선택한 날짜
  // 상세 옵션(시간/마감일/반복 등)으로 추가: 지금 고른 카테고리/하위카테고리와 입력 중이던 제목을 그대로 넘김
  onOpenDetail: (categoryId: string | null, subcategoryId: string | null, title: string) => void;
}

// 홈 화면에서 날짜를 고른 뒤 할 일을 추가하는 입력창.
// 패널에는 입력칸 하나만 보이고, 누르면 따로 뜨는 창에서 카테고리 → 하위카테고리 → 제목 순서로 고름.
// (예전엔 패널 아래에 카테고리/하위카테고리 칩이 가로로 줄지어 있어서 좁은 화면에서 고르기 불편했음)
export default function DayTodoComposer({ date, onOpenDetail }: Props) {
  const [open, setOpen] = useState(false);
  const dateLabel = format(parseISO(date), 'M월 d일');

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-2 bg-white dark:bg-gray-900 rounded-xl ring-1 ring-gray-200 dark:ring-gray-700 shadow-lg hover:ring-leaf-400 dark:hover:ring-leaf-600 transition-shadow pl-3.5 pr-1.5 py-1.5 text-left"
      >
        <Plus size={16} className="text-gray-400 flex-shrink-0" />
        <span className="flex-1 min-w-0 text-sm text-gray-400 py-1.5 truncate">{dateLabel}에 할 일 추가</span>
        <span className="btn-primary flex-shrink-0 w-8 h-8" aria-hidden>
          <ArrowUp size={16} strokeWidth={2.4} />
        </span>
      </button>

      {open && (
        <AddTodoSheet
          date={date}
          onClose={() => setOpen(false)}
          onOpenDetail={(catId, subId, title) => { setOpen(false); onOpenDetail(catId, subId, title); }}
        />
      )}
    </>
  );
}

type Step = 'category' | 'subcategory' | 'write';

function AddTodoSheet({ date, onClose, onOpenDetail }: Props & { onClose: () => void }) {
  const { categories, subcategories, addTodo } = useApp();
  const lastCategoryId = readLastCategory();
  // 카테고리가 하나도 없는 사용자는 바로 제목 쓰기로
  const [step, setStep] = useState<Step>(categories.length ? 'category' : 'write');
  const [category, setCategory] = useState<Category | null>(null);
  const [subcategoryId, setSubcategoryId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [added, setAdded] = useState<string[]>([]); // 이 창에서 방금 추가한 할 일 (연달아 추가할 때 확인용)
  const inputRef = useRef<HTMLInputElement>(null);

  const categorySubcats = category ? subcategories.filter(s => s.categoryId === category.id) : [];
  const subcategory = categorySubcats.find(s => s.id === subcategoryId) ?? null;
  const dateLabel = format(parseISO(date), 'M월 d일 EEEE', { locale: ko });

  useEffect(() => {
    if (step === 'write') inputRef.current?.focus();
  }, [step]);

  function pickCategory(cat: Category) {
    setCategory(cat);
    setSubcategoryId(null);
    writeLastCategory(cat.id);
    // 하위카테고리가 없으면 고를 게 없으니 바로 제목 쓰기로
    setStep(subcategories.some(s => s.categoryId === cat.id) ? 'subcategory' : 'write');
  }

  function pickSubcategory(id: string | null) {
    setSubcategoryId(id);
    setStep('write');
  }

  async function handleAdd() {
    const t = title.trim();
    if (!t || saving) return;
    setSaving(true);
    try {
      await addTodo({
        title: t, completed: false,
        categoryId: category?.id ?? null,
        subcategoryId: subcategory?.id ?? null,
        date, startTime: null, notes: '',
      });
      // 같은 카테고리로 연달아 추가하기 쉽도록 창은 열어두고 입력칸만 비움
      setAdded(prev => [...prev, t]);
      setTitle('');
      inputRef.current?.focus();
    } finally { setSaving(false); }
  }

  function goBack() {
    if (step === 'write') setStep(categorySubcats.length ? 'subcategory' : 'category');
    else setStep('category');
  }

  const canGoBack = step !== 'category' && categories.length > 0;
  const heading = step === 'category' ? '어떤 카테고리인가요?' : step === 'subcategory' ? `${category?.name} · 하위 카테고리` : '할 일 추가';
  const rowCls = 'w-full flex items-center gap-3 px-4 min-h-[52px] py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 active:bg-gray-100 dark:active:bg-gray-800 transition-colors';

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-panel max-w-md sm:max-h-[80svh]" onClick={e => e.stopPropagation()} role="dialog" aria-label="할 일 추가">
        {/* 머리글 */}
        <div className="flex-shrink-0 flex items-center gap-1 px-3 pt-4 pb-3 border-b border-gray-100 dark:border-gray-800">
          {canGoBack ? (
            <button onClick={goBack} aria-label="뒤로" className="btn-icon"><ChevronLeft size={18} /></button>
          ) : <span className="w-2" />}
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-gray-900 dark:text-white truncate">{heading}</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">{dateLabel}</p>
          </div>
          <button onClick={onClose} aria-label="닫기" className="btn-icon"><X size={17} /></button>
        </div>

        {/* 1단계: 카테고리 */}
        {step === 'category' && (
          <div className="flex-1 min-h-0 overflow-y-auto py-1 divide-y divide-gray-100 dark:divide-gray-800/80">
            {categories.map(cat => {
              const subCount = subcategories.filter(s => s.categoryId === cat.id).length;
              return (
                <button key={cat.id} onClick={() => pickCategory(cat)} className={rowCls}>
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                  <span className="flex-1 min-w-0 text-[15px] font-medium text-gray-900 dark:text-gray-100 truncate">{cat.name}</span>
                  {cat.id === lastCategoryId && (
                    <span className="flex-shrink-0 text-[10.5px] font-semibold text-leaf-700 dark:text-leaf-300 bg-leaf-50 dark:bg-leaf-900/30 px-1.5 py-px rounded">최근</span>
                  )}
                  {subCount > 0 && <span className="flex-shrink-0 text-xs tabular-nums text-gray-400">하위 {subCount}</span>}
                  <ChevronRight size={16} className="flex-shrink-0 text-gray-300 dark:text-gray-600" />
                </button>
              );
            })}
          </div>
        )}

        {/* 2단계: 하위카테고리 (없으면 건너뜀) */}
        {step === 'subcategory' && category && (
          <div className="flex-1 min-h-0 overflow-y-auto py-1 divide-y divide-gray-100 dark:divide-gray-800/80">
            <button onClick={() => pickSubcategory(null)} className={rowCls}>
              <span className="flex-1 min-w-0 text-[15px] font-medium text-gray-500 dark:text-gray-400">미정 <span className="text-xs font-normal">(하위 카테고리 없이)</span></span>
              <ChevronRight size={16} className="flex-shrink-0 text-gray-300 dark:text-gray-600" />
            </button>
            {categorySubcats.map(sc => (
              <button key={sc.id} onClick={() => pickSubcategory(sc.id)} className={rowCls}>
                <span className="w-1.5 self-stretch rounded-full flex-shrink-0" style={{ backgroundColor: category.color }} />
                <span className="flex-1 min-w-0 text-[15px] font-medium text-gray-900 dark:text-gray-100 truncate">{sc.name}</span>
                <ChevronRight size={16} className="flex-shrink-0 text-gray-300 dark:text-gray-600" />
              </button>
            ))}
          </div>
        )}

        {/* 3단계: 제목 쓰기 */}
        {step === 'write' && (
          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-3">
            {category && (
              <button onClick={() => setStep('category')} title="카테고리 바꾸기"
                className="inline-flex items-center gap-1.5 max-w-full h-7 px-2.5 rounded-full text-xs font-medium ring-1 ring-inset ring-gray-200 dark:ring-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800">
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: category.color }} />
                <span className="truncate">{category.name}{subcategory ? ` › ${subcategory.name}` : ''}</span>
                <span className="text-gray-400 flex-shrink-0">· 바꾸기</span>
              </button>
            )}

            <div className="flex items-center gap-1 bg-white dark:bg-gray-800/60 rounded-xl ring-1 ring-gray-200 dark:ring-gray-700 focus-within:ring-2 focus-within:ring-leaf-500 pl-3 pr-1.5 py-1.5">
              <input maxLength={LIMITS.title}
                ref={inputRef}
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="할 일을 적어주세요"
                className="flex-1 min-w-0 text-[15px] bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none py-1.5"
                onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleAdd(); }}
              />
              <button onClick={handleAdd} disabled={!title.trim() || saving} aria-label="추가" className="btn-primary flex-shrink-0 w-9 h-9">
                <ArrowUp size={17} strokeWidth={2.4} />
              </button>
            </div>

            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-gray-400 dark:text-gray-500">Enter로 추가 · 창은 열려 있어 계속 추가할 수 있어요</p>
              <button
                onClick={() => onOpenDetail(category?.id ?? null, subcategory?.id ?? null, title.trim())}
                title="시간·마감일·반복 등 상세 옵션으로 추가"
                className="btn-secondary flex-shrink-0 h-8 px-2.5 text-xs font-semibold">
                <SlidersHorizontal size={13} />
                상세
              </button>
            </div>

            {added.length > 0 && (
              <ul className="pt-1 space-y-1" aria-label="방금 추가한 할 일">
                {added.map((t, i) => (
                  <li key={i} className="flex items-center gap-2 text-[13px] text-gray-600 dark:text-gray-300">
                    <Check size={13} className="text-leaf-600 dark:text-leaf-400 flex-shrink-0" strokeWidth={2.6} />
                    <span className="truncate">{t}</span>
                  </li>
                ))}
              </ul>
            )}

            <button onClick={onClose} className="w-full h-10 rounded-lg bg-gray-100 dark:bg-gray-800 text-sm font-medium text-gray-600 dark:text-gray-300">
              {added.length ? '완료' : '닫기'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
