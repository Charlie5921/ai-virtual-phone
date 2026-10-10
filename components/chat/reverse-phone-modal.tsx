"use client";
import { useEffect, useRef, useState } from "react";
import { loadCharacters } from "@/lib/character-storage";
import { loadChatSessions, type ChatSession } from "@/lib/chat-storage";
import { collectReversePhoneSources, generateReversePhoneSteps } from "@/lib/reverse-phone-engine";
import { clearReversePhoneRecords, loadReversePhoneRecords, saveReversePhoneRecord, type ReversePhoneRecord } from "@/lib/chat-personal-features";
import { appNowISO } from "@/lib/app-clock";
export function ReversePhoneModal({ session, onClose, onRecord }: { session: ChatSession; onClose: () => void; onRecord: (text: string) => void }) {
    const [selected, setSelected] = useState<string[]>([session.id]);
    const [moments, setMoments] = useState(false);
    const [wallet, setWallet] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [record, setRecord] = useState<ReversePhoneRecord | null>(null);
    const [stepIndex, setStepIndex] = useState(0);
    const [auto, setAuto] = useState(false);
    const [minimized, setMinimized] = useState(false);
    const [history, setHistory] = useState(() => loadReversePhoneRecords(session.id));
    const controller = useRef<AbortController | null>(null);
    const pending = useRef(false);
    const recorded = useRef(false);
    const character = loadCharacters().find(value => value.id === session.contactId);
    const characterName = character?.name || "TA";
    const sessions = loadChatSessions().slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const characters = loadCharacters();
    useEffect(() => () => { controller.current?.abort(); }, []);
    useEffect(() => {
        if (!auto || !record || minimized) return;
        const timer = setTimeout(() => { if (stepIndex + 1 < record.steps.length) setStepIndex(stepIndex + 1); else setAuto(false); }, 6000);
        return () => clearTimeout(timer);
    }, [auto, record, stepIndex, minimized]);
    useEffect(() => {
        if (record && !recorded.current) saveReversePhoneRecord(session.id, { ...record, steps: record.steps.slice(0, stepIndex + 1), completed: false });
    }, [record, stepIndex, session.id]);
    const start = async () => {
        if (pending.current) return;
        pending.current = true; setBusy(true); setError("");
        const abort = new AbortController(); controller.current = abort;
        try {
            const sources = collectReversePhoneSources(selected, moments, wallet);
            const steps = await generateReversePhoneSteps(session, sources, abort.signal);
            if (abort.signal.aborted) return;
            const next = { id: crypto.randomUUID(), createdAt: appNowISO(), characterId: session.contactId, steps, completed: false };
            setRecord(next); setStepIndex(0); recorded.current = false;
        } catch (caught) {
            if (!abort.signal.aborted) setError(caught instanceof Error ? caught.message : "反查失败，请重试。");
        } finally { pending.current = false; if (!abort.signal.aborted) setBusy(false); }
    };
    const finish = () => {
        controller.current?.abort(); setAuto(false);
        if (record && !recorded.current) {
            recorded.current = true;
            const visited = record.steps.slice(0, stepIndex + 1);
            const saved = { ...record, steps: visited, completed: stepIndex + 1 === record.steps.length };
            saveReversePhoneRecord(session.id, saved);
            onRecord(`[反查手机] ${characterName}查看了你的虚拟手机：\n${visited.map(step => `· ${step.title}\n心声：${step.thought}\n反应：${step.reaction}`).join("\n")}\n你已拿回手机，查阅结束。`);
        }
        onClose();
    };
    const step = record?.steps[stepIndex];
    if (minimized) return <div className="fixed bottom-24 right-4 z-[10050] flex gap-2 rounded-2xl p-3 bg-[var(--c-panel)] text-[var(--c-text)] shadow-lg"><button type="button" onClick={() => setMinimized(false)}>{characterName}在翻你的手机 · 展开</button><button type="button" aria-label="拿回手机" onClick={finish}>✕</button></div>;
    return <div className="modal-overlay" style={{ zIndex: 10040 }}><div className="modal-dialog w-[min(94vw,460px)] max-h-[86dvh] overflow-y-auto p-5 text-[var(--c-text)]" role="dialog" aria-modal="true" aria-label="让角色查我的手机">
        <div className="flex justify-between gap-3 items-center"><h3 className="font-semibold">{characterName}查我的手机</h3><button autoFocus type="button" aria-label="拿回手机并关闭" onClick={finish}>✕</button></div>
        {!record ? <><p className="menu-desc my-3">选择 TA 可以看的内容。只读取小手机内的记录；开始时调用一次当前角色的聊天 API。</p><div className="flex flex-col gap-2 max-h-[32dvh] overflow-y-auto">{sessions.map(target => <label key={target.id} className="flex items-center gap-2 p-2 rounded-xl bg-[var(--c-input)]"><input type="checkbox" disabled={busy || (!selected.includes(target.id) && selected.length >= 6)} checked={selected.includes(target.id)} onChange={event => setSelected(previous => event.target.checked ? [...previous, target.id] : previous.filter(id => id !== target.id))} /><span>{target.isGroup ? target.groupName || "群聊" : target.alias || characters.find(value => value.id === target.contactId)?.name || "联系人"}{target.id === session.id ? "（你们的聊天）" : ""}</span></label>)}</div><p className="menu-desc mt-2">最多选择 6 个聊天，每个窗口只提供最近 8 条可见消息。</p><div className="flex gap-4 my-4"><label><input type="checkbox" disabled={busy} checked={moments} onChange={event => setMoments(event.target.checked)} /> 朋友圈</label><label><input type="checkbox" disabled={busy} checked={wallet} onChange={event => setWallet(event.target.checked)} /> 虚拟钱包</label></div><button type="button" className="ui-btn ui-btn-primary w-full" disabled={busy || (!selected.length && !moments && !wallet)} onClick={() => void start()}>{busy ? "TA 正在准备翻看…" : "把手机交给 TA"}</button>{error ? <p role="alert" className="mt-3 ts-12">{error}</p> : null}{history.length ? <details className="mt-4 ts-12"><summary>最近的查阅记录（{history.length}）</summary>{history.slice().reverse().map(item => <details key={item.id} className="mt-3"><summary>{new Date(item.createdAt).toLocaleString()} · {item.steps.length}页</summary>{item.steps.map((view, index) => <p key={index} className="whitespace-pre-wrap mt-2">{`${view.title}\n${view.thought}\n${view.reaction}`}</p>)}</details>)}<button type="button" className="ui-btn ui-btn-outline mt-3" onClick={() => { clearReversePhoneRecords(session.id); setHistory([]); }}>清空查阅记录</button></details> : null}</> : step ? <><p className="menu-desc my-3">正在看 {stepIndex + 1} / {record.steps.length} 页</p><div className="p-4 rounded-2xl bg-[var(--c-input)]"><strong>{step.title}</strong><pre className="mt-3 whitespace-pre-wrap break-words ts-12 max-h-[24dvh] overflow-y-auto font-sans">{step.excerpt}</pre></div><div className="p-4 mt-3 rounded-2xl bg-[var(--c-panel)] border border-[var(--c-border)]" aria-live="polite"><p className="ts-12 opacity-60">TA 的心声</p><p className="mt-1 whitespace-pre-wrap">{step.thought || "…"}</p><p className="ts-12 opacity-60 mt-3">TA 的反应</p><p className="mt-1 whitespace-pre-wrap">{step.reaction || "TA 默默看着屏幕。"}</p></div><div className="flex gap-2 mt-4"><button type="button" className="ui-btn ui-btn-outline flex-1" onClick={() => setAuto(value => !value)}>{auto ? "暂停" : "自动播放"}</button><button type="button" className="ui-btn ui-btn-primary flex-1" onClick={() => { if (stepIndex + 1 < record.steps.length) setStepIndex(stepIndex + 1); else finish(); }}>{stepIndex + 1 < record.steps.length ? "下一页" : "结束查阅"}</button></div><div className="flex gap-2 mt-3"><button type="button" className="ui-btn ui-btn-outline flex-1" onClick={() => { setAuto(false); setMinimized(true); }}>收起旁观</button><button type="button" className="ui-btn ui-btn-outline flex-1" onClick={finish}>拿回手机</button></div></> : null}
    </div></div>;
}
