import { expect, test } from 'bun:test';
import { createSerializedRunner } from './runner';

test('serialized runner skips overlapping runs', async () => {
  let calls = 0;
  let release!: () => void;
  const firstRun = new Promise<void>((resolve) => {
    release = resolve;
  });
  const runner = createSerializedRunner(async () => {
    calls += 1;
    await firstRun;
  });

  const first = runner();
  const second = runner();
  await Promise.resolve();

  expect(calls).toBe(1);
  await expect(second).resolves.toBe(false);

  release();
  await expect(first).resolves.toBe(true);

  const third = await runner();

  expect(third).toBe(true);
  expect(calls).toBe(2);
});
