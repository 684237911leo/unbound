// Утверждённые диалоги пролога (GAME_DESIGN.md §3), дословно.
// Ремарки в курсиве в GDD — реплики 'narrator'. Ведущее «— » убрано: подпись показывает UI.
import type { Dialogue } from '../../systems/dialogue/types';

export const PROLOGUE_DIALOGUES = {
  // Сцена 1. Палуба
  deck_summons: {
    id: 'deck_summons',
    lines: [
      { speaker: 'sailor', text: 'Капитан вызывает тебя.' },
      { speaker: 'heroine', text: 'Передай, что я занята.' },
      { speaker: 'sailor', text: 'Он сказал, что это приказ.' },
      { speaker: 'heroine', text: 'Как трогательно. А я думала, он уже научился разговаривать без приказов.' },
      { speaker: 'sailor', text: 'Не заставляй меня повторять.' },
      { speaker: 'heroine', text: 'Тогда не повторяй.' },
    ],
  },
  // Сцена 2. Каюта капитана (до «Стража!»)
  cabin_talk: {
    id: 'cabin_talk',
    lines: [
      { speaker: 'captain', text: 'Наконец-то.' },
      { speaker: 'heroine', text: 'Не знала, что ты так скучал.' },
      { speaker: 'captain', text: 'Садись.' },
      { speaker: 'heroine', text: 'Я предпочитаю стоять.' },
      { speaker: 'captain', text: 'Ты слишком много себе позволяешь.' },
      { speaker: 'heroine', text: 'А ты слишком часто путаешь просьбу с приказом.' },
      { speaker: 'captain', text: 'Завтра мы прибываем в порт. У меня есть для тебя работа.' },
      { speaker: 'heroine', text: 'Какая неожиданность.' },
      { speaker: 'captain', text: 'Отправишься с людьми на берег. Заберёшь груз и доставишь его покупателю.' },
      { speaker: 'heroine', text: 'Найди кого-нибудь другого.' },
      { speaker: 'captain', text: 'Ты не поняла. Это не предложение.' },
      { speaker: 'heroine', text: 'Тогда ответ тебе не понравится.' },
      { speaker: 'captain', text: 'Я дал тебе место на своём корабле. Кормил тебя. Защищал. А ты решила, что можешь выбирать?' },
      { speaker: 'heroine', text: 'Я решила, что могу уйти.' },
      { speaker: 'captain', text: 'С моего корабля не уходят. Здесь либо служат, либо падают за борт.' },
      { speaker: 'heroine', text: 'Знаешь, в чём твоя проблема?' },
      { speaker: 'captain', text: 'Просвети меня.' },
      { speaker: 'heroine', text: 'Ты слишком долго живёшь среди людей, которые боятся тебе перечить.' },
      { speaker: 'captain', text: 'Стража!' },
    ],
  },
  // Сцена 2. После входа стражи
  cabin_guards: {
    id: 'cabin_guards',
    lines: [
      { speaker: 'narrator', text: 'Двое матросов входят в каюту.' },
      { speaker: 'captain', text: 'Заприте её до утра. Завтра она вспомнит своё место.' },
      { speaker: 'heroine', text: 'Кажется, ты так и не понял.' },
      { speaker: 'captain', text: 'Что именно?' },
      { speaker: 'heroine', text: 'Я больше не собираюсь здесь оставаться.' },
    ],
  },
  // Сцена 3. Схватка: реплики капитана, повергнутого героиней
  captain_death: {
    id: 'captain_death',
    lines: [
      { speaker: 'captain', text: 'Ты... думаешь... что свободна?' },
      { speaker: 'heroine', text: 'Нет. Но теперь у меня есть шанс.' },
      { speaker: 'narrator', text: 'Капитан умирает.' },
      { speaker: 'heroine', text: 'Надо было просто отпустить.' },
    ],
  },
  // Сцена 4. Сундук
  chest_loot: {
    id: 'chest_loot',
    lines: [{ speaker: 'heroine', text: 'Ну хоть что-то полезное от тебя осталось.' }],
  },
  // Сцена 5. Уход
  morning_leave: {
    id: 'morning_leave',
    lines: [
      { speaker: 'sailor', text: 'Ты куда собралась?' },
      { speaker: 'heroine', text: 'На берег.' },
      { speaker: 'sailor', text: 'И всё?' },
      { speaker: 'heroine', text: 'А что ещё?' },
      { speaker: 'sailor', text: 'Ты убила капитана. Теперь корабль твой.' },
      { speaker: 'heroine', text: 'Мне не нужен его корабль.' },
      { speaker: 'sailor', text: 'Тогда чего ты хочешь?' },
      { speaker: 'heroine', text: 'Своего.' },
    ],
  },
} satisfies Record<string, Dialogue>;

export type PrologueId = keyof typeof PROLOGUE_DIALOGUES;
