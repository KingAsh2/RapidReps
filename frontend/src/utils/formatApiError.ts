/**
 * Safely coerce an Axios/FastAPI error into a human-readable string.
 *
 * FastAPI returns:
 *   - 422 (validation): `detail = [{type, loc, msg, input, url}, ...]`  ← Pydantic v2
 *   - 4xx/5xx (custom): `detail = "Some message"`
 *
 * Rendering the v2 array directly as a React child crashes with:
 *   "Objects are not valid as a React child (found: object with keys
 *    {type, loc, msg, input, url})".
 *
 * Always pipe API errors through this helper before showing them in any UI.
 */
export function formatApiError(err: unknown, fallback = 'Something went wrong. Try again.'): string {
  // Axios shape: err.response.data.detail
  // Direct fetch shape: err.detail
  // Native Error: err.message
  const anyErr = err as any;
  const detail =
    anyErr?.response?.data?.detail ??
    anyErr?.data?.detail ??
    anyErr?.detail ??
    anyErr?.message;

  if (!detail) return fallback;
  if (typeof detail === 'string') return detail;

  // Pydantic v2 validation array → join human messages
  if (Array.isArray(detail)) {
    const msgs = detail
      .map((d) => {
        if (typeof d === 'string') return d;
        if (d && typeof d === 'object') {
          // Prefer `msg`, fall back to a stringified loc+msg combo
          const loc = Array.isArray(d.loc) ? d.loc.filter((p: any) => p !== 'body').join('.') : '';
          const m = typeof d.msg === 'string' ? d.msg : '';
          return loc && m ? `${loc}: ${m}` : m || loc;
        }
        return '';
      })
      .filter(Boolean);
    if (msgs.length) return msgs.join('\n');
  }

  // Plain object with a `msg` property
  if (detail && typeof detail === 'object' && typeof (detail as any).msg === 'string') {
    return (detail as any).msg;
  }

  return fallback;
}
