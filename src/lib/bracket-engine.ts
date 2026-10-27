// ─── Bracket Engine ──────────────────────────────────────
// Generate single/double elimination brackets and auto-advance
// teams through the bracket when results come in.

export type Team = { id: string; name: string };

export type BracketMatchDef = {
  roundNumber: number;
  bracketPosition: number;
  phase: "UPPER" | "LOWER" | "FINAL" | "BRACKET_RESET";
  team1Id: string | null;
  team2Id: string | null;
  /** Index in the returned array of the match the WINNER goes to. -1 = no next (champion crowned). */
  winnerNextMatchIdx: number;
  /** Slot (1 or 2) the winner occupies in the next match. */
  winnerNextSlot: 1 | 2;
  /** Index of the match the LOSER drops to. -1 = eliminated. */
  loserNextMatchIdx: number;
  /** Slot (1 or 2) the loser occupies in the next match. */
  loserNextSlot: 1 | 2;
};

// ─── Helpers ─────────────────────────────────────────────

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

// ─── Single Elimination ──────────────────────────────────

export function generateSingleElimination(teams: Team[]): BracketMatchDef[] {
  const totalSlots = nextPowerOf2(teams.length);
  const rounds = Math.log2(totalSlots);
  const seeded = shuffle(teams);
  const matches: BracketMatchDef[] = [];

  type Slot = { r: number; p: number };
  const order: Slot[] = [];
  for (let r = 1; r <= rounds; r++) {
    const count = totalSlots / Math.pow(2, r);
    for (let p = 0; p < count; p++) {
      order.push({ r, p });
    }
  }

  for (let i = 0; i < order.length; i++) {
    const { r, p } = order[i];
    const isFirstRound = r === 1;

    let t1: string | null = null;
    let t2: string | null = null;
    if (isFirstRound) {
      const idx1 = p * 2;
      const idx2 = p * 2 + 1;
      t1 = seeded[idx1]?.id ?? null;
      t2 = idx2 < teams.length ? (seeded[idx2]?.id ?? null) : null;
    }

    const isLastRound = r === rounds;
    const winnerNextIdx = isLastRound ? -1 : (() => {
      const nextIdx = order.findIndex(s => s.r === r + 1 && s.p === Math.floor(p / 2));
      return nextIdx;
    })();
    const winnerNextSlot: 1 | 2 = (p % 2 === 0) ? 1 : 2;

    matches.push({
      roundNumber: r,
      bracketPosition: p,
      phase: "UPPER",
      team1Id: t1,
      team2Id: t2,
      winnerNextMatchIdx: winnerNextIdx,
      winnerNextSlot,
      loserNextMatchIdx: -1,
      loserNextSlot: 1,
    });
  }

  return matches;
}

// ─── Double Elimination ──────────────────────────────────
//
// Standard double-elimination bracket (Clash of Legends style).
// Hand-crafted per team count for correctness, then generic fallback.
//
// Verbose naming for the connections so it's dead obvious what goes where.

interface ManualMatch {
  rn: number;                  // round number
  bp: number;                  // bracket position (0-based in round)
  phase: "UPPER" | "LOWER" | "FINAL" | "BRACKET_RESET";
  team1: number | null;        // index into seeded array, or null
  team2: number | null;
  winGoesTo: number | null;    // index into the returned array of where winner goes
  winSlot: 1 | 2;
  loseGoesTo: number | null;   // index into returned array, or null = eliminated
  loseSlot: 1 | 2;
}

export function generateDoubleElimination(teams: Team[]): BracketMatchDef[] {
  const totalSlots = nextPowerOf2(teams.length);
  const seeded = shuffle(teams);
  const N = teams.length;

  let manualDefs: ManualMatch[];

  if (totalSlots <= 4) {
    // ── 4-team double elimination ──
    // R1: Upper R1 (2 matches)
    // R2: Upper R2 / Upper Final (1 match)
    // R3: Lower R1 / Lower Final (1 match)
    // R4: Grand Final
    // R5: Bracket Reset
    manualDefs = [
      // Round 1: Upper R1
      { rn: 1, bp: 0, phase: "UPPER", team1: 0, team2: 3, winGoesTo: 2, winSlot: 1, loseGoesTo: 4, loseSlot: 1 },
      { rn: 1, bp: 1, phase: "UPPER", team1: 1, team2: 2, winGoesTo: 2, winSlot: 2, loseGoesTo: 4, loseSlot: 2 },
      // Round 2: Lower R1 / Lower Final
      { rn: 2, bp: 0, phase: "LOWER", team1: null, team2: null, winGoesTo: 5, winSlot: 2, loseGoesTo: null, loseSlot: 1 },
      // Round 3: Upper R2 / Upper Final  -- actually this should happen BEFORE Lower Final
      { rn: 3, bp: 0, phase: "UPPER", team1: null, team2: null, winGoesTo: 4, winSlot: 1, loseGoesTo: null, loseSlot: 1 },
      // Wait this ordering is wrong. Let me re-check.
    ];
    // Actually the problem is theoretical: for 4 teams, Upper R2 (the final of the upper bracket)
    // happens AFTER Lower R1? Or at the same time?
    // In real brackets: after U1 completes, both U2 and L1 can happen at the same time.
    // So order: U1 → (U2 + L1 simultaneously) → GF → BR
    manualDefs = [
      // Round 1: Upper R1
      { rn: 1, bp: 0, phase: "UPPER", team1: 0, team2: 3, winGoesTo: 3, winSlot: 1, loseGoesTo: 2, loseSlot: 1 },
      { rn: 1, bp: 1, phase: "UPPER", team1: 1, team2: 2, winGoesTo: 3, winSlot: 2, loseGoesTo: 2, loseSlot: 2 },
      // Round 2: Lower R1/Lower Final
      { rn: 2, bp: 0, phase: "LOWER", team1: null, team2: null, winGoesTo: 4, winSlot: 2, loseGoesTo: null, loseSlot: 1 },
      // Round 3: Upper R2/Upper Final
      { rn: 3, bp: 0, phase: "UPPER", team1: null, team2: null, winGoesTo: 4, winSlot: 1, loseGoesTo: null, loseSlot: 1 },
      // Round 4: Grand Final
      { rn: 4, bp: 0, phase: "FINAL", team1: null, team2: null, winGoesTo: null, winSlot: 1, loseGoesTo: 5, loseSlot: 1 },
      // Round 5: Bracket Reset
      { rn: 5, bp: 0, phase: "BRACKET_RESET", team1: null, team2: null, winGoesTo: null, winSlot: 1, loseGoesTo: null, loseSlot: 1 },
    ];
  } else if (totalSlots <= 8) {
    // ── 8-team double elimination ──
    // Round 1: Upper R1 (4 matches)
    // Round 2: Lower R1 (2 matches)
    // Round 3: Upper R2 (2 matches)
    // Round 4: Lower R2 (2 matches)
    // Round 5: Lower R3 / Lower Final (1 match)
    // Round 6: Upper R3 / Upper Final (1 match)
    // Round 7: Grand Final (1 match)
    // Round 8: Bracket Reset (1 match)
    manualDefs = [
      // ── Round 1: Upper R1 (indices 0-3) ──
      { rn: 1, bp: 0, phase: "UPPER", team1: 0, team2: 7, winGoesTo:  6, winSlot: 1, loseGoesTo:  4, loseSlot: 1 },
      { rn: 1, bp: 1, phase: "UPPER", team1: 3, team2: 4, winGoesTo:  6, winSlot: 2, loseGoesTo:  4, loseSlot: 2 },
      { rn: 1, bp: 2, phase: "UPPER", team1: 1, team2: 6, winGoesTo:  7, winSlot: 1, loseGoesTo:  5, loseSlot: 1 },
      { rn: 1, bp: 3, phase: "UPPER", team1: 2, team2: 5, winGoesTo:  7, winSlot: 2, loseGoesTo:  5, loseSlot: 2 },
      // ── Round 2: Lower R1 (indices 4-5) ──
      { rn: 2, bp: 0, phase: "LOWER", team1: null, team2: null, winGoesTo:  8, winSlot: 2, loseGoesTo: null, loseSlot: 1 },
      { rn: 2, bp: 1, phase: "LOWER", team1: null, team2: null, winGoesTo:  9, winSlot: 2, loseGoesTo: null, loseSlot: 1 },
      // ── Round 3: Upper R2 (indices 6-7) ──
      { rn: 3, bp: 0, phase: "UPPER", team1: null, team2: null, winGoesTo: 11, winSlot: 1, loseGoesTo:  8, loseSlot: 1 },
      { rn: 3, bp: 1, phase: "UPPER", team1: null, team2: null, winGoesTo: 11, winSlot: 2, loseGoesTo:  9, loseSlot: 1 },
      // ── Round 4: Lower R2 (indices 8-9) ──
      { rn: 4, bp: 0, phase: "LOWER", team1: null, team2: null, winGoesTo: 10, winSlot: 1, loseGoesTo: null, loseSlot: 1 },
      { rn: 4, bp: 1, phase: "LOWER", team1: null, team2: null, winGoesTo: 10, winSlot: 2, loseGoesTo: null, loseSlot: 1 },
      // ── Round 5: Lower R3 / Lower Final (index 10) ──
      { rn: 5, bp: 0, phase: "LOWER", team1: null, team2: null, winGoesTo: 12, winSlot: 2, loseGoesTo: null, loseSlot: 1 },
      // ── Round 6: Upper R3 / Upper Final (index 11) ──
      { rn: 6, bp: 0, phase: "UPPER", team1: null, team2: null, winGoesTo: 12, winSlot: 1, loseGoesTo: null, loseSlot: 1 },
      // ── Round 7: Grand Final (index 12) ──
      { rn: 7, bp: 0, phase: "FINAL", team1: null, team2: null, winGoesTo: null, winSlot: 1, loseGoesTo: 13, loseSlot: 1 },
      // ── Round 8: Bracket Reset (index 13) ──
      { rn: 8, bp: 0, phase: "BRACKET_RESET", team1: null, team2: null, winGoesTo: null, winSlot: 1, loseGoesTo: null, loseSlot: 1 },
    ];
  } else {
    // ── 16+ teams: generic approach ──
    // For now, fall back to single elimination with a warning note.
    // This will be extended once we validate the bracket flow for larger sizes.
    throw new Error(`Double elimination for ${totalSlots} teams not yet implemented. Max 8 for now. Use single elimination instead.`);
  }

  // Convert manual definitions to BracketMatchDef array
  const matches: BracketMatchDef[] = manualDefs.map(m => ({
    roundNumber: m.rn,
    bracketPosition: m.bp,
    phase: m.phase,
    team1Id: m.team1 !== null ? seeded[m.team1]?.id ?? null : null,
    team2Id: m.team2 !== null ? seeded[m.team2]?.id ?? null : null,
    winnerNextMatchIdx: m.winGoesTo !== null ? m.winGoesTo : -1,
    winnerNextSlot: m.winSlot,
    loserNextMatchIdx: m.loseGoesTo !== null ? m.loseGoesTo : -1,
    loserNextSlot: m.loseSlot,
  }));

  return matches;
}

// ─── Round Robin ─────────────────────────────────────────

export function generateRoundRobin(teams: Team[]): BracketMatchDef[] {
  const n = teams.length;
  const matches: BracketMatchDef[] = [];
  const isOdd = n % 2 !== 0;
  const totalTeams = isOdd ? n + 1 : n;
  const totalRounds = totalTeams - 1;

  const ids = teams.map(t => t.id);
  if (isOdd) ids.push("__BYE__");

  for (let r = 0; r < totalRounds; r++) {
    const roundNumber = r + 1;
    let pos = 0;
    for (let i = 0; i < totalTeams / 2; i++) {
      const t1 = ids[i];
      const t2 = ids[totalTeams - 1 - i];
      if (t1 !== "__BYE__" && t2 !== "__BYE__") {
        matches.push({
          roundNumber,
          bracketPosition: pos++,
          phase: "UPPER",
          team1Id: t1,
          team2Id: t2,
          winnerNextMatchIdx: -1,
          winnerNextSlot: 1,
          loserNextMatchIdx: -1,
          loserNextSlot: 1,
        });
      }
    }
    ids.splice(1, 0, ids.pop()!);
  }

  return matches;
}

// ─── Advancement Engine ─────────────────────────────────

export type AdvanceResult = {
  matchId: string;
  winnerId: string;
  nextMatchId?: string | null;
  nextSlot?: 1 | 2;
  loserNextMatchId?: string | null;
  loserNextSlot?: 1 | 2;
};

export function computeAdvancement(match: {
  id: string;
  winnerNextMatchId: string | null;
  winnerNextSlot: number | null;
  loserNextMatchId: string | null;
  loserNextSlot: number | null;
  phase: string | null;
}): Omit<AdvanceResult, "winnerId"> {
  const result: Omit<AdvanceResult, "winnerId"> = {
    matchId: match.id,
  };

  if (match.winnerNextMatchId && match.winnerNextSlot) {
    result.nextMatchId = match.winnerNextMatchId;
    result.nextSlot = match.winnerNextSlot as 1 | 2;
  }

  if (match.loserNextMatchId && match.loserNextSlot) {
    result.loserNextMatchId = match.loserNextMatchId;
    result.loserNextSlot = match.loserNextSlot as 1 | 2;
  }

  return result;
}

// ─── Utility ─────────────────────────────────────────────

export function getRoundsCount(teamCount: number): number {
  return Math.log2(nextPowerOf2(teamCount));
}

export function getTotalSlots(teamCount: number): number {
  return nextPowerOf2(teamCount);
}
