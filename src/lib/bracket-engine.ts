type Team = { id: string; name: string; seed?: number };
type BracketMatch = {
  round: number;
  position: number;
  team1Id: string | null;
  team2Id: string | null;
};

function nextPowerOf2(n: number): number {
  if (n <= 1) return 2;
  return 1 << (32 - Math.clz32(n - 1));
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function generateSingleElimination(teams: Team[]): BracketMatch[][] {
  const totalSlots = nextPowerOf2(teams.length);
  const rounds = Math.log2(totalSlots);
  const byes = totalSlots - teams.length;

  const seeded = shuffle(teams);
  const matches: BracketMatch[][] = [];

  // Round 1 — create matchups
  const round1: BracketMatch[] = [];
  for (let i = 0; i < totalSlots / 2; i++) {
    const t1 = seeded[i]?.id || null;
    const t2 = seeded[totalSlots - 1 - i]?.id || null;
    round1.push({
      round: 1,
      position: i,
      team1Id: t1,
      team2Id: t2 !== t1 ? t2 : null,
    });
  }
  matches.push(round1);

  // Subsequent rounds — empty placeholders
  for (let r = 2; r <= rounds; r++) {
    const matchCount = totalSlots / Math.pow(2, r);
    const round: BracketMatch[] = [];
    for (let i = 0; i < matchCount; i++) {
      round.push({
        round: r,
        position: i,
        team1Id: null,
        team2Id: null,
      });
    }
    matches.push(round);
  }

  return matches;
}

export function generateDoubleElimination(teams: Team[]): {
  upper: BracketMatch[][];
  lower: BracketMatch[][];
  final: BracketMatch[][];
} {
  const upper = generateSingleElimination(teams);
  const totalSlots = nextPowerOf2(teams.length);
  const upperRounds = upper.length;

  const lower: BracketMatch[][] = [];
  for (let r = 0; r < upperRounds - 1; r++) {
    const matchCount = Math.pow(2, upperRounds - 2 - r);
    const round: BracketMatch[] = [];
    for (let i = 0; i < matchCount; i++) {
      round.push({ round: r + 1, position: i, team1Id: null, team2Id: null });
    }
    lower.push(round);
  }

  const final: BracketMatch[][] = [
    [{ round: 1, position: 0, team1Id: null, team2Id: null }],
  ];

  return { upper, lower, final };
}

export function generateRoundRobin(teams: Team[]): BracketMatch[][] {
  const n = teams.length;
  const rounds: BracketMatch[][] = [];
  const isOdd = n % 2 !== 0;
  const totalTeams = isOdd ? n + 1 : n;
  const totalRounds = totalTeams - 1;

  const ids = teams.map((t) => t.id);
  if (isOdd) ids.push("__BYE__");

  for (let r = 0; r < totalRounds; r++) {
    const round: BracketMatch[] = [];
    for (let i = 0; i < totalTeams / 2; i++) {
      const t1 = ids[i];
      const t2 = ids[totalTeams - 1 - i];
      if (t1 !== "__BYE__" && t2 !== "__BYE__") {
        round.push({ round: r + 1, position: i, team1Id: t1, team2Id: t2 });
      }
    }
    rounds.push(round);
    // Rotate teams (keep first fixed)
    ids.splice(1, 0, ids.pop()!);
  }

  return rounds;
}

export function getRoundsCount(teamCount: number): number {
  return Math.log2(nextPowerOf2(teamCount));
}

export function getTotalSlots(teamCount: number): number {
  return nextPowerOf2(teamCount);
}
