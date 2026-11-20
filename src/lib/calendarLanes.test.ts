import { describe, expect, it } from 'vitest';
import { weekLanes } from './calendarLanes';

const week = ['2026-11-22', '2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28'];
const ev = (id: string, from: string, to: string) => ({ id, from, to });
const lanes = (items: ReturnType<typeof ev>[]) =>
  weekLanes(week, items, i => [i.from, i.to]).map(s => `${s.item.id}:${s.lane}:${s.startCol}-${s.endCol}${s.continuesBefore ? '<' : ''}${s.continuesAfter ? '>' : ''}`);

describe('weekLanes', () => {
  it('겹치지 않으면 같은 줄', () => {
    expect(lanes([ev('a', '2026-11-22', '2026-11-23'), ev('b', '2026-11-25', '2026-11-26')])).toEqual(['a:0:0-1', 'b:0:3-4']);
  });

  it('겹치면 다음 줄, 빈 줄은 다시 씀', () => {
    expect(lanes([
      ev('a', '2026-11-22', '2026-11-25'),
      ev('b', '2026-11-24', '2026-11-27'),
      ev('c', '2026-11-26', '2026-11-28'),
    ])).toEqual(['a:0:0-3', 'b:1:2-5', 'c:0:4-6']);
  });

  it('같은 날 시작하면 긴 것이 위', () => {
    expect(lanes([ev('short', '2026-11-23', '2026-11-24'), ev('long', '2026-11-23', '2026-11-27')]))
      .toEqual(['long:0:1-5', 'short:1:1-2']);
  });

  it('주를 넘어가면 이어짐 표시, 이 주 칸만큼만', () => {
    expect(lanes([ev('a', '2026-11-20', '2026-11-23'), ev('b', '2026-11-27', '2026-12-02')]))
      .toEqual(['a:0:0-1<', 'b:0:5-6>']);
  });

  it('이 주와 안 겹치면 빠짐', () => {
    expect(lanes([ev('a', '2026-11-01', '2026-11-21'), ev('b', '2026-11-29', '2026-11-30')])).toEqual([]);
  });
});
