// Формат данных диалогов. Только типы, без логики.

/** Говорящий. 'narrator' — ремарка рассказчика (курсивом, без плашки имени). */
export type SpeakerId = 'heroine' | 'sailor' | 'captain' | 'guard' | 'narrator';

export interface DialogueLine {
  speaker: SpeakerId;
  /** Текст без подписи говорящего и без ведущего тире. Может содержать {name}. */
  text: string;
}

export interface Dialogue {
  id: string;
  /** Линейный список реплик: показываются по очереди. */
  lines: DialogueLine[];
}
