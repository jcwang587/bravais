// The moyo bindings and their binary: most of the package's size, so they
// are a chunk of their own, imported only by `loadMoyo`.
import initMoyo from "@spglib/moyo-wasm";
import moyoWasmBase64 from "virtual:moyo-wasm";

export {
  analyze_cell,
  hall_symbol_entries_from_number,
  hall_symbol_entry,
  operations_from_number,
  space_group_type,
} from "@spglib/moyo-wasm";

function decodeBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

/** Instantiate the module from the binary this chunk carries. */
export async function instantiate(): Promise<void> {
  await initMoyo({ module_or_path: decodeBase64(moyoWasmBase64) });
}
