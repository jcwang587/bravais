const SUBSCRIPT_DIGITS = "₀₁₂₃₄₅₆₇₈₉";
const COMBINING_OVERLINE = "̅";

function subscript(digit: string): string {
  return SUBSCRIPT_DIGITS[Number(digit)] ?? digit;
}

/**
 * A Hermann-Mauguin symbol the way textbooks print it: no spaces, screw
 * axes with subscripts and rotoinversion axes with a bar, so `F m -3 m`
 * becomes Fm3̄m and `P 2_1/c` becomes P2₁/c. The ASCII forms of moyo and
 * spglib (`2_1`) and of CIF files (`21`, the digits run together) are both
 * read. A setting suffix such as `:H` is kept after a space. A symbol
 * written without spaces is only given bars and underscore subscripts,
 * since `F432` cannot be told from a screw axis without them.
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
