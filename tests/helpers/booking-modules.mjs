import {readFile, writeFile, mkdir, mkdtemp, rm} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import ts from 'typescript';

const repository = fileURLToPath(new URL('../../', import.meta.url));
const names = ['booking-contracts', 'booking-server-core', 'booking-read-contracts', 'booking-read-core', 'booking-projections'];
let loaded;

// Compile the actual repository sources. The main typecheck separately checks
// all real Next/SSR entrypoints; these tests exercise the core with fake RPCs.
export function loadBookingModules() {
  loaded ??= compileAndLoad();
  return loaded;
}

async function compileAndLoad() {
  const parent = join(repository, 'node_modules/.cache/cluvo-booking-tests');
  await mkdir(parent, {recursive: true});
  const directory = await mkdtemp(join(parent, 'run-'));
  try {
    await writeFile(join(directory, 'package.json'), '{"type":"commonjs"}\n');
    for (const name of names) {
      const source = await readFile(join(repository, 'lib/bookings', name + '.ts'), 'utf8');
      const result = ts.transpileModule(source, {
        fileName: name + '.ts',
        compilerOptions: {target: ts.ScriptTarget.ES2017, module: ts.ModuleKind.CommonJS, esModuleInterop: true},
      });
      await writeFile(join(directory, name + '.js'), result.outputText);
    }
    const require = createRequire(join(directory, 'package.json'));
    return Object.fromEntries(names.map(name => [name, require('./' + name + '.js')]));
  } finally {
    await rm(directory, {recursive: true, force: true});
  }
}
