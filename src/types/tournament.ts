import type { ActiveQuestion, GameData, Team, TileKey } from "@/types/game";

export const ROOM_IDS = ["ROOM-1", "ROOM-2", "ROOM-3", "ROOM-4"] as const;
export type RoomId = (typeof ROOM_IDS)[number];

export function isRoomId(value: string): value is RoomId {
  return (ROOM_IDS as readonly string[]).includes(value);
}

export interface TournamentTeam extends Team {
  /** Hex color for badges / UI accents */
  color: string;
  /** Short Georgian color label (e.g. ლურჯი) */
  colorLabelKa: string;
  /** Emoji swatch for headers */
  colorEmoji: string;
}

export interface RoomState {
  id: RoomId;
  /** 1-based display index */
  number: number;
  labelKa: string;
  teamIds: [string, string];
  usedTiles: Set<TileKey>;
  activeQuestion: ActiveQuestion | null;
  isAnswerRevealed: boolean;
  isWinnerModalOpen: boolean;
  celebrationPlayed: boolean;
}

export const DEFAULT_TEAM_PRESETS: Array<
  Omit<TournamentTeam, "id" | "score">
> = [
  {
    name: "ფალავნები",
    color: "#3B82F6",
    colorLabelKa: "ლურჯი",
    colorEmoji: "🔵",
  },
  {
    name: "არწივები",
    color: "#22C55E",
    colorLabelKa: "მწვანე",
    colorEmoji: "🟢",
  },
  {
    name: "ვეფხვები",
    color: "#F59E0B",
    colorLabelKa: "ყვითელი",
    colorEmoji: "🟡",
  },
  {
    name: "მგლები",
    color: "#EF4444",
    colorLabelKa: "წითელი",
    colorEmoji: "🔴",
  },
  {
    name: "ლომები",
    color: "#A855F7",
    colorLabelKa: "იასამნისფერი",
    colorEmoji: "🟣",
  },
  {
    name: "გრიფონები",
    color: "#06B6D4",
    colorLabelKa: "ცისფერი",
    colorEmoji: "🩵",
  },
  {
    name: "დრაკონები",
    color: "#F97316",
    colorLabelKa: "ნარინჯისფერი",
    colorEmoji: "🟠",
  },
  {
    name: "ვარსკვლავები",
    color: "#EC4899",
    colorLabelKa: "ვარდისფერი",
    colorEmoji: "🩷",
  },
];

export function createDefaultTeams(): TournamentTeam[] {
  return DEFAULT_TEAM_PRESETS.map((preset) => ({
    ...preset,
    id: crypto.randomUUID(),
    score: 0,
  }));
}

export function createEmptyRooms(teams: TournamentTeam[]): Record<RoomId, RoomState> {
  const rooms = {} as Record<RoomId, RoomState>;

  ROOM_IDS.forEach((roomId, index) => {
    const a = teams[index * 2];
    const b = teams[index * 2 + 1];
    rooms[roomId] = {
      id: roomId,
      number: index + 1,
      labelKa: `ოთახი ${index + 1}`,
      teamIds: [a.id, b.id],
      usedTiles: new Set(),
      activeQuestion: null,
      isAnswerRevealed: false,
      isWinnerModalOpen: false,
      celebrationPlayed: false,
    };
  });

  return rooms;
}

export function getRoomTeams(
  room: RoomState,
  teams: TournamentTeam[]
): [TournamentTeam, TournamentTeam] {
  const a = teams.find((t) => t.id === room.teamIds[0]);
  const b = teams.find((t) => t.id === room.teamIds[1]);
  if (!a || !b) {
    throw new Error(`Room ${room.id} is missing assigned teams`);
  }
  return [a, b];
}

export function getRoomTeamsOrEmpty(
  room: RoomState,
  teams: TournamentTeam[]
): TournamentTeam[] {
  try {
    return [...getRoomTeams(room, teams)];
  } catch {
    return [];
  }
}

export type { GameData };
