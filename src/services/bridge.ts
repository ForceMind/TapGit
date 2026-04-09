import { Result } from '../shared/contracts';

export class BridgeError extends Error {
  code: string;
  details?: string;

  constructor(code: string, message: string, details?: string) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

export function getBridge() {
  if (!window.tapgit) {
    throw new BridgeError(
      'BRIDGE_NOT_AVAILABLE',
      'Desktop bridge unavailable. Run this inside the desktop app.'
    );
  }
  return window.tapgit;
}

export async function unwrapResult<T>(promise: Promise<Result<T>>) {
  const result = await promise;
  if (!result.ok) {
    throw new BridgeError(result.error.code, result.error.message, result.error.details);
  }
  return result.data;
}
