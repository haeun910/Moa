import { describe, expect, it } from 'vitest';
import { sanitizeError } from './monitoring';

describe('sanitizeError', () => {
  it('DB 오류는 코드와 메시지만 남기고 details/hint의 행 값은 버린다', () => {
    const out = sanitizeError({
      code: '23514',
      message: 'new row for relation "todos" violates check constraint "todos_title_length"',
      details: 'Failing row contains (abc, 비밀 할 일 제목, ...)',
      hint: null,
    });
    expect(out.message).toBe('23514: new row for relation "…" violates check constraint "todos_title_length"');
    expect(JSON.stringify(out)).not.toContain('비밀');
    expect(Object.keys(out)).not.toContain('details');
  });

  it('메시지에 섞인 행 값과 키 값도 지운다', () => {
    expect(sanitizeError(new Error('Failing row contains (1, 비밀 메모 (중요), x).')).message).toBe('Failing row contains (…).');
    const dup = sanitizeError(new Error('Key (title)=(비밀) already exists.'));
    expect(dup.message).toBe('Key (title)=(…) already exists.');
  });

  it('문자열이나 알 수 없는 값도 Error로 바꾼다', () => {
    expect(sanitizeError('boom').message).toBe('boom');
    expect(sanitizeError(undefined).message).toBe('unknown error');
  });
});
