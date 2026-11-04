import { useCallback, useEffect, useState } from 'react';
import type React from 'react';
import { X, RefreshCw, AlertTriangle } from 'lucide-react';
import { fetchAdminStats } from '../lib/db';
import type { AdminDailyStat, AdminFeatureUsage, AdminStats } from '../lib/supabase';
import { useEscapeKey } from '../hooks/useEscapeKey';

const num = (n: number | undefined) => (n ?? 0).toLocaleString('ko-KR');
const pct = (part: number | undefined, whole: number | undefined) =>
  whole && whole > 0 ? Math.round(((part ?? 0) / whole) * 100) : 0;
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const dayLabel = (day: string) => {
  const d = new Date(`${day}T00:00:00`);
  return `${d.getMonth() + 1}/${d.getDate()} (${WEEKDAYS[d.getDay()]})`;
};

// 큰 숫자 하나 (라벨 · 숫자 · 보조 설명)
function Kpi({ label, value, unit = '명', sub }: { label: string; value: number | string; unit?: string; sub?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 px-3.5 py-3">
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight text-gray-900 dark:text-white tabular-nums">
        {typeof value === 'number' ? num(value) : value}
        <span className="ml-0.5 text-sm font-semibold text-gray-400">{unit}</span>
      </p>
      {sub && <p className="mt-0.5 text-11px text-gray-400 dark:text-gray-500 leading-snug">{sub}</p>}
    </div>
  );
}

function Section({ title, hint, right, children }: { title: string; hint?: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-end justify-between gap-3 mb-2.5">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">{title}</h3>
          {hint && <p className="text-11px text-gray-400 dark:text-gray-500 mt-0.5">{hint}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

// ── 최근 14일 추이: 한 번에 한 가지 숫자만 막대로 ──
type TrendMetric = 'signups' | 'guests' | 'active';
const TREND_OPTIONS: [TrendMetric, string][] = [
  ['active', '사용자'],
  ['signups', '회원가입'],
  ['guests', '체험 시작'],
];

function TrendChart({ daily }: { daily: AdminDailyStat[] }) {
  const [metric, setMetric] = useState<TrendMetric>('active');
  const [hover, setHover] = useState<number | null>(null);
  const values = daily.map(d => d[metric]);
  const max = Math.max(1, ...values);
  const total = values.reduce((a, b) => a + b, 0);
  const label = TREND_OPTIONS.find(([m]) => m === metric)![1];
  const focused = hover != null ? daily[hover] : null;

  return (
    <Section
      title="최근 14일"
      right={
        <div role="tablist" aria-label="추이 기준" className="flex rounded-lg bg-gray-100 dark:bg-gray-800 p-0.5 text-xs font-semibold">
          {TREND_OPTIONS.map(([m, l]) => (
            <button key={m} role="tab" aria-selected={metric === m} onClick={() => { setMetric(m); setHover(null); }}
              className={`px-2.5 py-1 rounded-md transition-colors ${metric === m ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>
              {l}
            </button>
          ))}
        </div>
      }
    >
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-3.5">
        {/* 읽기 줄: 막대에 올리거나 누르면 그날 숫자, 아니면 14일 합계 */}
        <p className="text-xs text-gray-500 dark:text-gray-400 h-4 mb-3 tabular-nums" aria-live="polite">
          {focused
            ? <><span className="font-semibold text-gray-900 dark:text-white">{dayLabel(focused.day)}</span> · {label} {num(focused[metric])}명</>
            : <>{metric === 'active' ? '하루 평균' : '14일 합계'} <span className="font-semibold text-gray-900 dark:text-white">{metric === 'active' ? num(Math.round(total / Math.max(1, daily.length))) : num(total)}명</span> · 하루 최대 {num(max === 1 && total === 0 ? 0 : max)}명</>}
        </p>
        <div className="relative h-28" onMouseLeave={() => setHover(null)}>
          {/* 최대값 눈금 */}
          <div className="absolute inset-x-0 top-0 border-t border-dashed border-gray-200 dark:border-gray-800" aria-hidden />
          <div className="absolute inset-0 flex items-end gap-[2px] border-b border-gray-300 dark:border-gray-700">
            {daily.map((d, i) => {
              const v = d[metric];
              const on = hover === i;
              return (
                <button key={d.day} type="button"
                  aria-label={`${dayLabel(d.day)} ${label} ${v}명`}
                  onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onClick={() => setHover(i)}
                  className="flex-1 h-full flex items-end focus:outline-none">
                  <span
                    className={`w-full rounded-t-[4px] transition-colors ${on ? 'bg-gray-900 dark:bg-white' : 'bg-gray-700 dark:bg-gray-300'} ${hover != null && !on ? 'opacity-40' : ''}`}
                    style={{ height: v > 0 ? `${Math.max(3, (v / max) * 100)}%` : 0 }} />
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex justify-between mt-1.5 text-10.5px text-gray-400 tabular-nums">
          <span>{dayLabel(daily[0].day)}</span>
          <span>{dayLabel(daily[7].day)}</span>
          <span className="font-semibold text-gray-600 dark:text-gray-300">오늘</span>
        </div>
      </div>
    </Section>
  );
}

// ── 기능별 사용자 (최근 30일) ──
const FEATURES: [keyof AdminFeatureUsage, string][] = [
  ['todos', '할 일'],
  ['schedules', '일정'],
  ['timeblocks', '타임박스'],
  ['notes', '메모'],
  ['ddays', 'D-Day'],
  ['goals', '이번 달 목표'],
];

function FeatureBars({ features, mau }: { features: AdminFeatureUsage; mau: number }) {
  return (
    <Section title="기능별 사용" hint="최근 30일에 그 기능으로 기록을 남긴 사용자 · 비율은 30일 사용자 대비">
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 px-3.5 py-3 space-y-2.5">
        {FEATURES.map(([key, label]) => {
          const v = features[key] ?? 0;
          const p = pct(v, mau);
          return (
            <div key={key} className="flex items-center gap-3">
              <span className="w-[72px] flex-shrink-0 text-xs text-gray-600 dark:text-gray-300">{label}</span>
              <div className="flex-1 h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                <div className="h-full rounded-full bg-gray-700 dark:bg-gray-300 transition-[width] duration-500" style={{ width: `${p}%` }} />
              </div>
              <span className="w-[84px] flex-shrink-0 text-right text-xs tabular-nums text-gray-900 dark:text-white font-semibold">
                {num(v)}명 <span className="font-normal text-gray-400">{p}%</span>
              </span>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

// 작은 숫자 줄 (라벨 ··· 값)
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 text-13px">
      <span className="text-gray-600 dark:text-gray-300">{label}</span>
      <span className="text-right tabular-nums font-semibold text-gray-900 dark:text-white">{children}</span>
    </div>
  );
}

function V2View({ s }: { s: AdminStats }) {
  const registered = s.registeredUsers ?? 0;
  const google = s.googleUsers ?? 0;
  const completion = pct(s.completedTodos, s.totalTodos);
  const retention = s.cohortSize ? `${pct(s.cohortRetained, s.cohortSize)}%` : '—';
  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <Kpi label="회원" value={registered} sub={`오늘 +${num(s.newUsersToday)} · 7일 +${num(s.newUsersThisWeek)}`} />
        <Kpi label="오늘 사용자" value={s.activeUsersToday ?? 0} sub={`최근 7일 ${num(s.activeUsers7d)}명`} />
        <Kpi label="30일 사용자" value={s.activeUsers30d} sub={`전체 계정의 ${pct(s.activeUsers30d, s.totalUsers)}%`} />
        <Kpi label="체험 계정" value={s.guestUsers ?? 0} sub={`오늘 +${num(s.newGuestsToday)} · 7일 +${num(s.newGuests7d)}`} />
      </div>

      {s.daily && s.daily.length === 14 && <TrendChart daily={s.daily} />}

      {s.features && <FeatureBars features={s.features} mau={s.activeUsers30d} />}

      <div className="grid sm:grid-cols-2 gap-5">
        <Section title="회원">
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 px-3.5 divide-y divide-gray-100 dark:divide-gray-800">
            <Row label="구글로 가입">{num(google)}명 <span className="font-normal text-gray-400">{pct(google, registered)}%</span></Row>
            <Row label="이메일로 가입">{num(registered - google)}명 <span className="font-normal text-gray-400">{pct(registered - google, registered)}%</span></Row>
            <Row label="최근 30일 가입">{num(s.newUsers30d)}명</Row>
            <Row label="지난주 가입자 재방문">
              {retention}
              {!!s.cohortSize && <span className="font-normal text-gray-400"> {num(s.cohortRetained)}/{num(s.cohortSize)}명</span>}
            </Row>
          </div>
        </Section>
        <Section title="누적 기록">
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 px-3.5 divide-y divide-gray-100 dark:divide-gray-800">
            <Row label="할 일">{num(s.totalTodos)}개 <span className="font-normal text-gray-400">완료 {completion}%</span></Row>
            <Row label="일정 · 타임박스">{num(s.totalSchedules)} · {num(s.totalTimeblocks)}개</Row>
            <Row label="메모 · D-Day">{num(s.totalNotes)} · {num(s.totalDdays)}개</Row>
            <Row label="카테고리">{num(s.totalCategories)}개</Row>
          </div>
        </Section>
      </div>

      <Section title="그 밖에">
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 px-3.5 divide-y divide-gray-100 dark:divide-gray-800">
          <Row label="받은 의견">{num(s.feedbackTotal)}개 <span className="font-normal text-gray-400">최근 7일 {num(s.feedback7d)}개</span></Row>
          <Row label="푸시 알림을 켠 사용자">{num(s.pushUsers)}명</Row>
          <Row label="메뉴에서 숨긴 사용자">
            <span className="font-normal text-gray-400">타임박스</span> {num(s.hiddenFeatures?.timebox)}
            <span className="font-normal text-gray-400"> · 저장소</span> {num(s.hiddenFeatures?.all)}
            <span className="font-normal text-gray-400"> · 메모</span> {num(s.hiddenFeatures?.notes)}
          </Row>
        </div>
      </Section>
    </>
  );
}

// 023 SQL을 아직 실행하지 않았을 때 (예전 숫자만)
function LegacyView({ s }: { s: AdminStats }) {
  return (
    <>
      <div className="rounded-xl bg-gray-50 dark:bg-gray-800/60 px-3.5 py-3 text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
        최근 14일 추이, 기능별 사용, 회원/체험 구분을 보려면 Supabase SQL Editor에서 <code className="font-mono">023_admin_stats_v2.sql</code>을 실행해주세요.
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <Kpi label="전체 계정" value={s.totalUsers} sub="체험 계정 포함" />
        <Kpi label="이번 주 신규" value={s.newUsersThisWeek} sub={`오늘 +${num(s.newUsersToday)}`} />
        <Kpi label="7일 사용자" value={s.activeUsers7d} />
        <Kpi label="30일 사용자" value={s.activeUsers30d} />
      </div>
      <Section title="누적 기록">
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 px-3.5 divide-y divide-gray-100 dark:divide-gray-800">
          <Row label="할 일">{num(s.totalTodos)}개 <span className="font-normal text-gray-400">완료 {pct(s.completedTodos, s.totalTodos)}%</span></Row>
          <Row label="메모">{num(s.totalNotes)}개</Row>
          <Row label="카테고리">{num(s.totalCategories)}개</Row>
        </div>
      </Section>
    </>
  );
}

export default function AdminStatsModal({ onClose }: { onClose: () => void }) {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setStats(await fetchAdminStats());
      setLoadedAt(new Date());
    } catch {
      setError('통계를 불러오지 못했어요. DB에 get_admin_stats 함수가 아직 없다면 supabase/migrations/023_admin_stats_v2.sql을 Supabase SQL Editor에서 실행해주세요.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // 처음 열 때 한 번 불러옴
    void load();
  }, [load]);

  useEscapeKey(onClose);

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="admin-stats-title" className="modal-panel sm:max-w-2xl h-[90svh] sm:h-[min(860px,90svh)]">
        <div className="sm:hidden mx-auto mt-2 w-9 h-1 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0" aria-hidden />
        <div className="flex-shrink-0 flex items-center justify-between gap-3 px-5 sm:px-6 pt-4 sm:pt-5 pb-3 border-b border-gray-100 dark:border-gray-800">
          <div className="min-w-0">
            <h2 id="admin-stats-title" className="text-lg font-bold text-gray-900 dark:text-white">관리자 통계</h2>
            <p className="text-11px text-gray-400 dark:text-gray-500 mt-0.5">
              한국 시간 기준{loadedAt && ` · ${loadedAt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}에 불러옴`}
            </p>
          </div>
          <div className="flex items-center gap-1 -mr-1.5">
            <button onClick={() => void load()} disabled={loading} aria-label="새로고침" className="btn-icon disabled:opacity-40">
              <RefreshCw size={16} className={loading ? 'animate-spin motion-reduce:animate-none' : ''} />
            </button>
            <button onClick={onClose} aria-label="닫기" className="btn-icon"><X size={18} /></button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 sm:px-6 py-5 space-y-6">
          {loading && !stats && (
            <p className="text-center text-sm text-gray-400 py-10">불러오는 중...</p>
          )}

          {!loading && error && (
            <div className="flex flex-col items-center text-center gap-2 py-8">
              <AlertTriangle size={24} className="text-gray-500 dark:text-gray-400" />
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{error}</p>
            </div>
          )}

          {stats && !error && (
            <>
              {stats.version && stats.version >= 2 ? <V2View s={stats} /> : <LegacyView s={stats} />}
              <p className="text-11px text-gray-400 dark:text-gray-500 text-center">
                집계된 숫자만 보여요. 다른 사용자의 이메일이나 기록 내용은 표시되지 않아요.
                <br />
                사용자 = 할 일·일정·타임박스·메모·D-Day·목표를 남기거나 고친 사람
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
