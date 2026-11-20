import { describe, it, expect } from 'vitest';
import { PROLOGUE_DIALOGUES } from '../src/data/dialogues/prologue';
import { SPEAKERS } from '../src/data/speakers';

const dialogues = Object.values(PROLOGUE_DIALOGUES);

describe('диалоги пролога', () => {
  it('все диалоги содержат хотя бы одну реплику', () => {
    for (const d of dialogues) {
      expect(d.lines.length, d.id).toBeGreaterThan(0);
    }
  });

  it('id совпадает с ключом', () => {
    for (const [key, d] of Object.entries(PROLOGUE_DIALOGUES)) {
      expect(d.id).toBe(key);
    }
  });

  it('все говорящие известны', () => {
    for (const d of dialogues) {
      for (const line of d.lines) {
        expect(Object.keys(SPEAKERS), d.id).toContain(line.speaker);
      }
    }
  });

  it('в тексте нет ведущего тире (подпись показывает UI)', () => {
    for (const d of dialogues) {
      for (const line of d.lines) {
        expect(line.text, `${d.id}: ${line.text}`).not.toMatch(/^\s*[—–-]/);
      }
    }
  });

  it('реплик нет пустых', () => {
    for (const d of dialogues) {
      for (const line of d.lines) {
        expect(line.text.trim(), d.id).not.toBe('');
      }
    }
  });
});
