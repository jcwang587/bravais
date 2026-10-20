const SUBSCRIPT_DIGITS = "₀₁₂₃₄₅₆₇₈₉";
const COMBINING_OVERLINE = "̅";

function subscript(digit: string): string {
  return SUBSCRIPT_DIGITS[Number(digit)] ?? digit;
}

/**
 * Write a space-group symbol the way textbooks print it: `F m -3 m` becomes
 * Fm3̅m and `P 2_1/c` becomes P2₁/c. A setting suffix such as `:H` is kept.
 * A screw axis written as two digits, as CIF files do (`P 1 21/c 1`), is
 * recognised only when the symbol has spaces, since in `F432` the digits
 * are separate axes.
 */
export function typesetSymbol(symbol: string): string {
  const trimmed = symbol.trim();
  const colon = trimmed.indexOf(":");
  const body = colon === -1 ? trimmed : trimmed.slice(0, colon).trim();
  const suffix = colon === -1 ? "" : ` ${trimmed.slice(colon)}`;
  const tokens = body.split(/\s+/);
  const typeset = tokens
    .map((token) =>
      tokens.length > 1
        ? token.replace(
            /^([2346])([1-5])(?=$|\/)/,
            (match, axis: string, order: string) =>
              Number(order) < Number(axis) ? axis + subscript(order) : match,
          )
        : token,
    )
    .join("")
    .replace(
      /(\d)_(\d)/g,
      (_, axis: string, order: string) => axis + subscript(order),
    )
    .replace(/-(\d)/g, (_, axis: string) => axis + COMBINING_OVERLINE);
  return typeset + suffix;
}
