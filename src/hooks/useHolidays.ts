import { useEffect, useState } from 'react';
import { getHolidayPreset } from '@hyunbinseo/holidays-kr';
import { useApp } from '../context/AppContext';

// 한국 공휴일 (관보·월력요항 기준 데이터). 연도별로 필요할 때만 불러와 저장해 둠.
// 데이터가 아직 없는 해(먼 미래)는 빈 목록으로 둠
export type HolidayMap = Record<string, readonly string[]>;

const cache = new Map<string, HolidayMap>();
const pending = new Map<string, Promise<HolidayMap>>();

function loadYear(year: string): Promise<HolidayMap> {
  const hit = cache.get(year);
  if (hit) return Promise.resolve(hit);
  let p = pending.get(year);
  if (!p) {
    p = getHolidayPreset(year)
      .then(preset => preset as HolidayMap, () => ({}))
      .then(map => { cache.set(year, map); pending.delete(year); return map; });
    pending.set(year, p);
  }
  return p;
}

function merged(years: string[]): HolidayMap {
  return Object.assign({}, ...years.map(y => cache.get(y) ?? {}));
}

// fromKey~toKey(YYYY-MM-DD)가 걸친 해의 공휴일. 설정에서 공휴일 표시를 끄면 빈 목록
export function useHolidays(fromKey: string, toKey: string): HolidayMap {
  const { settings } = useApp();
  const enabled = settings.showHolidays;
  const from = Number(fromKey.slice(0, 4));
  const to = Number(toKey.slice(0, 4));
  const yearsKey = Array.from({ length: Math.max(1, to - from + 1) }, (_, i) => String(from + i)).join(',');
  const [, setLoaded] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const years = yearsKey.split(',');
    if (years.every(y => cache.has(y))) return;
    Promise.all(years.map(loadYear)).then(() => { if (alive) setLoaded(n => n + 1); });
    return () => { alive = false; };
  }, [enabled, yearsKey]);

  return enabled ? merged(yearsKey.split(',')) : {};
}

// "대체공휴일(3ㆍ1절)"처럼 여러 이름이 붙은 날은 이어서 보여줌
export function holidayLabel(map: HolidayMap, dateKey: string): string | null {
  const names = map[dateKey];
  return names && names.length ? names.join(', ') : null;
}
