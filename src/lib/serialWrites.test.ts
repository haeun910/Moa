import { describe, expect, it } from 'vitest';
import { createSerialWriter } from './serialWrites';

const tick = () => new Promise(r => setTimeout(r, 0));

describe('createSerialWriter', () => {
  it('같은 항목의 요청은 앞 요청이 끝난 뒤에 보낸다', async () => {
    const run = createSerialWriter();
    const saved: boolean[] = [];
    const resolvers: (() => void)[] = [];
    const send = (v: boolean) => () => new Promise<void>(res => resolvers.push(() => { saved.push(v); res(); }));

    const a = run('t1', send(true));
    const b = run('t1', send(false));
    await tick();
    expect(resolvers).toHaveLength(1); // 두 번째는 아직 안 보냄
    resolvers[0]();
    await tick();
    expect(resolvers).toHaveLength(2);
    resolvers[1]();
    await Promise.all([a, b]);
    expect(saved).toEqual([true, false]);
  });

  it('다른 항목끼리는 기다리지 않고, 앞 요청이 실패해도 다음 요청은 보낸다', async () => {
    const run = createSerialWriter();
    let other = false;
    const failing = run('t1', () => new Promise<void>((_, rej) => setTimeout(() => rej(new Error('x')), 5)));
    run('t2', async () => { other = true; });
    await tick();
    expect(other).toBe(true);
    const after = run('t1', async () => 'ok');
    await expect(failing).rejects.toThrow('x');
    await expect(after).resolves.toBe('ok');
  });
});
