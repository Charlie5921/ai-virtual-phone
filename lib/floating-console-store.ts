// Session-only diagnostics. Never persist request headers or API keys.
export type ConsoleRecord = { id: string; timestamp: string; kind: 'http' | 'error'; title: string; status?: number; durationMs?: number; detail?: string; model?: string; route?: string };
const listeners = new Set<() => void>();
let records: ConsoleRecord[] = [];
export function redactDiagnostic(value: string): string {
  return value.replace(/Bearer\s+[^\s"',;]+/gi, 'Bearer [已隐藏]')
    .replace(/\b(?:sk-|AIza)[A-Za-z0-9_-]+/g, '[密钥已隐藏]')
    .replace(/(["']?(?:api[_-]?key|authorization|access[_-]?token|token|secret|password)["']?\s*[:=]\s*)(["']?)[^\s,"'&}]+\2/gi, '$1[已隐藏]')
    .replace(/https?:\/\/[^\s<>"']+/g, url => { try { const u = new URL(url); return u.origin + u.pathname; } catch { return '[地址已隐藏]'; } });
}
export function subscribeConsole(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }
export function getConsoleRecords() { return records; }
const empty: ConsoleRecord[] = [];
export function getConsoleServerSnapshot() { return empty; }
export function clearConsoleRecords() { records = []; listeners.forEach(fn => fn()); }
export function addConsoleRecord(entry: Omit<ConsoleRecord, 'id' | 'timestamp'>) {
  records = [...records, { ...entry, title: redactDiagnostic(entry.title).slice(0, 300), detail: entry.detail ? redactDiagnostic(entry.detail).slice(0, 8000) : undefined, id: `${Date.now()}-${Math.random()}`, timestamp: new Date().toISOString() }].slice(-100);
  listeners.forEach(fn => fn());
}
export function diagnosticMessage(error: unknown) { return error instanceof Error ? error.stack || error.message : String(error); }
