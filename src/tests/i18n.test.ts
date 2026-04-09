import { describe, expect, it } from 'vitest';
import { resolveLocale } from '../i18n';

describe('resolveLocale', () => {
  it('uses English by default on non-Chinese systems', () => {
    expect(resolveLocale('auto', 'en-US')).toBe('en-US');
  });

  it('uses Chinese automatically on Chinese systems', () => {
    expect(resolveLocale('auto', 'zh-CN')).toBe('zh-CN');
  });

  it('respects manual language selection over system locale', () => {
    expect(resolveLocale('en-US', 'zh-CN')).toBe('en-US');
    expect(resolveLocale('zh-CN', 'en-US')).toBe('zh-CN');
  });
});
