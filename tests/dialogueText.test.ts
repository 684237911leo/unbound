import { describe, it, expect } from 'vitest';
import {
  substituteName,
  resolveSpeakerLabel,
  resolveLine,
  nextReveal,
  FALLBACK_HERO_NAME,
} from '../src/systems/dialogue/text';

describe('substituteName', () => {
  it('заменяет все {name} на имя героини', () => {
    expect(substituteName('Привет, {name}. Да, {name}.', 'Аня')).toBe('Привет, Аня. Да, Аня.');
  });

  it('оставляет текст без плейсхолдера как есть', () => {
    expect(substituteName('Садись.', 'Аня')).toBe('Садись.');
  });
});

describe('resolveSpeakerLabel', () => {
  it('героиня — имя игрока', () => {
    expect(resolveSpeakerLabel('heroine', 'Аня')).toBe('Аня');
  });

  it('фиксированные подписи для остальных', () => {
    expect(resolveSpeakerLabel('sailor', 'Аня')).toBe('Матрос');
    expect(resolveSpeakerLabel('captain', 'Аня')).toBe('Капитан');
    expect(resolveSpeakerLabel('guard', 'Аня')).toBe('Стражник');
  });

  it('рассказчик — без плашки', () => {
    expect(resolveSpeakerLabel('narrator', 'Аня')).toBeNull();
  });

  it('без имени героини подставляется запасная подпись', () => {
    expect(resolveSpeakerLabel('heroine', '')).toBe(FALLBACK_HERO_NAME);
    expect(resolveSpeakerLabel('heroine', '   ')).toBe(FALLBACK_HERO_NAME);
  });
});

describe('resolveLine', () => {
  it('подставляет имя в текст и подпись', () => {
    expect(resolveLine({ speaker: 'heroine', text: 'Я {name}.' }, 'Аня')).toEqual({
      speaker: 'heroine',
      label: 'Аня',
      text: 'Я Аня.',
    });
  });
});

describe('nextReveal', () => {
  it('открывает ~40 символов в секунду', () => {
    expect(nextReveal(0, 1000, 100)).toBeCloseTo(40);
    expect(nextReveal(0, 250, 100)).toBeCloseTo(10);
  });

  it('не выходит за длину строки', () => {
    expect(nextReveal(38, 1000, 40)).toBe(40);
    expect(nextReveal(40, 1000, 40)).toBe(40);
  });

  it('пустая строка сразу полностью открыта', () => {
    expect(nextReveal(0, 16, 0)).toBe(0);
  });
});
