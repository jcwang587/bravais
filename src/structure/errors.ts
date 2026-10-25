/** A structure, read from a CIF or given as data, that this package cannot use. */
export class StructureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StructureError";
  }
}

/** Structure data `readStructure` cannot use: a field is missing or malformed. */
export class StructureDataError extends StructureError {
  constructor(message: string) {
    super(message);
    this.name = "StructureDataError";
  }
}
