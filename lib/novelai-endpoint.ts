export const NOVELAI_OFFICIAL_BASE_URL = 'https://image.novelai.net';
/** Preserve relay path prefixes such as /api; accept the full generation URL too. */
export function normalizeNovelAiBaseUrl(value?: string): string {
  const raw = (value?.trim() || NOVELAI_OFFICIAL_BASE_URL).replace(/\/+$/, '').replace(/\/ai\/generate-image$/i, '');
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error('NovelAI Base URL 必须是完整 HTTPS 地址'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error('NovelAI Base URL 请使用不含账号、查询参数的 HTTPS 地址');
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.includes(':') || /^\d+(?:\.\d+)*$/.test(host)) throw new Error('NovelAI Base URL 必须使用公网域名');
  return url.toString().replace(/\/+$/, '');
}
export function novelAiGenerationUrl(value?: string): string { return `${normalizeNovelAiBaseUrl(value)}/ai/generate-image`; }
export function isOfficialNovelAi(value?: string): boolean { return normalizeNovelAiBaseUrl(value) === NOVELAI_OFFICIAL_BASE_URL; }
