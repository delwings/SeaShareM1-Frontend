import { vi } from 'vitest';

// En equipos lentos los 1000 ms por defecto de vi.waitFor no alcanzan: se amplía a 5 s.
const waitFor = vi.waitFor.bind(vi);
vi.waitFor = (callback, options) =>
  waitFor(callback, typeof options === 'number' ? options : { timeout: 5000, ...options });
