import { md5, timingSafeEqual } from './md5.util';

describe('md5', () => {
  it('returns lowercase hex string of correct length', () => {
    expect(md5('hello')).toHaveLength(32);
    expect(md5('hello')).toMatch(/^[0-9a-f]+$/);
  });

  it('produces known MD5 hash', () => {
    expect(md5('hello')).toBe('5d41402abc4b2a76b9719d911017c592');
  });

  it('empty string has known hash', () => {
    expect(md5('')).toBe('d41d8cd98f00b204e9800998ecf8427e');
  });

  it('is deterministic', () => {
    expect(md5('test-key')).toBe(md5('test-key'));
  });
});

describe('timingSafeEqual', () => {
  it('returns true for equal strings', () => {
    expect(timingSafeEqual('abc123', 'abc123')).toBe(true);
  });

  it('returns false for different strings of same length', () => {
    expect(timingSafeEqual('abc123', 'abc124')).toBe(false);
  });

  it('returns false for strings of different length', () => {
    expect(timingSafeEqual('abc', 'abcd')).toBe(false);
  });

  it('returns true for empty strings', () => {
    expect(timingSafeEqual('', '')).toBe(true);
  });

  it('returns false for one empty one not', () => {
    expect(timingSafeEqual('', 'a')).toBe(false);
  });
});
