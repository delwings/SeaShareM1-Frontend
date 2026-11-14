import { beforeEach, describe, expect, it } from 'vitest';
import { clearProgress, loadProgress, saveProgress } from './draftProgress.js';

const PROGRESS = {
  portName: 'Marina Magdalena',
  rate: '180000',
  point: { latitude: 11.2408, longitude: -74.199 },
  services: { soundSystem: true, lifeJackets: false },
};

beforeEach(() => globalThis.localStorage.clear());

describe('avance del paso 2', () => {
  it('guarda y recupera lo escrito por usuario y borrador', () => {
    saveProgress('u1', 'b1', PROGRESS);

    expect(loadProgress('u1', 'b1')).toEqual(PROGRESS);
    expect(loadProgress('u1', 'b2')).toBeNull();
    expect(loadProgress('u2', 'b1')).toBeNull();
  });

  it('un avance vacío borra el anterior', () => {
    saveProgress('u1', 'b1', PROGRESS);
    saveProgress('u1', 'b1', { portName: '', rate: '', point: null, services: {} });

    expect(loadProgress('u1', 'b1')).toBeNull();
  });

  it('clearProgress lo elimina', () => {
    saveProgress('u1', 'b1', PROGRESS);
    clearProgress('u1', 'b1');

    expect(loadProgress('u1', 'b1')).toBeNull();
  });

  it('ignora datos dañados y no guarda sin usuario', () => {
    globalThis.localStorage.setItem('seashare.draftProgress.u1.b1', '{no es json');
    expect(loadProgress('u1', 'b1')).toBeNull();

    saveProgress(undefined, 'b1', PROGRESS);
    expect(loadProgress(undefined, 'b1')).toBeNull();
  });

  it('descarta coordenadas inválidas pero conserva el resto', () => {
    globalThis.localStorage.setItem(
      'seashare.draftProgress.u1.b1',
      JSON.stringify({ portName: 'X', rate: '1', point: { latitude: 'a' }, services: {} }),
    );

    expect(loadProgress('u1', 'b1')).toEqual({
      portName: 'X',
      rate: '1',
      point: null,
      services: {},
    });
  });
});
