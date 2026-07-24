import type { GameData } from "@/types/game";

export class GameDataValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GameDataValidationError";
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateQuestion(value: unknown, path: string): void {
  if (!isObject(value)) {
    throw new GameDataValidationError(`${path} must be an object.`);
  }

  if (typeof value.value !== "number" || Number.isNaN(value.value)) {
    throw new GameDataValidationError(`${path}.value must be a number.`);
  }

  if (typeof value.question !== "string" || !value.question.trim()) {
    throw new GameDataValidationError(`${path}.question must be a non-empty string.`);
  }

  if (typeof value.answer !== "string" || !value.answer.trim()) {
    throw new GameDataValidationError(`${path}.answer must be a non-empty string.`);
  }
}

function validateCategory(value: unknown, index: number): void {
  const path = `categories[${index}]`;

  if (!isObject(value)) {
    throw new GameDataValidationError(`${path} must be an object.`);
  }

  if (typeof value.name !== "string" || !value.name.trim()) {
    throw new GameDataValidationError(`${path}.name must be a non-empty string.`);
  }

  if (!Array.isArray(value.questions) || value.questions.length === 0) {
    throw new GameDataValidationError(`${path}.questions must be a non-empty array.`);
  }

  value.questions.forEach((question, questionIndex) => {
    validateQuestion(question, `${path}.questions[${questionIndex}]`);
  });
}

export function validateGameData(data: unknown): GameData {
  if (!isObject(data)) {
    throw new GameDataValidationError("Root JSON must be an object.");
  }

  if (typeof data.title !== "string" || !data.title.trim()) {
    throw new GameDataValidationError("title must be a non-empty string.");
  }

  if (!Array.isArray(data.categories) || data.categories.length === 0) {
    throw new GameDataValidationError("categories must be a non-empty array.");
  }

  data.categories.forEach((category, index) => {
    validateCategory(category, index);
  });

  return {
    title: data.title.trim(),
    categories: data.categories as GameData["categories"],
  };
}

export async function parseGameFile(file: File): Promise<GameData> {
  const text = await file.text();
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    throw new GameDataValidationError("Invalid JSON file. Please upload valid JSON.");
  }

  return validateGameData(parsed);
}
