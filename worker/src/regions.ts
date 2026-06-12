import regionsData from "../regions.json";
import type { InlineButton, InlineKeyboard } from "./types";

interface Grid { nx: number; ny: number; }
interface Sido { airkorea: string; sigungu: Record<string, Grid>; }

export const REGIONS = regionsData as unknown as Record<string, Sido>;
export const SIDO_LIST: string[] = Object.keys(REGIONS);

export function sigunguNames(sido: string): string[] {
  return Object.keys(REGIONS[sido].sigungu);
}

function rows(buttons: InlineButton[], cols = 3): InlineButton[][] {
  const out: InlineButton[][] = [];
  for (let i = 0; i < buttons.length; i += cols) {
    out.push(buttons.slice(i, i + cols));
  }
  return out;
}

export function sidoKeyboard(): InlineKeyboard {
  const buttons = SIDO_LIST.map((s, i) => ({ text: s, callback_data: `s:${i}` }));
  return { inline_keyboard: rows(buttons) };
}

export function sigunguKeyboard(sidoIdx: number): InlineKeyboard {
  const sido = SIDO_LIST[sidoIdx];
  if (sido === undefined) throw new RangeError(`잘못된 시도 인덱스: ${sidoIdx}`);
  const buttons = sigunguNames(sido).map((n, j) => ({
    text: n,
    callback_data: `r:${sidoIdx}:${j}`,
  }));
  const kb = rows(buttons);
  kb.push([{ text: "⬅ 뒤로", callback_data: "s:back" }]);
  return { inline_keyboard: kb };
}

export function resolveRegion(sidoIdx: number, sigunguIdx: number): [string, string] {
  const sido = SIDO_LIST[sidoIdx];
  if (sido === undefined) throw new RangeError(`잘못된 시도 인덱스: ${sidoIdx}`);
  const sigungu = sigunguNames(sido)[sigunguIdx];
  if (sigungu === undefined) throw new RangeError(`잘못된 시군구 인덱스: ${sigunguIdx}`);
  return [sido, sigungu];
}
