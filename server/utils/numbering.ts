import { queryOne, execute, transaction } from '../db/database.js';

interface CompanySettingsRow {
  id: string;
  invoice_prefix: string | null;
  invoice_next_number: number | null;
}

interface JobSettingsRow {
  id: string;
  job_prefix: string | null;
  job_next_number: number | null;
}

/**
 * Atomically allocate the next invoice number and advance the counter.
 *
 * better-sqlite3 is fully synchronous and single-threaded per process, so a
 * read-increment-write with no `await` between the read and the write is
 * atomic within the process. We still wrap it in `transaction()` so that if
 * the UPDATE ever throws, the whole allocation rolls back rather than
 * leaving the counter in a half-advanced state.
 *
 * NOTE: `invoice_prefix` already includes its trailing separator (default
 * 'INV-'), so we concatenate `prefix + paddedNumber` directly — no extra
 * dash is inserted.
 */
export function allocateInvoiceNumber(): string {
  return transaction(() => {
    const s = queryOne<CompanySettingsRow>(
      'SELECT id, invoice_prefix, invoice_next_number FROM company_settings LIMIT 1'
    ).data;
    const prefix = s?.invoice_prefix ?? 'INV-';
    const next = s?.invoice_next_number ?? 1;
    const number = `${prefix}${String(next).padStart(5, '0')}`;
    if (s) {
      execute('UPDATE company_settings SET invoice_next_number = ? WHERE id = ?', [next + 1, s.id]);
    }
    return number;
  });
}

/**
 * Atomically allocate the next job number and advance the counter.
 * Mirrors `allocateInvoiceNumber()` but uses the `job_prefix` /
 * `job_next_number` columns on `company_settings`.
 */
export function allocateJobNumber(): string {
  return transaction(() => {
    const s = queryOne<JobSettingsRow>(
      'SELECT id, job_prefix, job_next_number FROM company_settings LIMIT 1'
    ).data;
    const prefix = s?.job_prefix ?? 'JOB-';
    const next = s?.job_next_number ?? 1;
    const number = `${prefix}${String(next).padStart(5, '0')}`;
    if (s) {
      execute('UPDATE company_settings SET job_next_number = ? WHERE id = ?', [next + 1, s.id]);
    }
    return number;
  });
}
