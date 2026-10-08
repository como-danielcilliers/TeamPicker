export type Member = {
  id: string;
  name: string;
  absent: boolean;
};

export type Team = {
  id: string;
  name: string;
};

/** Session-only map of teamId → members. Not persisted. */
export type Assignment = Record<string, Member[]>;

/** One completed (or in-progress) assignment's leader picks. */
export type LeaderRun = {
  id: string;
  at: string;
  /** teamId → memberId */
  leaders: Record<string, string>;
};

/** Per-member lead counts derived from history. */
export type LeaderStats = Record<
  string,
  { count: number; lastLedAt: string | null }
>;

/**
 * Human-readable record of the committed draw, written to the team repo so
 * the file (and its git history) shows who was on which team each day.
 * Informational only: it is never read back into the board.
 */
export type DrawSummary = {
  runId: string;
  at: string;
  teams: { id: string; name: string; leader: string | null; members: string[] }[];
};

/** Session-only assignment result including per-team leaders. Not persisted. */
export type AssignmentResult = {
  teams: Assignment;
  /** teamId → memberId; only for non-empty teams */
  leaders: Record<string, string>;
  runId: string;
};
