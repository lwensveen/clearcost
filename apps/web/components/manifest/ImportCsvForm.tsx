'use client';

import { useFormState } from 'react-dom';
import type { ImportCsvState } from '../../app/(protected)/admin/manifests/[id]/actions';
import { importCsvAction } from '../../app/(protected)/admin/manifests/[id]/actions';
import { useState } from 'react';

export function ImportCsvForm({ id }: { id: string }) {
  const initial: ImportCsvState = { ok: false, error: '' };
  const [state, formAction] = useFormState(importCsvAction.bind(null, id), initial);
  const [open, setOpen] = useState(false);

  return (
    <div className="border rounded p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Import items (CSV)</h3>
        <button className="text-sm underline" onClick={() => setOpen((v) => !v)}>
          {open ? 'Hide' : 'Show'}
        </button>
      </div>

      {open && (
        <form action={formAction} className="space-y-3">
          <div className="flex items-center gap-3">
            <input name="file" type="file" accept=".csv,text/csv" required className="text-sm" />
            <label className="text-sm">
              Mode:{' '}
              <select name="mode" className="border rounded p-1">
                <option value="append">Append</option>
                <option value="replace">Replace</option>
              </select>
            </label>
            <label className="text-sm inline-flex items-center gap-2">
              <input name="dryRun" type="checkbox" /> Dry run
            </label>
            <button type="submit" className="px-3 py-1.5 border rounded text-sm">
              Import
            </button>
          </div>

          {state?.ok ? (
            <div className="text-sm space-y-1">
              <div>
                Mode: <b>{state.result.mode}</b> {state.result.dryRun ? '(dry run)' : ''}
              </div>
              <div>
                Valid rows: <b>{state.result.valid}</b>
              </div>
              <div>
                Invalid rows: <b>{state.result.invalid}</b>
              </div>
              {!state.result.dryRun && (
                <div>
                  Inserted: <b>{state.result.inserted}</b>
                  {state.result.replaced != null ? (
                    <>
                      {' '}
                      &nbsp; (replaced <b>{state.result.replaced}</b>)
                    </>
                  ) : null}
                </div>
              )}
              {state.result.errors?.length ? (
                <details className="mt-2">
                  <summary className="cursor-pointer">Errors</summary>
                  <ul className="list-disc ml-6">
                    {state.result.errors.map((e, i) => (
                      <li key={i}>
                        Line {e.line}: {e.message}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </div>
          ) : state?.error ? (
            <div className="text-sm text-red-600">Error: {state.error}</div>
          ) : null}
        </form>
      )}
    </div>
  );
}
