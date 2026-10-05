import { Repeat } from 'lucide-react';
import { REPEAT_FREQ_OPTIONS, REPEAT_MAX_OCCURRENCES, defaultRepeatUntil } from '../lib/recurrence';
import type { RepeatFreq, RepeatRule } from '../lib/recurrence';

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

interface Props {
  startDate: string; // 반복 시작일 (할 일/일정의 날짜)
  rule: RepeatRule;
  onChange: (rule: RepeatRule) => void;
  occurrenceCount: number; // 만들어질 개수 미리보기
  itemLabel: string; // "할 일" / "일정"
  accent?: 'leaf' | 'blue';
  convertingExisting?: boolean; // 이미 있는 항목을 반복으로 바꾸는 중 (안내 문구만 다름)
}

// 반복 설정 UI (할 일/일정 공용): 매일/매주/격주/매월 + (매주·격주면) 요일 + 종료일
export default function RepeatPicker({ startDate, rule, onChange, occurrenceCount, itemLabel, accent = 'leaf', convertingExisting = false }: Props) {
  const on = accent === 'blue' ? 'bg-blue-500 border-blue-500 text-white' : 'bg-leaf-600 border-leaf-600 text-white';
  const off = 'bg-transparent border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-400';
  const ring = accent === 'blue' ? 'focus:ring-blue-400' : 'focus:ring-leaf-400';

  function selectFreq(freq: RepeatFreq) {
    if (freq === rule.freq) return;
    const weekdays = (freq === 'weekly' || freq === 'biweekly') && rule.weekdays.length === 0 && startDate
      ? [new Date(`${startDate}T00:00:00`).getDay()]
      : rule.weekdays;
    // 종료일을 아직 안 정했으면 반복 종류에 맞는 기본값을 채워줌
    const until = freq !== 'none' && !rule.until && startDate ? defaultRepeatUntil(startDate, freq) : rule.until;
    onChange({ ...rule, freq, weekdays, until });
  }

  function toggleWeekday(d: number) {
    const has = rule.weekdays.includes(d);
    if (has && rule.weekdays.length === 1) return; // 최소 한 요일은 남김
    onChange({ ...rule, weekdays: has ? rule.weekdays.filter(w => w !== d) : [...rule.weekdays, d].sort() });
  }

  const weekly = rule.freq === 'weekly' || rule.freq === 'biweekly';

  return (
    <div>
      <label className="flex items-center gap-1 text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">
        <Repeat size={11} />
        반복
      </label>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {REPEAT_FREQ_OPTIONS.map(([freq, label]) => (
          <button key={freq} type="button" onClick={() => selectFreq(freq)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${rule.freq === freq ? on : off}`}>
            {label}
          </button>
        ))}
      </div>

      {rule.freq !== 'none' && (
        !startDate ? (
          <p className="text-xs text-amber-500">먼저 날짜를 선택해주세요.</p>
        ) : (
          <div className="space-y-2">
            {weekly && (
              <div className="flex gap-1">
                {WEEKDAY_LABELS.map((label, d) => (
                  <button key={d} type="button" onClick={() => toggleWeekday(d)}
                    className={`flex-1 h-8 rounded-lg text-xs font-semibold border transition-all ${
                      rule.weekdays.includes(d) ? on : `${off} ${d === 0 ? '!text-red-400' : d === 6 ? '!text-blue-400' : ''}`
                    }`}>
                    {label}
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="flex-shrink-0 text-xs text-gray-500 dark:text-gray-400">종료일</span>
              <input
                type="date"
                value={rule.until}
                min={startDate}
                onChange={e => onChange({ ...rule, until: e.target.value })}
                className={`flex-1 min-w-0 px-3 py-2 rounded-lg bg-white dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 shadow-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 ${ring} transition text-sm`}
              />
            </div>
            <p className="text-[11px] text-gray-400">
              {rule.until
                ? occurrenceCount > 0
                  ? convertingExisting
                    ? `종료일까지 반복 날짜는 총 ${occurrenceCount}개예요${occurrenceCount >= REPEAT_MAX_OCCURRENCES ? ` (최대 ${REPEAT_MAX_OCCURRENCES}개)` : ''}. 지금 이 ${itemLabel}은 그대로 두고 나머지 날짜에 새로 만들어서 하나의 반복으로 묶어요.`
                    : `종료일까지 총 ${occurrenceCount}개의 ${itemLabel}이 만들어져요${occurrenceCount >= REPEAT_MAX_OCCURRENCES ? ` (최대 ${REPEAT_MAX_OCCURRENCES}개)` : ''}. 나중에 한 개만, 또는 이후 전체를 한꺼번에 수정·삭제할 수 있어요.`
                  : '종료일까지 해당하는 날짜가 없어요. 요일이나 종료일을 확인해주세요.'
                : '반복을 끝낼 날짜를 선택해주세요.'}
            </p>
          </div>
        )
      )}
    </div>
  );
}
