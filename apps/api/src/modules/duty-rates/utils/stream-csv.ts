import { DATASET_ID, httpGet, TABLE_ID, UK_10_DATA_API_BASE } from '../services/uk/base.js';

/**
 * Async generator that yields CSV records (array of strings) from a byte stream.
 * - Handles quoted fields, escaped quotes ("") and CRLF/CR line endings.
 * - Supports newlines inside quoted fields.
 * - Processes incrementally (chunk-by-chunk) to keep memory flat.
 */
export async function* iterateCsvRecords(
  stream: ReadableStream<Uint8Array>,
  opts: { encoding?: string } = {}
): AsyncGenerator<string[]> {
  const decoder = new TextDecoder(opts.encoding ?? 'utf-8');
  const reader = stream.getReader();

  let buf = ''; // decoded text buffer
  let i = 0; // cursor in buf
  let record: string[] = [];
  let field = '';
  let inQuotes = false;
  let lastWasCR = false;

  const flushField = () => {
    record.push(field);
    field = '';
  };
  const flushRecord = () => {
    // Normalize: strip surrounding quotes not needed (we already handled quotes)
    // Caller maps headers/values as needed.
    const rec = record;
    record = [];
    return rec;
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      // finalize any pending field/record
      // Treat trailing CR as newline if unpaired
      if (inQuotes) {
        // unterminated quote: treat as text (best-effort)
      }
      if (field.length > 0 || record.length > 0) {
        flushField();
        yield flushRecord();
      }
      return;
    }

    buf += decoder.decode(value, { stream: true });

    // parse char-by-char
    for (; i < buf.length; i++) {
      const ch = buf[i];

      if (inQuotes) {
        if (ch === '"') {
          // Possible escaped quote
          const next = buf[i + 1];
          if (next === '"') {
            field += '"';
            i++; // skip next
          } else {
            inQuotes = false;
          }
        } else {
          field += ch;
        }
        lastWasCR = false;
        continue;
      }

      // not in quotes
      if (ch === '"') {
        inQuotes = true;
        lastWasCR = false;
        continue;
      }

      if (ch === ',') {
        flushField();
        lastWasCR = false;
        continue;
      }

      if (ch === '\n') {
        // LF completes a record; if previous was CR, this is CRLF
        flushField();
        yield flushRecord();
        lastWasCR = false;
        continue;
      }

      if (ch === '\r') {
        // Could be CRLF; don't flush yet—peek next char
        flushField();
        // If next is LF we'll consume it in the next loop iteration
        yield flushRecord();
        lastWasCR = true;
        continue;
      }

      // regular character
      field += ch;
      lastWasCR = false;
    }

    // We consumed buf entirely; reset for next chunk
    buf = '';
    i = 0;
  }
}

/** Download a table CSV as a byte stream. */
export async function fetchTableCsvStream(
  versionId: string,
  opts: { apiBaseUrl?: string } = {}
): Promise<ReadableStream<Uint8Array>> {
  const apiBaseUrl = opts.apiBaseUrl ?? UK_10_DATA_API_BASE;
  const url = `${apiBaseUrl}/v1/datasets/${DATASET_ID}/versions/${versionId}/tables/${TABLE_ID}/data?format=csv`;
  const res = await httpGet(url);
  if (!res.ok) throw new Error(`DBT table CSV failed: ${res.status} ${await res.text()}`);
  const body = res.body;
  if (!body) throw new Error('No response body for CSV stream');
  return body as ReadableStream<Uint8Array>;
}

/** Build a column-name → index map from the first CSV record (headers). */
export function headerIndex(headers: string[]) {
  const map = new Map<string, number>();
  headers.forEach((h, idx) => map.set(h.trim(), idx));
  const idx = (name: string) => map.get(name) ?? -1;
  return { idx, map };
}

/** Safe cell getter by index (returns '' if out of range) */
export function cell(cells: string[], i: number): string {
  return i >= 0 && i < cells.length ? cells[i]! : '';
}
