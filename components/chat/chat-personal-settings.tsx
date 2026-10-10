"use client";
import { useEffect, useState } from "react";
import { getCharacterBinding, loadBindingConfig, loadUserIdentities, resolveUserIdentity, saveBindingConfig, setCharacterBinding } from "@/lib/settings-storage";
import { getCharacterImageAppearance, saveCharacterImageAppearance } from "@/lib/chat-personal-features";
import type { ChatSession } from "@/lib/chat-storage";
export function ChatPersonalSettings({ session, onClose }: { session: ChatSession; onClose: () => void }) {
    const [revision, setRevision] = useState(0);
    const [showAppearance, setShowAppearance] = useState(false);
    const [appearance, setAppearance] = useState("");
    useEffect(() => {
        const sync = () => setRevision(value => value + 1);
        window.addEventListener("settings-bindings-updated", sync);
        window.addEventListener("settings-identities-updated", sync);
        return () => { window.removeEventListener("settings-bindings-updated", sync); window.removeEventListener("settings-identities-updated", sync); };
    }, []);
    if (session.isGroup) return null;
    const identities = loadUserIdentities();
    const config = loadBindingConfig();
    const binding = getCharacterBinding(config, session.contactId);
    const selected = binding.appOverrides.chat?.userIdentityId || "";
    const resolvedName = resolveUserIdentity(session.contactId, "chat")?.name || "未设置";
    return <><div className="menu-group" data-revision={revision}>
        <div className="menu-item"><div className="menu-label-group"><span className="menu-label">我的面具</span><span className="menu-desc">与这个角色聊天时使用 · 当前 {resolvedName}</span></div><select aria-label="这个角色绑定的用户面具" className="max-w-[45%] rounded-xl p-2 bg-[var(--c-input)] text-[var(--c-text)] ts-12" value={selected} onChange={event => {
            const current = loadBindingConfig();
            const target = getCharacterBinding(current, session.contactId);
            const slot = { ...target.appOverrides.chat };
            if (event.target.value) slot.userIdentityId = event.target.value; else delete slot.userIdentityId;
            saveBindingConfig(setCharacterBinding(current, { ...target, appOverrides: { ...target.appOverrides, chat: slot } }));
        }}><option value="">跟随原有绑定</option>{identities.map(identity => <option key={identity.id} value={identity.id}>{identity.name}</option>)}</select></div>
        {!identities.length ? <p className="menu-desc px-4 pb-3">先在手机设置的用户身份里创建面具。</p> : null}
        <button type="button" className="menu-item w-full text-left" onClick={() => { setAppearance(getCharacterImageAppearance(session.contactId)); setShowAppearance(true); }}><div className="menu-label-group"><span className="menu-label">角色生图长相</span><span className="menu-desc">固定发型、瞳色、体型和配饰，生成图片时自动加入</span></div><span>›</span></button>
        <button type="button" className="menu-item w-full text-left" onClick={() => { window.dispatchEvent(new CustomEvent("open-reverse-phone", { detail: { sessionId: session.id } })); onClose(); }}><div className="menu-label-group"><span className="menu-label">让 TA 查我的手机</span><span className="menu-desc">选择可看的聊天、朋友圈和虚拟钱包，旁观 TA 的反应</span></div><span>›</span></button>
    </div>{showAppearance ? <div className="modal-overlay" onClick={() => setShowAppearance(false)}><div className="modal-dialog p-5 w-[min(90vw,430px)]" role="dialog" aria-modal="true" aria-label="角色生图长相" onClick={event => event.stopPropagation()}><h3 className="font-semibold mb-3">角色生图长相</h3><p className="menu-desc mb-3">仅用于生图，不会修改聊天人设。同一个角色的聊天、朋友圈等生图共用。NovelAI 建议填英文标签；参考图仍按原设置使用。</p><textarea autoFocus aria-label="角色外貌提示词" maxLength={3000} className="w-full min-h-[180px] p-3 rounded-xl bg-[var(--c-input)] text-[var(--c-text)]" placeholder="例如：1boy, black hair, blue eyes, silver glasses" value={appearance} onChange={event => setAppearance(event.target.value)} /><div className="flex justify-end gap-2 mt-3"><button type="button" className="ui-btn ui-btn-outline" onClick={() => setShowAppearance(false)}>取消</button><button type="button" className="ui-btn ui-btn-primary" onClick={() => { saveCharacterImageAppearance(session.contactId, appearance); setShowAppearance(false); }}>保存</button></div><p className="menu-desc mt-2">清空并保存即可恢复原来的生图提示。</p></div></div> : null}</>;
}
