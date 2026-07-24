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

/** Session-only assignment result including per-team leaders. Not persisted. */
export type AssignmentResult = {
  teams: Assignment;
  /** teamId → memberId; only for non-empty teams */
  leaders: Record<string, string>;
};
