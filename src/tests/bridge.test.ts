import { describe, expect, it } from 'vitest';
import { BridgeError, unwrapResult } from '../services/bridge';

describe('unwrapResult', () => {
  it('returns data on success', async () => {
    const value = await unwrapResult(Promise.resolve({ ok: true as const, data: 7 }));
    expect(value).toBe(7);
  });

  it('throws BridgeError on failure', async () => {
    await expect(
      unwrapResult(
        Promise.resolve({
          ok: false as const,
          error: { code: 'SAVE_FAILED', message: '保存失败', details: 'detail' }
        })
      )
    ).rejects.toBeInstanceOf(BridgeError);
  });
});
