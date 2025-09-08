import { tmpdir } from 'node:os';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/** How Tabula should detect tables. */
export type TabulaMode = 'auto' | 'lattice' | 'stream';

export type TabulaOpts = {
  /** Page selection, e.g. "all", "1-3", "2,4,7". */
  pages?: string;
  /**
   * Extraction mode:
   *  - "lattice": for ruled tables (clear cell borders)
   *  - "stream": for whitespace-aligned tables
   *  - "auto" (default): do not force either; let Tabula guess
   */
  mode?: TabulaMode;
  /**
   * Optional area selection (x1,y1,x2,y2) in PDF points. Pass-through to Tabula.
   * Example: "269.875,12.75,790.5,561".
   */
  area?: string;
  /**
   * Whether to let Tabula guess table areas. Defaults to true.
   * If you pass area, guess is usually ignored by Tabula.
   */
  guess?: boolean;
  /**
   * Override the CLI binary. Defaults to trying "tabula" first then "tabula-java".
   * You can also point to a full path.
   */
  command?: string;
};

/**
 * Run Tabula and return CSV text for the given PDF.
 * Accepts a Buffer or a filesystem path to the PDF.
 * Requires Tabula CLI available on PATH (or provide opts.command).
 */
export async function tabulaCsv(pdf: Buffer | string, opts: TabulaOpts = {}): Promise<string> {
  const workingDir = await mkdtemp(join(tmpdir(), 'tabula-'));
  let pdfPath = '';
  try {
    if (Buffer.isBuffer(pdf)) {
      pdfPath = join(workingDir, 'input.pdf');
      await writeFile(pdfPath, pdf);
    } else {
      pdfPath = pdf;
    }

    const outputPath = join(workingDir, 'out.csv');

    // Build CLI args
    const cliArgs: string[] = [];

    // Pages
    if (opts.pages) {
      cliArgs.push('-p', opts.pages);
    }

    // Area
    if (opts.area) {
      cliArgs.push('-a', opts.area);
    }

    // Guess (default true). Tabula’s flag is -g to enable guessing.
    if (opts.guess === undefined || opts.guess) {
      cliArgs.push('-g');
    }

    // Mode flags (mutually exclusive)
    const mode = opts.mode ?? 'auto';
    if (mode === 'lattice') cliArgs.push('-l');
    if (mode === 'stream') cliArgs.push('-s');

    // Output format + file + input
    cliArgs.push('-f', 'CSV', '-o', outputPath, pdfPath);

    // Choose command
    const preferredCommand = opts.command?.trim();
    const commandsToTry = preferredCommand ? [preferredCommand] : ['tabula', 'tabula-java'];

    let lastError: unknown = undefined;

    for (const commandName of commandsToTry) {
      try {
        await execFileAsync(commandName, cliArgs, { maxBuffer: 64 * 1024 * 1024 });

        return await readFile(outputPath, 'utf8');
      } catch (err) {
        lastError = err;
        // try next command
      }
    }

    throw new Error(
      `Failed to execute Tabula (tried: ${commandsToTry.join(
        ', '
      )}). Last error: ${String((lastError as any)?.message || lastError)}`
    );
  } finally {
    await rm(workingDir, { recursive: true, force: true });
  }
}
