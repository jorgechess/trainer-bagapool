// Gera as linhas do exemplo de importação (2 estratégias) para o teste de ponta a ponta inserir no banco.
import { IMPORT_EXAMPLE } from "../src/lib/import-example";
import { DEFAULT_LEGEND } from "../src/lib/poker/legend";
import { parseImportBundle } from "../src/lib/poker/importer";

const result = parseImportBundle(IMPORT_EXAMPLE, DEFAULT_LEGEND);
if (result.errors.length) throw new Error(result.errors.join(" "));
process.stdout.write(
  JSON.stringify(
    result.strategies.map(({ id, ...data }) => ({ id, name: data.name, street: data.street, situation: data.situation, data })),
  ),
);
