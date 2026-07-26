export interface Question {
  value: number;
  question: string;
  answer: string;
}

export interface Category {
  name: string;
  questions: Question[];
}

export interface GameData {
  title: string;
  categories: Category[];
}

export interface Team {
  id: string;
  name: string;
  score: number;
  /** Optional accent for tournament UI / buzzers */
  color?: string;
  colorEmoji?: string;
}

export interface ActiveQuestion {
  categoryIndex: number;
  questionIndex: number;
  question: Question;
}

export type TileKey = `${number}-${number}`;

export function getTileKey(categoryIndex: number, questionIndex: number): TileKey {
  return `${categoryIndex}-${questionIndex}`;
}
