import { formatMinutes, parseMinutes } from '../lib/timebox';
import { isValidTimeRange } from '../lib/timeRange';

// 시작 ~ 끝 시간 입력 (할 일·일정 공통). 끝 시간은 선택이고, 없으면 1시간짜리로 보여줌.
// 시작을 바꾸면 끝도 같은 길이만큼 같이 옮겨서 다시 맞출 필요가 없게 함
export default function TimeRangeInput({ start, end, onChange, inputClassName }: {
  start: string;
  end: string;
  onChange: (start: string, end: string) => void;
  inputClassName: string;
}) {
  function changeStart(next: string) {
    const oldStart = parseMinutes(start);
    const oldEnd = parseMinutes(end);
    const newStart = parseMinutes(next);
    if (!next) return onChange('', '');
    if (oldStart !== null && oldEnd !== null && newStart !== null && oldEnd > oldStart) {
      const shifted = newStart + (oldEnd - oldStart);
      return onChange(next, shifted < 24 * 60 ? formatMinutes(shifted) : '');
    }
    onChange(next, end);
  }

  const invalid = !!end && !isValidTimeRange(start, end);
  return (
    <div>
      <div className="flex items-center gap-1.5">
        <input type="time" value={start} onChange={e => changeStart(e.target.value)} aria-label="시작 시간" className={inputClassName} />
        <span className="flex-shrink-0 text-gray-400 text-sm">~</span>
        <input type="time" value={end} onChange={e => onChange(start, e.target.value)} disabled={!start}
          aria-label="끝 시간" aria-invalid={invalid} className={`${inputClassName} disabled:opacity-40`} />
      </div>
      {invalid && <p className="mt-1 text-[11.5px] text-rose-500">끝 시간은 시작 시간보다 늦어야 해요</p>}
    </div>
  );
}
