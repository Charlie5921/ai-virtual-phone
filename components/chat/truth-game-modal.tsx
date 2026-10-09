"use client";
import { useEffect, useRef, useState } from "react";
import { createGameRound, gameRoundText, type GameMode, type GameRound } from "@/lib/truth-game";
import "./truth-game.css";
const faces = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];
export function TruthGameModal({ sessionId, userName, characterName, onSend, onClose }: { sessionId: string; userName: string; characterName: string; onSend: (text: string) => boolean; onClose: () => void }) {
    const key = `truth-game-v1:${sessionId}`;
    const [round, setRound] = useState<GameRound | null>(null);
    const [mode, setMode] = useState<GameMode>("dice");
    const [busy, setBusy] = useState(false);
    const [rotation, setRotation] = useState(0);
    const [error, setError] = useState("");
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const locked = useRef(false);
    useEffect(() => {
        try {
            const saved = JSON.parse(localStorage.getItem(key) || "null");
            if (saved && typeof saved.id === "string" && ["dice", "wheel"].includes(saved.mode) && ["user", "character", "tie"].includes(saved.loser) && typeof saved.userName === "string" && typeof saved.characterName === "string" && Number.isInteger(saved.userDice) && saved.userDice >= 1 && saved.userDice <= 6 && Number.isInteger(saved.characterDice) && saved.characterDice >= 1 && saved.characterDice <= 6) {
                setRound(saved); setMode(saved.mode);
                setRotation(saved.loser === "user" ? 270 : 90);
            }
        } catch { /* A malformed or unavailable cache does not block play. */ }
        return () => { if (timer.current) clearTimeout(timer.current); };
    }, [key]);
    useEffect(() => {
        const escape = (event: KeyboardEvent) => { if (event.key === "Escape" && !locked.current) onClose(); };
        document.addEventListener("keydown", escape);
        return () => document.removeEventListener("keydown", escape);
    }, [onClose]);
    const save = (next: GameRound) => {
        setRound(next);
        try { localStorage.setItem(key, JSON.stringify(next)); } catch { setError("浏览器无法保存记录，请在关闭前发送结果。"); }
    };
    const play = () => {
        if (locked.current) return;
        locked.current = true; setBusy(true); setError("");
        try {
            const next = createGameRound(mode, userName, characterName);
            save(next); // Commit the draw before showing its animation.
            if (mode === "wheel") setRotation(previous => Math.ceil(previous / 360) * 360 + 1800 + (next.loser === "user" ? 270 : 90));
            const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            timer.current = setTimeout(() => { locked.current = false; setBusy(false); }, reduced ? 0 : mode === "wheel" ? 2400 : 800);
        } catch { locked.current = false; setBusy(false); setError("无法使用浏览器随机数，请刷新后重试。"); }
    };
    const send = () => {
        if (!round || round.sent || locked.current) return;
        locked.current = true;
        if (onSend(gameRoundText(round))) { save({ ...round, sent: true }); onClose(); }
        locked.current = false;
    };
    const loserName = round?.loser === "user" ? round.userName : round?.characterName;
    return <div className="modal-overlay" onClick={() => { if (!busy) onClose(); }}>
        <div className="modal-dialog truth-game" role="dialog" aria-modal="true" aria-label="真心话小游戏" onClick={event => event.stopPropagation()}>
            <div className="truth-heading"><strong>真心话小游戏</strong><button autoFocus type="button" aria-label="关闭小游戏" disabled={busy} onClick={onClose}>×</button></div>
            <p className="truth-hint">随机定输赢，和角色一起玩</p>
            <div className="truth-tabs">{(["dice", "wheel"] as const).map(value => <button type="button" key={value} aria-pressed={mode === value} disabled={busy} onClick={() => setMode(value)}>{value === "dice" ? "骰子" : "转盘"}</button>)}</div>
            {mode === "dice" ? <div className={`truth-dice ${busy ? "rolling" : ""}`}><div><span aria-hidden="true">{faces[(round?.userDice || 1) - 1]}</span><small>{round?.userName || userName}</small></div><div><span aria-hidden="true">{faces[(round?.characterDice || 1) - 1]}</span><small>{round?.characterName || characterName}</small></div></div> : <div className="truth-wheel-wrap"><span className="truth-pointer" aria-hidden="true">▼</span><div className="truth-wheel" style={{ transform: `rotate(${rotation}deg)` }}><span>角色</span><span>你</span></div></div>}
            <p className="truth-hint">{mode === "dice" ? "各掷一次，点数小的人输；平局重掷。" : "你和角色各占一半，指针转到谁，谁就输。"}</p>
            <button type="button" className="truth-primary" disabled={busy} onClick={play}>{busy ? "开奖中…" : round ? "开始下一轮" : mode === "dice" ? "一起掷骰子" : "转动转盘"}</button>
            <div className="truth-result" aria-live="polite">{!busy && round ? <><strong>{round.loser === "tie" ? "平局，再掷一次吧" : `${loserName}输了`}</strong><p>{round.mode === "dice" ? `${round.userName} ${round.userDice}点 · ${round.characterName} ${round.characterDice}点` : "转盘已开奖"}{round.sent ? " · 已发送" : ""}</p>{round.loser !== "tie" ? <div className="truth-tabs">{(["真心话", "大冒险"] as const).map(choice => <button type="button" key={choice} disabled={!!round.sent} aria-pressed={round.choice === choice} onClick={() => save({ ...round, choice })}>{choice}</button>)}</div> : null}<button type="button" className="truth-primary" disabled={!!round.sent} onClick={send}>{round.sent ? "结果已发送" : "发送结果给角色"}</button></> : <p>{busy ? "本轮结果已确定，正在展示…" : "准备好就开始吧"}</p>}</div>
            <p className="truth-hint">可以跳过不舒服的问题和挑战。发送结果后，角色按聊天设置回复。</p>
            {error ? <p role="alert">{error}</p> : null}
        </div>
    </div>;
}
