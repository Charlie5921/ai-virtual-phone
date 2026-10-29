'use client';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import type { ChatSession } from '@/lib/chat-storage';
import { loadChatOfflineTurns, loadActiveOfflineTurns } from '@/lib/chat-offline-storage';
import { endOfflineMeeting, loadOfflineMeetings, summarizeOfflineMeeting, type OfflineMeeting } from '@/lib/offline-meetings';

export function SendAsModal({ name, busy, onSend, onClose }: { name: string; busy: boolean; onSend: (text: string) => void; onClose: () => void }) {
    const [text, setText] = useState('');
    return <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="替 TA 发言"><div className="modal-dialog">
        <div className="modal-header"><h3 className="modal-title">替 {name} 发言</h3></div>
        <div className="modal-body"><p>以 TA 的身份加入聊天，TA 下次回复会接着这条内容。不会自动请求回复。</p><textarea aria-label="代发内容" className="w-full rounded-xl p-3 bg-[var(--c-input)]" rows={6} value={text} onChange={e => setText(e.target.value)} /></div>
        <div className="modal-footer"><button className="ui-btn" onClick={onClose}>取消</button><button className="ui-btn ui-btn-primary" disabled={busy || !text.trim()} onClick={() => onSend(text.trim())}>替 TA 发送</button></div>
    </div></div>;
}
export function OfflineMeetingsPanel({ session, busy, onChanged, onReturn, onArchived }: { session: ChatSession; busy: boolean; onChanged: () => void; onReturn: () => void; onArchived: () => void }) {
    const [open, setOpen] = useState(false);
    const [working, setWorking] = useState(false);
    const [title, setTitle] = useState('');
    const [error, setError] = useState('');
    const [selected, setSelected] = useState<OfflineMeeting | null>(null);
    const [draft, setDraft] = useState('');
    const [, refresh] = useState(0);
    const meetings = loadOfflineMeetings(session.id);
    const runSummary = async (m: OfflineMeeting, edited?: string) => {
        setWorking(true); setError('');
        try { await summarizeOfflineMeeting(session, m, edited); onChanged(); refresh(n => n + 1); setSelected(null); }
        catch (e) { setError(`记录已保留，待补总结：${e instanceof Error ? e.message : String(e)}`); }
        finally { setWorking(false); }
    };
    return <span className="offline-meeting-header-action" style={{ display: "inline-flex", flexShrink: 0 }}>
        <button type="button" aria-label="结束本场或查看过往线下" className="ui-btn" style={{ padding: "6px 10px", fontSize: 13, whiteSpace: "nowrap" }} onClick={() => setOpen(true)}>结束 / 记录</button>
        {open && createPortal(<div className="modal-overlay" style={{ zIndex: 10000 }} role="dialog" aria-modal="true" aria-label="线下场次"><div className="modal-dialog" style={{ maxHeight: '85dvh', overflowY: 'auto' }}>
            <div className="modal-header"><h3 className="modal-title">线下场次 · 当前 {loadActiveOfflineTurns(session.id).length} 轮</h3></div>
            <div className="modal-body space-y-3">
                <p>暂时返回线上会保留本场。结束并总结后，下次进入就是新场合。</p>
                <input aria-label="本场标题" placeholder="本场标题，如：周末约会" value={title} onChange={e => setTitle(e.target.value)} className="w-full p-3 rounded-xl bg-[var(--c-input)]" />
                <button className="ui-btn ui-btn-primary" disabled={busy || working || !loadActiveOfflineTurns(session.id).length} onClick={async () => {
                    setWorking(true); setError('');
                    try {
                        const m = endOfflineMeeting(session, title);
                        onChanged(); onArchived();
                        try { await summarizeOfflineMeeting(session, m); } catch (e) { setError(`本场已归档，待补总结：${e instanceof Error ? e.message : String(e)}`); }
                        refresh(n => n + 1); setTitle('');
                    } catch (e) { setError(String(e)); } finally { setWorking(false); }
                }}>{working ? '正在整理…' : '结束并总结本场'}</button>
                {error && <p role="alert" className="text-red-500">{error}</p>}
                <h4>过往线下（完整记录保留）</h4>
                {meetings.slice().reverse().map(m => <div key={m.id} className="p-3 rounded-xl bg-[var(--c-input)] space-y-2"><b>{m.title}</b><p>{new Date(m.endedAt).toLocaleString()} · {m.summary ? '已写入共享记忆' : '待补总结'}</p>
                    <button className="ui-btn" disabled={working} onClick={() => { setSelected(m); setDraft(m.summary || ''); }}>查看记录 / 编辑总结</button>
                    {!m.summary && <button className="ui-btn" disabled={working} onClick={() => void runSummary(m)}>补总结</button>}
                </div>)}
                {selected && <section className="space-y-2"><h4>{selected.title}</h4><textarea aria-label="场次总结" rows={5} value={draft} onChange={e => setDraft(e.target.value)} className="w-full p-3 bg-[var(--c-input)]" /><button className="ui-btn" disabled={working || !draft.trim()} onClick={() => void runSummary(selected, draft)}>保存总结到记忆</button>
                    {loadChatOfflineTurns(session.id).filter(t => t.meetingId === selected.id).map(t => <div key={t.id} className="whitespace-pre-wrap border-t py-3"><p>我：{t.userContent}</p><p>TA：{t.assistantContent}</p></div>)}
                </section>}
            </div>
            <div className="modal-footer"><button className="ui-btn" disabled={working} onClick={() => setOpen(false)}>关闭</button><button className="ui-btn" disabled={working || busy} onClick={() => { setOpen(false); onReturn(); }}>返回线上</button></div>
        </div></div>, document.body)}
    </span>;
}
