import initMoyo, {
  hall_symbol_entries_from_number,
  operations_from_number,
  space_group_type,
  type MoyoHallSymbolEntry,
  type MoyoOperation,
  type MoyoSetting,
} from "@spglib/moyo-wasm";
import moyoWasmBase64 from "virtual:moyo-wasm";

import type { SpaceGroupInfo, SymmetryOperation } from "../structure/types";

export class SpaceGroupLookupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SpaceGroupLookupError";
  }
}

let initialization: Promise<void> | null = null;
let hallEntries: MoyoHallSymbolEntry[] | null = null;

function decodeBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

/** Instantiate the bundled moyo WebAssembly module once. */
export function ensureMoyo(): Promise<void> {
  if (!initialization) {
    initialization = initMoyo({
      module_or_path: decodeBase64(moyoWasmBase64),
    }).then(() => undefined);
  }
  return initialization;
}

/** moyo stores matrices column-major: element (i, j) sits at i + 3j. */
export function fromMoyoOperation(operation: MoyoOperation): SymmetryOperation {
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
      hallEntries.push(...hall_symbol_entries_from_number(number));
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
  const standard = space_group_type(first.number).hall_number;
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

function describe(info: SpaceGroupInfo): string {
  return [info.hallSymbol, info.symbol, info.number]
    .filter((part) => part !== null)
    .join(" / ");
}

/**
 * Symmetry operations of the conventional cell for the space group a CIF
 * names, in the setting its Hall or Hermann-Mauguin symbol selects. A bare
 * number resolves to spglib's standard setting.
 */
export async function operationsForSpaceGroup(
  info: SpaceGroupInfo,
): Promise<SymmetryOperation[]> {
  await ensureMoyo();
  let number = info.number;
  let setting: MoyoSetting = { type: "Spglib" };
  if (info.hallSymbol || info.symbol) {
    const entry = entriesForSymbol(info)[0];
    if (!entry) {
      throw new SpaceGroupLookupError(
        `Space group ${describe(info)} is not in the symmetry table.`,
      );
    }
    number = entry.number;
    setting = { type: "HallNumber", value: entry.hall_number };
  }
  if (number === null) {
    throw new SpaceGroupLookupError("The CIF names no space group.");
  }
  return operations_from_number(number, setting, false).map(fromMoyoOperation);
}
