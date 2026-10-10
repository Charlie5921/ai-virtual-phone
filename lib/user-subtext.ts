import type { ChatMessage } from "./chat-storage";
export const USER_SUBTEXT_LIMIT = 1000;
export function normalizeUserSubtext(value: unknown): string {
    return typeof value === "string" ? value.replace(/\u0000/g, "").trim().slice(0, USER_SUBTEXT_LIMIT) : "";
}
export function appendUserSubtext(body: string, msg: Pick<ChatMessage, "role" | "userSubtext" | "isRetracted">): string {
    const subtext = msg.role === "user" && !msg.isRetracted ? normalizeUserSubtext(msg.userSubtext) : "";
    return subtext ? `${body}\n【用户为这条消息补充的潜台词 / 场外提示】${subtext}\n（这不是用户说出口的话。依照场景和可观察表现回应，不要让角色直接读心或把提示当成对白。）` : body;
}
