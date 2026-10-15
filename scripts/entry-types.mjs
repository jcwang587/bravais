// Point the package's `types` entry at the declarations tsc emits per source file.
import { writeFileSync } from "node:fs";

writeFileSync(
  new URL("../dist/bravais.d.ts", import.meta.url),
  'export * from "./types/index";\n',
);
