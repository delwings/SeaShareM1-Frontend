import { describe, expect, it } from 'vitest';
import { API_URLS, resolveApiBaseUrl } from './config.js';

describe('resolveApiBaseUrl', () => {
  it('usa la dirección local en localhost', () => {
    expect(resolveApiBaseUrl('localhost')).toBe(API_URLS.local);
  });

  it('usa la dirección local en 127.0.0.1 (Live Server)', () => {
    expect(resolveApiBaseUrl('127.0.0.1')).toBe(API_URLS.local);
  });

  it('usa la dirección desplegada en cualquier otro lugar', () => {
    expect(resolveApiBaseUrl('seashare.vercel.app')).toBe(API_URLS.deployed);
  });
});
