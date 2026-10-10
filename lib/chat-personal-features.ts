import { kvGet, kvSet, registerKvMigration } from "./kv-db";
const KEY = "ai_phone_chat_personal_features_v1";
registerKvMigration(KEY);
export const CHAT_PERSONAL_FEATURES_UPDATED = "chat-personal-features-updated";
export type ReversePhoneStep = { sourceId: string; title: string; excerpt: string; thought: string; reaction: string };
export type ReversePhoneRecord = { id: string; createdAt: string; characterId: string; steps: ReversePhoneStep[]; completed: boolean };
type Features = { appearances: Record<string, string>; reverse: Record<string, ReversePhoneRecord[]> };
function load(): Features {
    try {
        const raw = JSON.parse(kvGet(KEY) || "{}");
        return { appearances: raw?.appearances && typeof raw.appearances === "object" ? raw.appearances : {}, reverse: raw?.reverse && typeof raw.reverse === "object" ? raw.reverse : {} };
    } catch { return { appearances: {}, reverse: {} }; }
}
function write(value: Features): void {
    kvSet(KEY, JSON.stringify(value));
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(CHAT_PERSONAL_FEATURES_UPDATED));
}
export function getCharacterImageAppearance(characterId?: string): string {
    const value = characterId ? load().appearances[characterId] : "";
    return typeof value === "string" ? value.slice(0, 3000) : "";
}
export function saveCharacterImageAppearance(characterId: string, value: string): void {
    const data = load();
    const cleaned = value.replace(/\u0000/g, "").trim().slice(0, 3000);
    if (cleaned) data.appearances[characterId] = cleaned;
    else delete data.appearances[characterId];
    write(data);
}
export function mergeCharacterImageAppearance(description: string, appearance: string): string {
    return [appearance.trim(), description.trim()].filter(Boolean).join(", ");
}
export function loadReversePhoneRecords(sessionId: string): ReversePhoneRecord[] {
    const value = load().reverse[sessionId];
    if (!Array.isArray(value)) return [];
    return value.filter(record => record && typeof record.id === "string" && typeof record.createdAt === "string" && Array.isArray(record.steps))
        .slice(-10).map(record => ({ ...record, steps: record.steps.filter((step: ReversePhoneStep) => step && [step.sourceId, step.title, step.excerpt, step.thought, step.reaction].every(field => typeof field === "string")).slice(0, 6) }));
}
export function saveReversePhoneRecord(sessionId: string, record: ReversePhoneRecord): void {
    const data = load();
    const list = loadReversePhoneRecords(sessionId).filter(item => item.id !== record.id);
    data.reverse[sessionId] = [...list, record].slice(-10);
    write(data);
}
export function clearReversePhoneRecords(sessionId: string): void {
    const data = load(); delete data.reverse[sessionId]; write(data);
}
