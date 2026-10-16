export type CifTokenKind = "tag" | "value" | "loop" | "data" | "save" | "stop";

export interface CifToken {
  kind: CifTokenKind;
  text: string;
  line: number;
}

/** The text is not CIF the tokenizer and parser accept. */
export class CifSyntaxError extends Error {
  /** 1-based line of the problem. */
  readonly line: number;

  constructor(message: string, line: number) {
    super(`CIF line ${line}: ${message}`);
    this.name = "CifSyntaxError";
    this.line = line;
  }
}

function isWhitespace(char: string): boolean {
  return char === " " || char === "\t" || char === "\r" || char === "\n";
}

function classify(word: string, line: number): CifToken {
  const lower = word.toLowerCase();
  if (word.startsWith("_")) {
    return { kind: "tag", text: word, line };
  }
  if (lower.startsWith("data_")) {
    return { kind: "data", text: word.slice(5), line };
  }
  if (lower === "loop_") {
    return { kind: "loop", text: word, line };
  }
  if (lower.startsWith("save_")) {
    return { kind: "save", text: word.slice(5), line };
  }
  if (lower === "stop_") {
    return { kind: "stop", text: word, line };
  }
  return { kind: "value", text: word, line };
}

/**
 * Split CIF 1.1 text into tokens. Comments are dropped; quoted strings and
 * semicolon text fields become single value tokens holding their content.
 */
export function tokenizeCif(text: string): CifToken[] {
  const tokens: CifToken[] = [];
  const lines = text.split(/\r\n|\r|\n/);
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? "";
    const lineNumber = index + 1;

    // AMCSD and RRUFF files close with a bare END line.
    if (line.trim().toUpperCase() === "END") {
      break;
    }

    if (line.startsWith(";")) {
      // A text field runs from this line to the next line starting with ";".
      const content = [line.slice(1)];
      index += 1;
      let closed = false;
      while (index < lines.length) {
        const candidate = lines[index] ?? "";
        if (candidate.startsWith(";")) {
          closed = true;
          break;
        }
        content.push(candidate);
        index += 1;
      }
      if (!closed) {
        throw new CifSyntaxError("unterminated text field", lineNumber);
      }
      tokens.push({
        kind: "value",
        text: content.join("\n"),
        line: lineNumber,
      });
      // The closing ";" may be followed by more tokens on the same line.
      lines[index] = " " + (lines[index] ?? "").slice(1);
      continue;
    }

    let position = 0;
    while (position < line.length) {
      const char = line.charAt(position);
      if (isWhitespace(char)) {
        position += 1;
        continue;
      }
      if (char === "#") {
        break;
      }
      if (char === "'" || char === '"') {
        // The string ends at a matching quote followed by whitespace or the
        // end of the line (CIF 1.1), so an apostrophe inside stays.
        let end = position + 1;
        while (end < line.length) {
          const next = line.indexOf(char, end);
          if (next === -1) {
            throw new CifSyntaxError("unterminated quoted string", lineNumber);
          }
          const after = line.charAt(next + 1);
          if (next + 1 >= line.length || isWhitespace(after)) {
            end = next;
            break;
          }
          end = next + 1;
        }
        if (end >= line.length) {
          throw new CifSyntaxError("unterminated quoted string", lineNumber);
        }
        tokens.push({
          kind: "value",
          text: line.slice(position + 1, end),
          line: lineNumber,
        });
        position = end + 1;
        continue;
      }
      let end = position;
      while (end < line.length && !isWhitespace(line.charAt(end))) {
        end += 1;
      }
      tokens.push(classify(line.slice(position, end), lineNumber));
      position = end;
    }
    index += 1;
  }

  return tokens;
}
