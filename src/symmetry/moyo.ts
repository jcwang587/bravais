import type { MoyoHallSymbolEntry } from "@spglib/moyo-wasm";

import type { SpaceGroupInfo, SymmetryOperation } from "../structure/types.js";
import { loadMoyo, moyo } from "./moyo-loader.js";

/** The named space group is not in the symmetry table. */
export class SpaceGroupLookupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SpaceGroupLookupError";
  }
}

let hallEntries: MoyoHallSymbolEntry[] | null = null;

/**
 * Load moyo, the symmetry library, ahead of first use. This is optional:
 * everything that needs moyo loads it. If loading fails, the next call tries
 * again.
 */
export function ensureMoyo(): Promise<void> {
  return loadMoyo();
}

/**
 * An operation as moyo returns it. Declared here rather than imported so the
 * published declarations do not depend on @spglib/moyo-wasm, which is bundled
 * at build time and not installed by consumers.
 */
export interface MoyoOperationLike {
  /** Nine integers, column-major. */
  rotation: readonly [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  translation: readonly [number, number, number];
}

/** moyo stores matrices column-major: element (i, j) sits at i + 3j. */
export function fromMoyoOperation(
  operation: MoyoOperationLike,
): SymmetryOperation {
  const r = operation.rotation;
  return {
    rotation: [r[0], r[3], r[6], r[1], r[4], r[7], r[2], r[5], r[8]],
    translation: [
      operation.translation[0],
      operation.translation[1],
      operation.translation[2],
    ],
  };
}

function allHallEntries(): MoyoHallSymbolEntry[] {
  if (!hallEntries) {
    hallEntries = [];
    for (let number = 1; number <= 230; number += 1) {
      hallEntries.push(...moyo().hall_symbol_entries_from_number(number));
    }
  }
  return hallEntries;
}

/** Spaces and the screw-axis underscore carry no meaning when matching symbols. */
function normalizeSymbol(symbol: string): string {
  return symbol.replace(/[\s_]/g, "").toLowerCase();
}

/**
 * Split a CIF Hermann-Mauguin symbol into its symbol and setting suffix:
 * `R -3 m :H` and `R -3 m H` give `r-3m` and `h`; `P 1 21/c 1` gives
 * `p121/c1` and null, its trailing 1 being part of the full symbol.
 */
function splitHermannMauguin(symbol: string): {
  base: string;
  setting: string | null;
} {
  const trimmed = symbol.trim();
  const colon = trimmed.match(/^(.*?)\s*:\s*(\S+)$/);
  if (colon && colon[1] && colon[2]) {
    return { base: normalizeSymbol(colon[1]), setting: colon[2].toLowerCase() };
  }
  const trailing = trimmed.match(/^(.*\S)\s+([HRhr])$/);
  if (trailing && trailing[1] && trailing[2]) {
    return {
      base: normalizeSymbol(trailing[1]),
      setting: trailing[2].toLowerCase(),
    };
  }
  return { base: normalizeSymbol(trimmed), setting: null };
}

/** The entry spglib treats as the standard setting, first among `entries`. */
function preferStandard(entries: MoyoHallSymbolEntry[]): MoyoHallSymbolEntry[] {
  const first = entries[0];
  if (!first) {
    return entries;
  }
  const standard = moyo().space_group_type(first.number).hall_number;
  return [...entries].sort((left, right) => {
    return (
      Number(right.hall_number === standard) -
      Number(left.hall_number === standard)
    );
  });
}

function entriesForSymbol(info: SpaceGroupInfo): MoyoHallSymbolEntry[] {
  const entries = allHallEntries().filter(
    (entry) => info.number === null || entry.number === info.number,
  );
  if (info.hallSymbol) {
    const wanted = normalizeSymbol(info.hallSymbol);
    const byHall = entries.filter(
      (entry) => normalizeSymbol(entry.hall_symbol) === wanted,
    );
    if (byHall.length > 0) {
      return byHall;
    }
  }
  if (info.symbol) {
    const { base, setting } = splitHermannMauguin(info.symbol);
    const bySymbol = entries.filter(
      (entry) =>
        normalizeSymbol(entry.hm_short) === base ||
        normalizeSymbol(entry.hm_full) === base,
    );
    if (setting) {
      const bySetting = bySymbol.filter(
        (entry) => entry.setting.toLowerCase() === setting,
      );
      if (bySetting.length > 0) {
        return bySetting;
      }
    }
    return preferStandard(bySymbol);
  }
  return [];
}

function describeSpaceGroup(info: SpaceGroupInfo): string {
  return [info.hallSymbol, info.symbol, info.number]
    .filter((part) => part !== null)
    .join(" / ");
}

export interface OperationSetting {
  /** moyo's name for the setting, such as "H", "R" or "b1"; "" when the group has one. */
  setting: string;
  /** Operations of the conventional cell in that setting. */
  operations: SymmetryOperation[];
}

/**
 * Every setting the space group a CIF names admits, spglib's standard one
 * first: one for most symbols, several for a short symbol such as `P 21/c`
 * or a rhombohedral symbol without `:H` or `:R`. A bare number gives the
 * standard setting alone.
 */
export async function operationSettings(
  info: SpaceGroupInfo,
): Promise<OperationSetting[]> {
  await ensureMoyo();
  const { operations_from_number } = moyo();
  if (info.hallSymbol || info.symbol) {
    const entries = entriesForSymbol(info);
    if (entries.length === 0) {
      throw new SpaceGroupLookupError(
        `Space group ${describeSpaceGroup(info)} is not in the symmetry table.`,
      );
    }
    return entries.map((entry) => ({
      setting: entry.setting,
      operations: operations_from_number(
        entry.number,
        { type: "HallNumber", value: entry.hall_number },
        false,
      ).map(fromMoyoOperation),
    }));
  }
  if (info.number === null) {
    throw new SpaceGroupLookupError("The CIF names no space group.");
  }
  return [
    {
      setting: "",
      operations: operations_from_number(
        info.number,
        { type: "Spglib" },
        false,
      ).map(fromMoyoOperation),
    },
  ];
}

/**
 * The symmetry operations of a space group given by Hall symbol,
 * Hermann-Mauguin symbol or number, in the setting a suffix such as `:H`
 * names, or else the standard setting. Throws `SpaceGroupLookupError` for
 * an unknown group.
 */
export async function operationsForSpaceGroup(
  info: SpaceGroupInfo,
): Promise<SymmetryOperation[]> {
  const [first] = await operationSettings(info);
  return first!.operations;
}
