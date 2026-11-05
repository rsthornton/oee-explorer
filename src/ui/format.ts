/**
 * Number formatting: plain decimals wherever the value allows.
 * Scientific notation is intimidating for non-experts, so it appears
 * only in the regime where a plain decimal would be all zeros.
 */

export function fmtOmega(v: number): string {
  if (v === 0) return '0';
  if (v >= 0.001) {
    // three significant figures, plain decimal, no trailing zeros
    return Number(v.toPrecision(3)).toString();
  }
  return v.toExponential(1);
}

/** The masthead's Ω: "< 0.001" instead of scientific notation a newcomer cannot read.
 * Tables and exports keep fmtOmega's exact values. */
export function fmtOmegaHero(v: number): string {
  if (v > 0 && v < 0.001) return '< 0.001';
  return fmtOmega(v);
}
