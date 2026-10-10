import assert from 'node:assert/strict';
import { test } from 'node:test';
import { anySignal, timeoutSignal, within } from '../src/core/signal.ts';

/** Runs `body` as an older Safari would see the page: without the two newer static methods. */
async function withoutBuiltIns(body: () => void | Promise<void>): Promise<void> {
  const target = AbortSignal as unknown as { any?: unknown; timeout?: unknown };
  const saved = { any: target.any, timeout: target.timeout };
  target.any = undefined;
  target.timeout = undefined;
  try {
    await body();
  } finally {
    target.any = saved.any;
    target.timeout = saved.timeout;
  }
}

test('without AbortSignal.any a combined signal fires when either one does, with the reason', async () => {
  await withoutBuiltIns(() => {
    const a = new AbortController();
    const b = new AbortController();
    const both = anySignal([a.signal, b.signal]);
    assert.equal(both.aborted, false);
    b.abort(new Error('second'));
    assert.equal(both.aborted, true);
    assert.equal((both.reason as Error).message, 'second');
    a.abort(new Error('first'));
    assert.equal((both.reason as Error).message, 'second');
  });
});

test('without AbortSignal.any a signal that has already fired gives a fired signal', async () => {
  await withoutBuiltIns(() => {
    const done = AbortSignal.abort(new Error('before'));
    const both = anySignal([new AbortController().signal, done]);
    assert.equal(both.aborted, true);
    assert.equal((both.reason as Error).message, 'before');
  });
});

test('without AbortSignal.timeout the signal fires after the time, as a TimeoutError a request can tell from a cancel', async () => {
  await withoutBuiltIns(async () => {
    const s = timeoutSignal(20);
    assert.equal(s.aborted, false);
    await new Promise((r) => setTimeout(r, 60));
    assert.equal(s.aborted, true);
    assert.equal((s.reason as Error).name, 'TimeoutError');
  });
});

test('within follows the caller and the clock, with or without the built-ins', async () => {
  const run = async () => {
    const caller = new AbortController();
    const s = within(200, caller.signal, undefined);
    assert.equal(s.aborted, false);
    caller.abort();
    assert.equal(s.aborted, true);
    const late = within(20);
    await new Promise((r) => setTimeout(r, 60));
    assert.equal(late.aborted, true);
  };
  await run();
  await withoutBuiltIns(run);
});
