import { describe, expect, it } from 'vitest';
import { isValidTimeRange, timeRangeEnd, timeRangeLabel } from './timeRange';

describe('timeRange', () => {
  it('끝 시각: 끝이 있으면 그대로, 없거나 잘못되면 1시간 뒤', () => {
    expect(timeRangeEnd('09:00', '10:30')).toBe(630);
    expect(timeRangeEnd('09:00', null)).toBe(600);
    expect(timeRangeEnd('09:00', '08:00')).toBe(600);
    expect(timeRangeEnd('23:30', null)).toBe(1440);
    expect(timeRangeEnd(null, '10:00')).toBeNull();
  });

  it('끝은 시작보다 늦어야 하고, 시작 없이 끝만 있으면 안 됨', () => {
    expect(isValidTimeRange('09:00', '10:00')).toBe(true);
    expect(isValidTimeRange('09:00', '09:00')).toBe(false);
    expect(isValidTimeRange(null, '10:00')).toBe(false);
    expect(isValidTimeRange('09:00', null)).toBe(true);
  });

  it('보여줄 글자', () => {
    expect(timeRangeLabel('09:00', '10:30')).toBe('09:00~10:30');
    expect(timeRangeLabel('09:00', null)).toBe('09:00');
    expect(timeRangeLabel(null, null)).toBe('');
  });
});
