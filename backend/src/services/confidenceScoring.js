const PHYSICAL_BOUNDS = {
  TDS:       { min: 0, max: 5000 },
  pH:        { min: 0, max: 14 },
  turbidity: { min: 0, max: 1000 },
  coliform:  { min: 0, max: 10000 },
};

// Hour bucket for duplicate detection: same householdId + testType within 1h
function dupKey(householdId, testType, testedAt) {
  const bucket = Math.floor(new Date(testedAt).getTime() / (1000 * 3600));
  return `${householdId}:${testType}:${bucket}`;
}

/**
 * Deterministic confidence scoring for a single observation.
 *
 * obs must have these fields (after formatObs conversion):
 *   householdId, testType, result, testedAt, wardId, location {lat,lng}|null
 *
 * options:
 *   isDuplicate: boolean — duplicate detected for this observation
 *   now: Date           — override current time (for tests)
 *
 * Scoring (additive, max 100):
 *   Required fields complete : 10
 *   Has GPS location         : 15
 *   Result in plausible range: 20
 *   testedAt not in future   : 10
 *   Recency (< 7d=25, 7-30d=20, 30-90d=10, >90d=0)
 *   No duplicate signal      : 20
 *
 * Levels: high ≥ 80, medium ≥ 60, low < 60
 */
function computeConfidence(obs, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const isDuplicate = options.isDuplicate === true;

  let score = 0;
  const factors = {};
  const reasons = [];

  // ── Required-field completeness (10 pts) ────────────────────────────────
  const hasRequired = !!(
    obs.householdId && obs.testType && obs.result != null && obs.testedAt && obs.wardId
  );
  factors.requiredFieldsComplete = hasRequired;
  if (hasRequired) {
    score += 10;
  } else {
    reasons.push('One or more required fields are missing');
  }

  // ── GPS location (15 pts) ───────────────────────────────────────────────
  const hasLocation = !!(obs.location && obs.location.lat != null && obs.location.lng != null);
  factors.hasLocation = hasLocation;
  if (hasLocation) {
    score += 15;
  } else {
    reasons.push('GPS location missing — spatial accuracy reduced');
  }

  // ── Result plausibility (20 pts) ────────────────────────────────────────
  const bounds = PHYSICAL_BOUNDS[obs.testType];
  const plausible = bounds && typeof obs.result === 'number'
    ? obs.result >= bounds.min && obs.result <= bounds.max
    : true; // unknown test type: don't penalise
  factors.resultPlausibility = plausible ? 'plausible' : 'implausible';
  if (plausible) {
    score += 20;
  } else {
    reasons.push(`Result ${obs.result} is outside plausible physical range for ${obs.testType}`);
  }

  // ── Date validity and recency (30 pts) ──────────────────────────────────
  const testedAt = obs.testedAt instanceof Date ? obs.testedAt : new Date(obs.testedAt);
  const validDate = !isNaN(testedAt.getTime());

  if (!validDate) {
    factors.dateValidity = 'invalid';
    reasons.push('Test date is invalid');
  } else if (testedAt > now) {
    factors.dateValidity = 'future';
    reasons.push('Test date is in the future — likely a data-entry error');
    // +0 for both sub-factors
  } else {
    score += 10; // not future
    const daysOld = (now.getTime() - testedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysOld <= 7) {
      factors.dateValidity = 'fresh';
      score += 25;
    } else if (daysOld <= 30) {
      factors.dateValidity = 'recent';
      score += 20;
    } else if (daysOld <= 90) {
      factors.dateValidity = 'aging';
      score += 10;
      reasons.push('Observation is more than 30 days old');
    } else {
      factors.dateValidity = 'stale';
      reasons.push('Observation is more than 90 days old — may not reflect current conditions');
    }
  }

  // ── Duplicate / suspicious signal (20 pts) ──────────────────────────────
  factors.duplicateSignal = isDuplicate;
  if (!isDuplicate) {
    score += 20;
  } else {
    reasons.push('A similar observation exists for the same household within 1 hour — possible duplicate');
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const confidenceLevel = score >= 80 ? 'high' : score >= 60 ? 'medium' : 'low';

  return { confidenceScore: score, confidenceLevel, confidenceFactors: factors, confidenceReasons: reasons };
}

module.exports = { computeConfidence, PHYSICAL_BOUNDS, dupKey };
