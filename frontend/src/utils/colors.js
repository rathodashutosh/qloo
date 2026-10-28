/**
 * Gap score to color mapping utilities.
 */

/**
 * Convert a gap score (0-1) to a hex color.
 */
export function gapToColor(gap) {
  const g = typeof gap === 'number' ? gap : 0.2;
  if (g <= 0.2) return '#94A3B8';
  if (g <= 0.4) return '#FBBF24';
  if (g <= 0.7) return '#10B981';
  return '#059669';
}

/**
 * Get a textual label for a gap score.
 */
export function gapLabel(gap) {
  const g = typeof gap === 'number' ? gap : 0.2;
  if (g <= 0.2) return 'Saturated Market';
  if (g <= 0.4) return 'Moderate Gap';
  if (g <= 0.7) return 'High Opportunity';
  return 'Prime Opportunity Zone';
}

/**
 * Get Tailwind-compatible text color class for confidence level.
 */
export function confidenceColor(confidence) {
  if (!confidence) return 'bg-gray-100 text-gray-700';
  const c = confidence.toLowerCase();
  if (c === 'high') return 'bg-emerald-100 text-emerald-800 border border-emerald-300';
  if (c === 'medium') return 'bg-amber-100 text-amber-800 border border-amber-300';
  return 'bg-rose-100 text-rose-800 border border-rose-300';
}

/**
 * MapLibre data-driven fill-color expression for gap scores.
 * Uses coalesce and to-number for bulletproof evaluation.
 */
export const gapFillColorExpression = [
  'interpolate',
  ['linear'],
  ['coalesce', ['to-number', ['get', 'gap']], 0.2],
  0.0, 'rgba(148, 163, 184, 0.72)',
  0.25, 'rgba(251, 191, 36, 0.78)',
  0.55, 'rgba(16, 185, 129, 0.82)',
  0.85, 'rgba(5, 150, 105, 0.90)'
];
