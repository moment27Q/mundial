function getWinner(home, away) {
  if (home > away) return 'home';
  if (away > home) return 'away';
  return 'draw';
}

/**
 * Scoring rules (mutually exclusive, highest applies):
 *  1. Exact score                  → 5 pts
 *  2. Correct winner only          → 3 pts
 *  3. Correct margin, wrong winner → 2 pts  (consolation)
 *     e.g. predict 1-3 (away+2), actual 2-0 (home+2) → same margin, different winner
 *
 * Bonuses (additive, calculated separately):
 *  4. Streak: +2 pts every 3 consecutive matches with at least winner correct
 *  5. Early prediction (>24h before match): +1 pt
 */
function calculateBasePoints(predHome, predAway, actHome, actAway) {
  if (predHome === actHome && predAway === actAway) return 5;

  const predWinner = getWinner(predHome, predAway);
  const actWinner = getWinner(actHome, actAway);

  if (predWinner === actWinner) return 3;

  const predDiff = Math.abs(predHome - predAway);
  const actDiff = Math.abs(actHome - actAway);
  if (predDiff === actDiff && predDiff > 0) return 2;

  return 0;
}

/**
 * Recalculate streak bonus from a user's full ordered prediction history.
 * predictions: [{base_points: n}, ...] ordered by match_date ASC
 */
function calculateStreakBonus(predictions) {
  let streak = 0;
  let bonus = 0;
  for (const p of predictions) {
    if (p.base_points > 0) {
      streak++;
      if (streak % 3 === 0) bonus += 2;
    } else {
      streak = 0;
    }
  }
  return bonus;
}

module.exports = { calculateBasePoints, calculateStreakBonus, getWinner };
