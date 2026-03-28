export type MatchOutcome = 'victory' | 'defeat' | 'abandon';

type WinRateBracket = {
  minDiff: number;
  maxDiff: number;
  victoryPoints: number;
  defeatPoints: number;
};

const ABANDON_PENALTY = -18;

const WIN_RATE_BRACKETS: WinRateBracket[] = [
  { minDiff: 30, maxDiff: Infinity, victoryPoints: 15, defeatPoints: -2 },
  { minDiff: 15, maxDiff: 29.99, victoryPoints: 13, defeatPoints: -4 },
  { minDiff: 5, maxDiff: 14.99, victoryPoints: 12, defeatPoints: -5 },
  { minDiff: -4.99, maxDiff: 4.99, victoryPoints: 10, defeatPoints: -6 },
  { minDiff: -14.99, maxDiff: -5, victoryPoints: 8, defeatPoints: -8 },
  { minDiff: -29.99, maxDiff: -15, victoryPoints: 7, defeatPoints: -10 },
  { minDiff: -Infinity, maxDiff: -30, victoryPoints: 5, defeatPoints: -12 }
];

function getWinRate(wins: number, games: number): number {
  if (games <= 0) return 50;
  return (wins / games) * 100;
}

function findBracket(diff: number): WinRateBracket {
  for (const bracket of WIN_RATE_BRACKETS) {
    if (diff >= bracket.minDiff && diff <= bracket.maxDiff) {
      return bracket;
    }
  }
  return WIN_RATE_BRACKETS[3];
}

export function calculatePoints(
  outcome: MatchOutcome,
  playerWins: number,
  playerGames: number,
  rivalWins: number,
  rivalGames: number
): number {
  if (outcome === 'abandon') return ABANDON_PENALTY;

  const playerWr = getWinRate(playerWins, playerGames);
  const rivalWr = getWinRate(rivalWins, rivalGames);
  const diff = rivalWr - playerWr;
  const bracket = findBracket(diff);

  return outcome === 'victory' ? bracket.victoryPoints : bracket.defeatPoints;
}
