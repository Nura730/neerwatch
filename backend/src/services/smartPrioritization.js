/**
 * Deterministic alert/task priority signal.
 *
 * Does NOT replace the original alert severity — it is an additive
 * prioritization signal to help operators decide what needs attention first.
 *
 * Inputs (alert):
 *   severity:  'low' | 'medium' | 'high' | 'critical'
 *   resolved:  boolean
 *   createdAt: Date
 *
 * Returns:
 *   { priorityScore, priorityLabel, priorityReasons }
 */

const SEVERITY_SCORE = { critical: 80, high: 60, medium: 40, low: 20 };

function computeAlertPrioritySignal(alert, options = {}) {
  const now   = options.now instanceof Date ? options.now : new Date();
  const score_parts = {};
  const reasons = [];

  // Severity base (0–80)
  const severityScore = SEVERITY_SCORE[alert.severity] || 40;
  score_parts.severity = severityScore;

  // Recency bonus (0–20): unresolved alerts that are recent are more urgent
  const ageMs = now - new Date(alert.createdAt);
  const ageHours = ageMs / (1000 * 60 * 60);
  let recencyBonus = 0;
  if (!alert.resolved) {
    if (ageHours < 24) {
      recencyBonus = 20;
      reasons.push('Alert raised within the last 24 hours');
    } else if (ageHours < 168) {
      recencyBonus = 10;
      reasons.push('Alert raised within the last 7 days');
    } else {
      reasons.push('Alert is older than 7 days — may need re-investigation');
    }
  }
  score_parts.recency = recencyBonus;

  const totalScore = Math.min(100, severityScore + recencyBonus);

  let priorityLabel;
  if (totalScore >= 80)      priorityLabel = 'critical';
  else if (totalScore >= 60) priorityLabel = 'high';
  else if (totalScore >= 40) priorityLabel = 'medium';
  else                       priorityLabel = 'low';

  if (alert.severity === 'high' || alert.severity === 'critical') {
    reasons.push(`Original severity is ${alert.severity}`);
  }
  if (alert.resolved) {
    reasons.push('Alert is already resolved');
  }

  return { priorityScore: totalScore, priorityLabel, priorityReasons: reasons };
}

module.exports = { computeAlertPrioritySignal };
