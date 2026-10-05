import { useEffect, useState } from 'react';
import { X, ShieldCheck, Users, Activity, ListChecks, AlertTriangle } from 'lucide-react';
import { fetchAdminStats } from '../lib/db';
import type { AdminStats } from '../lib/supabase';

function StatCard({ value, label, tone }: { value: number | string; label: string; tone: 'leaf' | 'emerald' | 'violet' | 'orange' }) {
  const toneClasses: Record<typeof tone, string> = {
    leaf: 'bg-leaf-50 dark:bg-leaf-900/20 text-leaf-600',
    emerald: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600',
    violet: 'bg-violet-50 dark:bg-violet-900/20 text-violet-600',
    orange: 'bg-orange-50 dark:bg-orange-900/20 text-orange-500',
  };
  return (
    <div className={`rounded-2xl p-4 text-center ${toneClasses[tone]}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">{label}</p>
    </div>
  );
}

export default function AdminStatsModal({ onClose }: { onClose: () => void }) {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchAdminStats();
        if (!cancelled) setStats(data);
      } catch {
        if (!cancelled) setError('통계를 불러오지 못했어요. DB에 get_admin_stats 함수가 아직 없다면 supabase/migrations/004_admin_stats.sql을 Supabase SQL Editor에서 실행해주세요.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const completionRate = stats && stats.totalTodos > 0
    ? Math.round((stats.completedTodos / stats.totalTodos) * 100)
    : 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-panel max-w-lg"
        style={{ maxHeight: '85vh' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 pt-5 pb-4 border-b border-gray-100 dark:border-gray-800 flex-shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-leaf-600" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">관리자 통계</h2>
          </div>
          <button onClick={onClose} aria-label="닫기"
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {loading && (
            <p className="text-center text-sm text-gray-400 py-10">불러오는 중...</p>
          )}

          {!loading && error && (
            <div className="flex flex-col items-center text-center gap-2 py-8">
              <AlertTriangle size={24} className="text-amber-500" />
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{error}</p>
            </div>
          )}

          {!loading && stats && (
            <>
              {/* 가입자 */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Users size={15} className="text-leaf-500" />
                  <p className="text-sm font-bold text-gray-700 dark:text-gray-300">가입자</p>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <StatCard value={stats.totalUsers} label="전체 가입자" tone="leaf" />
                  <StatCard value={stats.newUsersToday} label="오늘 신규" tone="emerald" />
                  <StatCard value={stats.newUsersThisWeek} label="이번 주 신규" tone="violet" />
                </div>
              </div>

              {/* 활성 사용자 */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Activity size={15} className="text-leaf-500" />
                  <p className="text-sm font-bold text-gray-700 dark:text-gray-300">활성 사용자</p>
                  <span className="text-[11px] text-gray-400">할 일·메모를 남긴 사용자</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <StatCard value={stats.activeUsers7d} label="최근 7일" tone="leaf" />
                  <StatCard value={stats.activeUsers30d} label="최근 30일" tone="violet" />
                </div>
              </div>

              {/* 전반적 사용 통계 */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <ListChecks size={15} className="text-leaf-500" />
                  <p className="text-sm font-bold text-gray-700 dark:text-gray-300">전체 사용 통계</p>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <StatCard value={stats.totalTodos} label="전체 할 일" tone="leaf" />
                  <StatCard value={`${completionRate}%`} label="전체 완료율" tone="emerald" />
                  <StatCard value={stats.totalNotes} label="전체 메모" tone="violet" />
                  <StatCard value={stats.totalCategories} label="전체 카테고리" tone="orange" />
                </div>
                <div className="h-2.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full bg-leaf-500 rounded-full transition-all duration-500" style={{ width: `${completionRate}%` }} />
                </div>
              </div>

              <p className="text-[11px] text-gray-300 dark:text-gray-600 text-center pt-1">
                모두 집계된 숫자이며, 다른 사용자의 개인정보나 할 일 내용은 표시되지 않아요.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
