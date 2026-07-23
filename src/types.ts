export type Member = {
  id: string;
  name: string;
};

export type Team = {
  id: string;
  name: string;
};

/** Session-only map of teamId → members. Not persisted. */
export type Assignment = Record<string, Member[]>;
