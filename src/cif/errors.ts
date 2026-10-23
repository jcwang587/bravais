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

/** The CIF parses but does not describe a structure this package can use. */
export class CifStructureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CifStructureError";
  }
}
