// Unified LLM fetch outlet with session-only request diagnostics.
import type { LlmRequestPayload } from './llm-provider-adapter';
import { addConsoleRecord, diagnosticMessage } from './floating-console-store';
export type FetchLlmPayloadOptions = { signal?: AbortSignal };
export async function fetchLlmPayload(payload: LlmRequestPayload, options: FetchLlmPayloadOptions = {}): Promise<Response> {
    const started = performance.now();
    const bodyText = JSON.stringify(payload.body);
    let title = '模型请求';
    try { const url = new URL(payload.url); title = url.hostname + url.pathname; } catch { /* avoid logging raw URLs with credentials */ }
    const body = payload.body as Record<string, unknown>;
    const metadata = { title, model: typeof body.model === 'string' ? body.model : undefined, route: payload.serverProxy ? '本站代理' : '浏览器直连' };
    try {
        const response = await fetch(payload.serverProxy ? '/api/llm-proxy' : payload.url, {
            method: 'POST',
            headers: payload.serverProxy ? { 'Content-Type': 'application/json' } : payload.headers,
            body: payload.serverProxy ? JSON.stringify({ url: payload.url, headers: payload.headers, body: bodyText }) : bodyText,
            signal: options.signal,
        });
        addConsoleRecord({ ...metadata, kind: 'http', status: response.status, durationMs: Math.round(performance.now() - started), detail: response.ok ? '已收到 HTTP 响应头。流式生成是否完整请结合模型详情查看。' : `HTTP ${response.status} ${response.statusText}` });
        // Inspect only failed bodies, asynchronously and with a strict byte budget.
        // Never consume or wait for the response returned to the caller.
        if (!response.ok && response.body) {
            const copy = response.clone();
            void (async () => {
                const reader = copy.body?.getReader(); if (!reader) return;
                const timeout = setTimeout(() => { void reader.cancel().catch(() => undefined); }, 5000);
                const decoder = new TextDecoder(); let text = ''; let size = 0;
                try {
                    while (size < 8000) { const chunk = await reader.read(); if (chunk.done) break; const bytes = chunk.value.slice(0, 8000 - size); size += bytes.length; text += decoder.decode(bytes, { stream: true }); }
                    text += decoder.decode();
                    if (text) addConsoleRecord({ ...metadata, kind: 'error', title: `${title} · 错误响应详情`, status: response.status, detail: text });
                } catch { /* diagnostics must not affect requests */ }
                finally { clearTimeout(timeout); void reader.cancel().catch(() => undefined); }
            })();
        }
        return response;
    } catch (error) {
        addConsoleRecord({ ...metadata, kind: 'error', durationMs: Math.round(performance.now() - started), detail: diagnosticMessage(error) });
        throw error;
    }
}
