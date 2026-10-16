import { CifSyntaxError, tokenizeCif, type CifToken } from "./tokenizer.js";

export interface CifLoop {
  /** Lowercase tags, in column order. */
  tags: string[];
  /** One array of values per row, in `tags` order. */
  rows: string[][];
}

/** `tags` as a list: a single tag, or several aliases tried in order. */
function tagList(tags: string | string[]): string[] {
  return typeof tags === "string" ? [tags] : tags;
}

/** One `data_` block: single-value items and loops. Tags are matched case-insensitively. */
export class CifBlock {
  readonly name: string;
  readonly items = new Map<string, string>();
  readonly loops: CifLoop[] = [];

  constructor(name: string) {
    this.name = name;
  }

  /** Raw value of the first present single-value item among `tags`, or null. */
  get(tags: string | string[]): string | null {
    for (const tag of tagList(tags)) {
      const value = this.items.get(tag.toLowerCase());
      if (value !== undefined) {
        return value;
      }
    }
    return null;
  }

  /** The first loop holding any of `tags`, or null. */
  findLoop(tags: string | string[]): CifLoop | null {
    for (const tag of tagList(tags)) {
      const lower = tag.toLowerCase();
      const loop = this.loops.find((entry) => entry.tags.includes(lower));
      if (loop) {
        return loop;
      }
    }
    return null;
  }
}

/** The data blocks of a CIF, in file order. */
export interface CifDocument {
  blocks: CifBlock[];
}

/** Column values of the first of `tags` present in `loop`, or null when none is. */
export function loopColumn(
  loop: CifLoop,
  tags: string | string[],
): string[] | null {
  for (const tag of tagList(tags)) {
    const column = loop.tags.indexOf(tag.toLowerCase());
    if (column !== -1) {
      return loop.rows.map((row) => row[column] ?? "?");
    }
  }
  return null;
}

/** True for the CIF placeholders `?` (unknown) and `.` (inapplicable). */
export function isCifPlaceholder(value: string): boolean {
  return value === "?" || value === ".";
}

/**
 * Parse a CIF number such as `0.012(1)`, dropping the standard uncertainty.
 * Placeholders and non-numbers give null.
 */
export function parseCifNumber(
  value: string | null | undefined,
): number | null {
  if (value === null || value === undefined || isCifPlaceholder(value)) {
    return null;
  }
  const text = value.replace(/\(\d+\)$/, "").trim();
  if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(text)) {
    return null;
  }
  return Number(text);
}

function isLoopTerminator(token: CifToken | undefined): boolean {
  return token === undefined || token.kind !== "value";
}

/** Parse CIF text into its data blocks. Save frames (dictionary files) are skipped. */
export function parseCif(text: string): CifDocument {
  const tokens = tokenizeCif(text);
  const blocks: CifBlock[] = [];
  let block: CifBlock | null = null;
  let index = 0;
  let saveFrameDepth = 0;

  const requireBlock = (token: CifToken): CifBlock => {
    if (!block) {
      // Items before any data_ heading belong to an unnamed block.
      block = new CifBlock("");
      blocks.push(block);
    }
    if (saveFrameDepth > 0) {
      throw new CifSyntaxError(
        `unexpected ${token.kind} inside a save frame`,
        token.line,
      );
    }
    return block;
  };

  while (index < tokens.length) {
    const token = tokens[index];
    if (!token) {
      break;
    }
    switch (token.kind) {
      case "data": {
        block = new CifBlock(token.text);
        blocks.push(block);
        saveFrameDepth = 0;
        index += 1;
        break;
      }
      case "save": {
        saveFrameDepth =
          token.text === ""
            ? Math.max(0, saveFrameDepth - 1)
            : saveFrameDepth + 1;
        index += 1;
        break;
      }
      case "stop": {
        index += 1;
        break;
      }
      case "tag": {
        if (saveFrameDepth > 0) {
          index += 2;
          break;
        }
        const target = requireBlock(token);
        const value = tokens[index + 1];
        if (!value || value.kind !== "value") {
          throw new CifSyntaxError(
            `tag ${token.text} has no value`,
            token.line,
          );
        }
        target.items.set(token.text.toLowerCase(), value.text);
        index += 2;
        break;
      }
      case "loop": {
        const tags: string[] = [];
        index += 1;
        while (tokens[index]?.kind === "tag") {
          tags.push((tokens[index] as CifToken).text.toLowerCase());
          index += 1;
        }
        if (tags.length === 0) {
          throw new CifSyntaxError("loop_ without tags", token.line);
        }
        const values: string[] = [];
        while (!isLoopTerminator(tokens[index])) {
          values.push((tokens[index] as CifToken).text);
          index += 1;
        }
        if (saveFrameDepth > 0) {
          break;
        }
        if (values.length % tags.length !== 0) {
          throw new CifSyntaxError(
            `loop with ${tags.length} tags has ${values.length} values`,
            token.line,
          );
        }
        const rows: string[][] = [];
        for (let start = 0; start < values.length; start += tags.length) {
          rows.push(values.slice(start, start + tags.length));
        }
        requireBlock(token).loops.push({ tags, rows });
        break;
      }
      case "value": {
        throw new CifSyntaxError(
          `unexpected value ${JSON.stringify(token.text)}`,
          token.line,
        );
      }
    }
  }

  return { blocks };
}
