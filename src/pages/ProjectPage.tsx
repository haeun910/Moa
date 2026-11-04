import { useEffect, useMemo, useState } from 'react';
import type React from 'react';
import { ChevronLeft, ChevronDown, Flag, Plus, Pencil, CalendarDays, Shuffle, Check, AlertCircle, Trash2, Milestone } from 'lucide-react';
import { format, parseISO, differenceInCalendarDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useApp } from '../context/AppContext';
import DDayModal from '../components/DDayModal';
import TodoModal from '../components/TodoModal';
import HelpTip from '../components/HelpTip';
import { GUIDES } from '../data/guides';
import { LIMITS } from '../lib/limits';
import { showToast } from '../lib/toast';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { planTarget, setPlanDday } from '../lib/planNav';
import {
  DEFAULT_PLAN, PLAN_MAX_ITEMS, PLAN_MAX_PER_DAY_OPTIONS, distribute, guessSubcategory, isOpenPlanTodo, isPlannableDDay,
  openLoadByDate, parsePlanLines, planDays, planProgress, planRange, planTodos, spreadLabel,
} from '../lib/plan';
import type { DistributeResult } from '../lib/plan';
import type { DDay, DDayPlan, Todo } from '../types';

// 프로젝트 로드맵: D-Day(시험일·마감일)를 고르고, 준비할 일을 적으면 남은 날짜에 고르게 나눠 줌.
// 나눈 일은 평범한 할 일이라 홈·달력에 그 날짜의 할 일로 보이고, 여기서는 D-Day까지의 흐름을 한눈에 봄.

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const shortDay = (d: string) => format(parseISO(d), 'M월 d일', { locale: ko });
const shortTitle = (t: string) => (t.length > 12 ? `${t.slice(0, 12)}…` : t);
const ddayLabel = (diff: number) => (diff === 0 ? 'D-Day' : diff > 0 ? `D-${diff}` : `D+${-diff}`);

function useToday() {
  return format(new Date(), 'yyyy-MM-dd');
}

export default function ProjectPage() {
  const { ddays, todos, setCurrentScreen } = useApp();
  const todayStr = useToday();
  const [selectedId, setSelectedId] = useState<string | null>(() => planTarget().ddayId);
  const [ddayModal, setDdayModal] = useState<DDay | 'new' | null>(null);

  // 고를 수 있는 D-Day: 다가오는 것(가까운 순) + 지났어도 계획이 남아 있는 것(최근 순)
  const choices = useMemo(() => {
    const planned = new Set(todos.filter(t => t.ddayId).map(t => t.ddayId));
    const list = ddays.filter(isPlannableDDay);
    const upcoming = list.filter(d => d.targetDate >= todayStr).sort((a, b) => a.targetDate.localeCompare(b.targetDate));
    const past = list.filter(d => d.targetDate < todayStr && planned.has(d.id)).sort((a, b) => b.targetDate.localeCompare(a.targetDate));
    return [...upcoming, ...past];
  }, [ddays, todos, todayStr]);
  const selected = choices.find(d => d.id === selectedId) ?? choices[0] ?? null;

  function select(id: string) {
    setSelectedId(id);
    setPlanDday(id);
  }

  return (
    <div className="min-h-screen pb-24 lg:pb-12">
      <div className="max-w-5xl mx-auto px-4 lg:px-8 pt-8 sm:pt-10 pb-4">
        <div className="flex items-center gap-1.5">
          <button onClick={() => setCurrentScreen(planTarget().origin)} aria-label="뒤로 가기" className="btn-icon w-9 h-9 -ml-2">
            <ChevronLeft size={20} />
          </button>
          <h1 className="page-title text-22px">프로젝트 로드맵</h1>
          <HelpTip text={GUIDES.plan} label="프로젝트 로드맵" />
        </div>
        <p className="page-subtitle pl-8">D-Day까지 준비할 일을 날짜별로 나눠요</p>
      </div>

      <div className="max-w-5xl mx-auto px-4 lg:px-8">
        {choices.length === 0 ? (
          <div className="surface rounded-2xl px-6 py-12 text-center">
            <div className="inline-flex w-12 h-12 rounded-2xl items-center justify-center mb-3 bg-rose-50 dark:bg-rose-900/20">
              <Flag size={22} className="text-rose-500" />
            </div>
            <p className="text-15px font-bold text-gray-900 dark:text-white">먼저 D-Day를 정해 주세요</p>
            <p className="text-13px text-gray-500 dark:text-gray-400 mt-1.5 leading-relaxed">
              시험일이나 마감일처럼 목표 날짜를 정하면<br />그날까지 준비할 일을 날짜별로 나눠 드려요.
            </p>
            <button onClick={() => setDdayModal('new')} className="btn-primary h-10 px-4 mt-5"><Plus size={15} />D-Day 추가</button>
          </div>
        ) : (
          <>
            <div className="-mx-4 px-4 lg:mx-0 lg:px-0 flex gap-2 overflow-x-auto no-scrollbar pb-1 mb-4" role="tablist" aria-label="D-Day 고르기">
              {choices.map(d => {
                const active = d.id === selected?.id;
                const diff = differenceInCalendarDays(parseISO(d.targetDate), parseISO(todayStr));
                return (
                  <button key={d.id} role="tab" aria-selected={active} onClick={() => select(d.id)}
                    className={`flex-shrink-0 flex items-center gap-1.5 h-9 px-3.5 rounded-full text-13px transition-colors ${
                      active
                        ? 'bg-leaf-600 text-white font-semibold'
                        : 'bg-white dark:bg-gray-900 ring-1 ring-inset ring-gray-200 dark:ring-gray-700 text-gray-700 dark:text-gray-300 font-medium hover:ring-gray-300 dark:hover:ring-gray-600'
                    }`}>
                    <span className="max-w-[11rem] truncate">{d.title}</span>
                    <span className={`text-11px font-bold tabular-nums ${active ? 'text-white/75' : 'text-gray-400'}`}>{ddayLabel(diff)}</span>
                  </button>
                );
              })}
              <button onClick={() => setDdayModal('new')}
                className="flex-shrink-0 flex items-center gap-1 h-9 px-3.5 rounded-full text-13px font-medium text-gray-500 dark:text-gray-400 border border-dashed border-gray-300 dark:border-gray-600 hover:text-leaf-700 hover:border-leaf-400 dark:hover:text-leaf-300">
                <Plus size={14} />D-Day 추가
              </button>
            </div>
            {selected && <PlanView key={selected.id} dday={selected} onEditDday={() => setDdayModal(selected)} />}
          </>
        )}
      </div>

      {ddayModal && (
        <DDayModal dday={ddayModal === 'new' ? undefined : ddayModal} onClose={() => setDdayModal(null)}
          onCreated={d => select(d.id)} />
      )}
    </div>
  );
}

function PlanView({ dday, onEditDday }: { dday: DDay; onEditDday: () => void }) {
  const { todos, categories, subcategories, addPlanTodos, deleteTodos, updateTodo, moveTodoDates, updateDDay, toggleTodo } = useApp();
  const desktop = useMediaQuery('(min-width: 1024px)');
  const todayStr = useToday();
  const linked = useMemo(() => planTodos(todos, dday.id), [todos, dday.id]);
  const progress = planProgress(linked);
  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
  const diff = differenceInCalendarDays(parseISO(dday.targetDate), parseISO(todayStr));
  const isPast = diff < 0;
  // 다시 나눌 남은 일: 날짜가 있는 것(날짜순) 뒤에 저장소로 뺀 것까지
  const openTodos = linked.filter(isOpenPlanTodo);
  const overdue = openTodos.filter(t => t.date && t.date < todayStr);
  const unfinished = linked.filter(t => !t.completed);

  // 나누는 방법: D-Day에 저장해 둔 것, 없으면 D-Day 이름으로 하위 카테고리를 짐작 ("토익 시험" → 토익)
  const [plan, setPlan] = useState<DDayPlan>(() => {
    const p = dday.plan;
    if (p) {
      const catOk = !!p.categoryId && categories.some(c => c.id === p.categoryId);
      const subOk = catOk && !!p.subcategoryId && subcategories.some(s => s.id === p.subcategoryId && s.categoryId === p.categoryId);
      return { ...DEFAULT_PLAN, ...p, categoryId: catOk ? p.categoryId : null, subcategoryId: subOk ? p.subcategoryId : null };
    }
    const sub = guessSubcategory(dday.title, subcategories);
    return { ...DEFAULT_PLAN, categoryId: sub?.categoryId ?? null, subcategoryId: sub?.id ?? null };
  });
  const [text, setText] = useState('');
  const [startDate, setStartDate] = useState(todayStr);
  const [busy, setBusy] = useState(false);
  const [composerOpen, setComposerOpen] = useState(linked.length === 0);
  const [confirm, setConfirm] = useState<'redistribute' | 'clear' | null>(null);
  const [editing, setEditing] = useState<Todo | null>(null);

  // ── 새로 나누기 ──
  const lines = useMemo(() => parsePlanLines(text, LIMITS.title), [text]);
  const start = startDate && startDate > todayStr ? startDate : todayStr;
  const addRange = planRange(start, dday.targetDate);
  const restKey = plan.restDays.join(',');
  const addDays = useMemo(() => (addRange ? planDays(addRange.from, addRange.to, plan.restDays) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [addRange?.from, addRange?.to, restKey]);
  const tooManyLines = lines.length > PLAN_MAX_ITEMS;
  const addResult: DistributeResult | null = lines.length && !tooManyLines && addRange
    ? distribute(lines.length, addDays, openLoadByDate(linked), plan.maxPerDay) : null;

  async function handleAdd() {
    if (busy || !addRange || !addResult?.ok) return;
    const prevPlan = dday.plan ?? null;
    const prevText = text;
    const range = addRange;
    setBusy(true);
    try {
      const created = await addPlanTodos(dday.id, lines.map((title, i) => ({ title, date: addResult.dates[i] })),
        { categoryId: plan.categoryId, subcategoryId: plan.subcategoryId });
      if (!created) return;
      updateDDay(dday.id, { plan });
      setText('');
      if (!desktop) setComposerOpen(false);
      const ids = created.map(t => t.id);
      showToast(`'${shortTitle(dday.title)}' 준비 할 일 ${ids.length}개를 ${shortDay(range.from)}부터 ${shortDay(range.to)}까지 나눴어요`, 'success', 6000, {
        label: '되돌리기',
        onClick: () => {
          deleteTodos(ids);
          updateDDay(dday.id, { plan: prevPlan });
          setText(prevText);
          setComposerOpen(true);
        },
      });
    } catch {
      // 저장하지 못했다는 알림은 이미 떠 있음. 적은 내용은 그대로 둬서 다시 누를 수 있게 함
    } finally {
      setBusy(false);
    }
  }

  // ── 남은 일 다시 나누기 (오늘부터, 못 한 일이 앞쪽으로) ──
  const redoRange = planRange(todayStr, dday.targetDate);
  const redoDays = useMemo(() => (redoRange ? planDays(redoRange.from, redoRange.to, plan.restDays) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [redoRange?.from, redoRange?.to, restKey]);
  const redoResult: DistributeResult | null = openTodos.length && redoRange ? distribute(openTodos.length, redoDays, {}, plan.maxPerDay) : null;

  async function handleRedistribute() {
    if (busy || !redoRange || !redoResult?.ok) return;
    const moves = openTodos
      .map((t, i) => ({ id: t.id, from: t.date, to: redoResult.dates[i] }))
      .filter(m => m.from !== m.to);
    setBusy(true);
    try {
      // 하나라도 저장에 실패하면 저장 실패 알림만 뜨고(목록은 서버 내용으로 다시 맞춤) 다시 나누기 창은 그대로 둠
      await moveTodoDates(moves.map(m => ({ id: m.id, date: m.to })));
      updateDDay(dday.id, { plan });
      setConfirm(null);
      if (moves.length === 0) showToast('이미 고르게 나뉘어 있어요', 'info');
      else showToast(`'${shortTitle(dday.title)}' 남은 일 ${openTodos.length}개를 오늘부터 다시 나눴어요`, 'success', 6000, {
        label: '되돌리기',
        onClick: () => { moveTodoDates(moves.map(m => ({ id: m.id, date: m.from }))).catch(() => { /* 실패 알림은 이미 뜸 */ }); },
      });
    } catch {
      // 저장하지 못했다는 알림은 이미 떠 있음
    } finally {
      setBusy(false);
    }
  }

  async function handleClear() {
    if (busy || unfinished.length === 0) return;
    const count = unfinished.length;
    setBusy(true);
    try {
      await deleteTodos(unfinished.map(t => t.id));
      setConfirm(null);
      showToast(`'${shortTitle(dday.title)}' 준비 할 일 ${count}개를 지웠어요`, 'info');
    } finally {
      setBusy(false);
    }
  }

  // 날짜별 묶음 (날짜 없는 것은 맨 뒤, planTodos가 이미 정렬함)
  const groups = useMemo(() => {
    const map = new Map<string, Todo[]>();
    for (const t of linked) {
      const k = t.date ?? '';
      map.set(k, [...(map.get(k) ?? []), t]);
    }
    return [...map.entries()];
  }, [linked]);

  const composerVisible = desktop || composerOpen;

  return (
    <>
      {/* ── 요약 ── */}
      <section className="surface rounded-2xl p-4 sm:p-5 mb-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center flex-shrink-0">
            <Flag size={18} className="text-rose-500" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <h2 className="text-base font-bold text-gray-900 dark:text-white truncate">{dday.title}</h2>
              <span className={`flex-shrink-0 text-11px font-bold tabular-nums px-1.5 py-0.5 rounded-md ${
                isPast ? 'bg-gray-100 dark:bg-gray-800 text-gray-400' : diff <= 3 ? 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
              }`}>{ddayLabel(diff)}</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{format(parseISO(dday.targetDate), 'yyyy년 M월 d일 (EEE)', { locale: ko })}</p>
          </div>
          <button onClick={onEditDday} aria-label="D-Day 수정" className="btn-icon -mr-1.5 -mt-1"><Pencil size={15} /></button>
        </div>

        {progress.total > 0 && (
          <div className="mt-4">
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">준비한 일 {progress.done} / {progress.total}</span>
              <span className="text-11px text-gray-400 tabular-nums">{pct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="준비 진행률">
              <div className="h-full rounded-full bg-leaf-500 transition-[width] duration-300" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}

        {isPast && (
          <p className="mt-3 text-12.5px text-gray-500 dark:text-gray-400">지난 D-Day예요. 날짜를 바꾸면 다시 계획을 세울 수 있어요.</p>
        )}

        {!isPast && openTodos.length > 0 && confirm !== 'redistribute' && (
          overdue.length > 0 ? (
            <div className="mt-3 flex items-center gap-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/15 px-3 py-2.5">
              <AlertCircle size={15} className="text-amber-500 flex-shrink-0" />
              <p className="flex-1 min-w-0 text-12.5px text-amber-800 dark:text-amber-200">지난 날짜에 못 한 일이 {overdue.length}개 있어요</p>
              <button onClick={() => setConfirm('redistribute')} className="flex-shrink-0 h-8 px-3 rounded-lg bg-white dark:bg-gray-900 ring-1 ring-inset ring-amber-200 dark:ring-amber-800 text-12.5px font-semibold text-amber-800 dark:text-amber-200 inline-flex items-center gap-1">
                <Shuffle size={13} />다시 나누기
              </button>
            </div>
          ) : (
            <button onClick={() => setConfirm('redistribute')} className="btn-secondary h-8 px-3 mt-3 text-12.5px">
              <Shuffle size={13} />남은 일 다시 나누기
            </button>
          )
        )}

        {confirm === 'redistribute' && redoRange && (
          <div className="mt-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 p-3.5 space-y-3.5">
            <p className="text-13px text-gray-700 dark:text-gray-200 leading-relaxed">
              끝내지 않은 일 <b>{openTodos.length}개</b>를 오늘부터 {shortDay(redoRange.to)}까지 다시 나눠요. 못 한 일이 앞쪽으로 오고, 직접 옮긴 날짜도 새로 정해져요.
            </p>
            <SpreadSettings plan={plan} onChange={setPlan} />
            <ResultLine result={redoResult} days={redoDays} restDays={plan.restDays} maxPerDay={plan.maxPerDay} />
            <div className="flex gap-2">
              <button onClick={() => setConfirm(null)} className="btn-secondary h-10 px-4">취소</button>
              <button onClick={handleRedistribute} disabled={busy || !redoResult?.ok} className="btn-primary flex-1 h-10">
                <Shuffle size={15} />{busy ? '나누는 중…' : '다시 나누기'}
              </button>
            </div>
          </div>
        )}
      </section>

      <div className="lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-6 lg:items-start space-y-4 lg:space-y-0">
        {/* ── 준비할 일 적고 나누기 ── */}
        {!isPast && (
          <section className="surface rounded-2xl">
            {desktop ? (
              <div className="flex items-center gap-2 px-5 pt-4 pb-3">
                <Plus size={15} className="text-leaf-600 dark:text-leaf-400" />
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">{linked.length ? '준비할 일 더하기' : '준비할 일 적기'}</h3>
              </div>
            ) : (
              <button onClick={() => setComposerOpen(v => !v)} aria-expanded={composerOpen}
                className="w-full flex items-center gap-2 px-4 py-3.5 text-left">
                <Plus size={15} className="text-leaf-600 dark:text-leaf-400" />
                <span className="flex-1 text-sm font-bold text-gray-900 dark:text-white">{linked.length ? '준비할 일 더하기' : '준비할 일 적기'}</span>
                <ChevronDown size={16} className={`text-gray-400 transition-transform ${composerOpen ? 'rotate-180' : ''}`} />
              </button>
            )}
            {composerVisible && (
              <div className="px-4 sm:px-5 pb-5 space-y-4">
                <div>
                  <textarea value={text} onChange={e => setText(e.target.value)} maxLength={LIMITS.longText} rows={6}
                    aria-label="준비할 일 (한 줄에 하나씩)"
                    placeholder={'한 줄에 하나씩 적어 주세요\n예) 단어 Day 1~5 외우기\nLC 파트 1·2 문제 풀기\n실전 모의고사 1회'}
                    className="w-full px-3.5 py-3 rounded-xl bg-white dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 text-sm leading-relaxed text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-leaf-500/25 focus:border-leaf-500 resize-y min-h-[136px]" />
                  <p className={`mt-1 text-11.5px text-right tabular-nums ${tooManyLines ? 'text-rose-500 font-semibold' : 'text-gray-400'}`}>
                    {tooManyLines ? `한 번에 ${PLAN_MAX_ITEMS}개까지 나눌 수 있어요 (지금 ${lines.length}개)` : `${lines.length}개`}
                  </p>
                </div>
                <CategoryPicker plan={plan} onChange={setPlan} />
                <SpreadSettings plan={plan} onChange={setPlan} />
                <Field label="시작하는 날">
                  <input type="date" value={startDate} min={todayStr} max={dday.targetDate} aria-label="시작하는 날"
                    onChange={e => setStartDate(e.target.value || todayStr)}
                    className="w-full h-10 px-3 rounded-lg bg-white dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-leaf-500/25 focus:border-leaf-500" />
                </Field>
                {lines.length > 0 && !tooManyLines && (
                  addRange
                    ? <ResultLine result={addResult} days={addDays} restDays={plan.restDays} maxPerDay={plan.maxPerDay} count={lines.length} />
                    : <p className="text-12.5px text-rose-600 dark:text-rose-400">시작하는 날이 D-Day보다 늦어요</p>
                )}
                <button onClick={handleAdd} disabled={busy || !addResult?.ok} className="btn-primary w-full h-11">
                  <Shuffle size={15} />
                  {busy ? '나누는 중…' : lines.length ? `${lines.length}개 날짜에 나누기` : '날짜에 나누기'}
                </button>
              </div>
            )}
          </section>
        )}

        {/* ── 날짜별 흐름 ── */}
        <section className={isPast ? 'lg:col-span-2' : ''}>
          {linked.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 dark:border-gray-800 px-6 py-10 text-center">
              <Milestone size={22} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
              <p className="text-13px text-gray-500 dark:text-gray-400 leading-relaxed">
                준비할 일을 적고 "날짜에 나누기"를 누르면<br />여기에 날짜별로 보여요
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 px-1">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">날짜별 준비</h3>
                <span className="count-pill">{linked.length}</span>
              </div>
              {/* 왼쪽에 날짜, 오른쪽에 그날 할 일. 날짜마다 따로 묶지 않아 길게 늘어지지 않음 */}
              <ol className="surface rounded-2xl divide-y divide-gray-100 dark:divide-gray-800/80 overflow-hidden">
                {groups.map(([date, items]) => {
                  const isToday = date === todayStr;
                  const past = !!date && date < todayStr;
                  return (
                    <li key={date || 'none'} className={`flex gap-2 pl-3 pr-2.5 py-1.5 ${isToday ? 'bg-leaf-50/60 dark:bg-leaf-900/10' : ''}`}>
                      <div className="w-12 flex-shrink-0 pt-2 text-center leading-tight">
                        {date ? (
                          <>
                            <span className={`block text-13px font-bold tabular-nums ${past ? 'text-gray-400 dark:text-gray-500' : 'text-gray-800 dark:text-gray-100'}`}>{format(parseISO(date), 'M.d')}</span>
                            <span className={`block text-10.5px font-semibold mt-0.5 ${isToday ? 'text-leaf-700 dark:text-leaf-300' : 'text-gray-400'}`}>
                              {isToday ? '오늘' : format(parseISO(date), 'EEE', { locale: ko })}
                            </span>
                          </>
                        ) : (
                          <span className="block text-11px font-semibold text-gray-400">날짜<br />없음</span>
                        )}
                      </div>
                      <ul className="flex-1 min-w-0">
                        {items.map(t => (
                          <PlanRow key={t.id} todo={t} todayStr={todayStr} maxDate={dday.targetDate}
                            onToggle={() => toggleTodo(t.id)} onEdit={() => setEditing(t)} onMove={d => updateTodo(t.id, { date: d })} />
                        ))}
                      </ul>
                    </li>
                  );
                })}
                <li className="flex items-center gap-2 pl-3 pr-3.5 py-3 bg-rose-50/70 dark:bg-rose-900/15">
                  <div className="w-12 flex-shrink-0 text-center leading-tight">
                    <span className="block text-13px font-bold tabular-nums text-rose-600 dark:text-rose-400">{format(parseISO(dday.targetDate), 'M.d')}</span>
                    <span className="block text-10.5px font-semibold mt-0.5 text-rose-500">{format(parseISO(dday.targetDate), 'EEE', { locale: ko })}</span>
                  </div>
                  <Flag size={14} className="text-rose-500 flex-shrink-0" />
                  <span className="text-14px font-semibold text-gray-900 dark:text-gray-100 truncate">{dday.title}</span>
                  <span className="ml-auto text-11px font-bold text-rose-500 flex-shrink-0">D-Day</span>
                </li>
              </ol>

              {unfinished.length > 0 && (
                confirm === 'clear' ? (
                  <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 p-3.5">
                    <p className="text-13px text-gray-700 dark:text-gray-200">끝내지 않은 준비 할 일 {unfinished.length}개를 지울까요? 끝낸 일은 남아요. 지우면 되돌릴 수 없어요.</p>
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => setConfirm(null)} className="btn-secondary h-9 px-4">취소</button>
                      <button onClick={handleClear} disabled={busy} className="flex-1 h-9 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold disabled:opacity-40">
                        {unfinished.length}개 지우기
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center">
                    <button onClick={() => setConfirm('clear')} className="inline-flex items-center gap-1 text-12px text-gray-400 hover:text-rose-500 px-2 py-1">
                      <Trash2 size={12} />끝내지 않은 일 모두 지우기
                    </button>
                  </div>
                )
              )}
            </div>
          )}
        </section>
      </div>

      {editing && <TodoModal todo={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function PlanRow({ todo, todayStr, maxDate, onToggle, onEdit, onMove }: {
  todo: Todo; todayStr: string; maxDate: string;
  onToggle: () => void; onEdit: () => void; onMove: (date: string) => void;
}) {
  const late = !todo.completed && !todo.skipped && !!todo.date && todo.date < todayStr;
  return (
    <li className={`flex items-center gap-2.5 py-1.5 ${todo.skipped ? 'opacity-55' : ''}`}>
      <button onClick={onToggle} aria-label={`${todo.title} ${todo.completed ? '완료 취소' : '완료'}`} className="flex-shrink-0 -m-1.5 p-1.5">
        <span className={`w-[18px] h-[18px] rounded-[6px] border-[1.5px] flex items-center justify-center transition-colors ${
          todo.completed ? 'bg-leaf-600 border-leaf-600' : 'border-gray-300 dark:border-gray-600 hover:border-leaf-500'
        }`}>
          {todo.completed && <Check size={12} strokeWidth={3} className="text-white" />}
        </span>
      </button>
      <button onClick={onEdit} className="flex-1 min-w-0 text-left">
        <span className={`block text-14px leading-snug truncate ${todo.completed ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-gray-100'}`}>{todo.title}</span>
        {(late || todo.skipped) && (
          <span className={`block mt-0.5 text-11px font-medium ${late ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400'}`}>
            {late ? '지난 날 못 했어요' : '안 하기로 했어요'}
          </span>
        )}
      </button>
      {!todo.completed && <MoveDateButton value={todo.date} min={todayStr} max={maxDate} onMove={onMove} />}
    </li>
  );
}

// 다른 날짜로 옮기기 (홈·저장소의 "날짜 변경"과 같은 모양)
function MoveDateButton({ value, min, max, onMove }: { value: string | null; min: string; max: string; onMove: (date: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative flex-shrink-0">
      <button onClick={() => setOpen(v => !v)} className="row-action" title="다른 날짜로 옮기기" aria-expanded={open}>
        <CalendarDays size={11} />옮기기
      </button>
      {open && (
        <input type="date" autoFocus defaultValue={value ?? ''} min={min} max={max} aria-label="옮길 날짜"
          className="absolute right-0 top-full mt-1 z-20 text-xs px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 shadow-lg focus:outline-none focus:ring-2 focus:ring-leaf-500/25 focus:border-leaf-500"
          onChange={e => { if (e.target.value) onMove(e.target.value); setOpen(false); }}
          onBlur={() => setOpen(false)} />
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-12.5px font-semibold text-gray-600 dark:text-gray-300 mb-1.5">{label}</p>
      {children}
    </div>
  );
}

// 준비할 요일 + 하루 최대 개수 (새로 나누기와 다시 나누기에 같이 씀)
function SpreadSettings({ plan, onChange }: { plan: DDayPlan; onChange: (next: DDayPlan) => void }) {
  return (
    <div className="space-y-3.5">
      <Field label="준비할 요일">
        <div className="flex gap-1">
          {WEEKDAYS.map((w, i) => {
            const on = !plan.restDays.includes(i);
            return (
              <button key={w} type="button" aria-pressed={on} aria-label={`${w}요일 ${on ? '준비함' : '쉼'}`}
                onClick={() => onChange({ ...plan, restDays: on ? [...plan.restDays, i].sort() : plan.restDays.filter(d => d !== i) })}
                className={`flex-1 max-w-[44px] h-9 rounded-lg text-13px font-semibold transition-colors ${
                  on
                    ? 'bg-leaf-600 text-white'
                    : `bg-white dark:bg-gray-900 ring-1 ring-inset ring-gray-200 dark:ring-gray-700 ${i === 0 ? 'text-rose-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'}`
                }`}>
                {w}
              </button>
            );
          })}
        </div>
      </Field>
      <Field label="하루 최대">
        <select value={plan.maxPerDay ?? ''} aria-label="하루 최대 개수"
          onChange={e => onChange({ ...plan, maxPerDay: e.target.value ? Number(e.target.value) : null })}
          className="w-full h-10 px-3 rounded-lg bg-white dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-leaf-500/25 focus:border-leaf-500">
          <option value="">제한 없음 (고르게 나눔)</option>
          {PLAN_MAX_PER_DAY_OPTIONS.map(n => <option key={n} value={n}>{n}개까지</option>)}
        </select>
      </Field>
    </div>
  );
}

// 나눈 결과 미리 보기 또는 왜 못 나누는지
function ResultLine({ result, days, restDays, maxPerDay, count }: {
  result: DistributeResult | null; days: string[]; restDays: number[]; maxPerDay: number | null; count?: number;
}) {
  if (!result) return null;
  if (!result.ok) {
    const msg = result.reason === 'no-days'
      ? '준비할 요일이 남지 않았어요. 요일을 하나 이상 골라 주세요.'
      : `하루 ${maxPerDay}개로는 다 넣을 수 없어요. 하루 최대를 ${result.needed}개 이상으로 늘리거나 준비할 요일을 늘려 주세요.`;
    return <p className="text-12.5px text-rose-600 dark:text-rose-400 leading-relaxed">{msg}</p>;
  }
  const first = days[0];
  const last = days[days.length - 1];
  return (
    <p className="text-12.5px text-gray-600 dark:text-gray-300 leading-relaxed rounded-lg bg-leaf-50/70 dark:bg-leaf-900/20 px-3 py-2">
      {count ? `${count}개를 ` : ''}{shortDay(first)} ~ {shortDay(last)}{restDays.length ? ', 쉬는 요일 빼고' : ''} {days.length}일에 나눠요 · {spreadLabel(result.dates)}
    </p>
  );
}

// 나눈 할 일을 넣을 카테고리 · 하위 카테고리
function CategoryPicker({ plan, onChange }: { plan: DDayPlan; onChange: (next: DDayPlan) => void }) {
  const { categories, subcategories, addSubcategory } = useApp();
  const subs = plan.categoryId ? subcategories.filter(s => s.categoryId === plan.categoryId) : [];
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [pending, setPending] = useState<string | null>(null);

  // 방금 만든 하위 카테고리가 목록에 들어오면 바로 고름
  useEffect(() => {
    if (!pending || !plan.categoryId) return;
    const made = subcategories.find(s => s.categoryId === plan.categoryId && s.name === pending);
    if (made) {
      onChange({ ...plan, subcategoryId: made.id });
      setPending(null);
    }
  }, [subcategories, pending, plan, onChange]);

  async function create() {
    const name = newName.trim();
    if (!name || !plan.categoryId) return;
    try {
      await addSubcategory(plan.categoryId, name);
      setPending(name);
      setNewName('');
      setAdding(false);
    } catch { /* 실패 알림은 이미 뜸 */ }
  }

  const chip = (active: boolean) => `px-3 h-8 rounded-lg text-xs font-medium border transition-colors ${
    active ? 'bg-leaf-600 border-leaf-600 text-white' : 'bg-transparent border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-400'
  }`;

  return (
    <div className="space-y-3.5">
      <Field label="카테고리">
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => onChange({ ...plan, categoryId: null, subcategoryId: null })} className={chip(plan.categoryId === null)}>없음</button>
          {categories.map(c => (
            <button key={c.id} onClick={() => { onChange({ ...plan, categoryId: c.id, subcategoryId: null }); setAdding(false); }}
              className={`${chip(plan.categoryId === c.id)} inline-flex items-center gap-1.5`}>
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: plan.categoryId === c.id ? 'rgba(255,255,255,0.85)' : c.color }} />
              {c.name}
            </button>
          ))}
        </div>
      </Field>
      {plan.categoryId && (
        <Field label="하위 카테고리">
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => onChange({ ...plan, subcategoryId: null })} className={chip(plan.subcategoryId === null)}>없음</button>
            {subs.map(s => (
              <button key={s.id} onClick={() => onChange({ ...plan, subcategoryId: s.id })} className={chip(plan.subcategoryId === s.id)}>{s.name}</button>
            ))}
            {adding ? (
              <span className="inline-flex items-center gap-1">
                <input autoFocus value={newName} onChange={e => setNewName(e.target.value)} maxLength={LIMITS.subcategoryName} placeholder="이름"
                  aria-label="새 하위 카테고리 이름"
                  onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) create(); if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setAdding(false); } }}
                  onBlur={() => { if (!newName.trim()) setAdding(false); }}
                  className="w-28 h-8 px-2.5 rounded-lg text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-leaf-500/25 focus:border-leaf-500" />
                <button onClick={create} aria-label="만들기" className="w-8 h-8 rounded-lg bg-leaf-600 text-white flex items-center justify-center"><Check size={14} /></button>
              </span>
            ) : (
              <button onClick={() => setAdding(true)}
                className="inline-flex items-center gap-1 px-3 h-8 rounded-lg text-xs font-medium border border-dashed border-gray-300 dark:border-gray-600 text-gray-500 hover:text-leaf-700 hover:border-leaf-400">
                <Plus size={12} />새로 만들기
              </button>
            )}
          </div>
        </Field>
      )}
    </div>
  );
}
