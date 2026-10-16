/** The CIF parses but does not describe a structure this package can use. */
export class CifStructureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CifStructureError";
  }
}
