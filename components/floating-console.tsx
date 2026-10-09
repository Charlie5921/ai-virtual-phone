"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { getApiLogs, type DebugInfo } from '@/lib/api-log-store';
import { addConsoleRecord, clearConsoleRecords, diagnosticMessage, getConsoleRecords, getConsoleServerSnapshot, redactDiagnostic, subscribeConsole } from '@/lib/floating-console-store';

export function FloatingConsole() {
  const records = useSyncExternalStore(subscribeConsole, getConsoleRecords, getConsoleServerSnapshot);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'calls' | 'errors' | 'models'>('calls');
  const [logs, setLogs] = useState<DebugInfo[]>([]);
  const [notice, setNotice] = useState('');
  const [position, setPosition] = useState({ x: 12, y: 150 });
  const panelRef = useRef<HTMLElement>(null);
  const drag = useRef<{ x: number; y: number; startX: number; startY: number; moved: boolean } | null>(null);
  const hiddenIds = useRef(new Set<string>());
  useEffect(() => {
    const onError = (event: ErrorEvent) => addConsoleRecord({ kind: 'error', title: event.message || '页面运行错误', detail: diagnosticMessage(event.error || event.message) });
    const onReject = (event: PromiseRejectionEvent) => addConsoleRecord({ kind: 'error', title: '未处理的异步错误', detail: diagnosticMessage(event.reason) });
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onReject);
    return () => { window.removeEventListener('error', onError); window.removeEventListener('unhandledrejection', onReject); };
  }, []);
  useEffect(() => {
    if (!open) return;
    const refresh = () => setLogs(getApiLogs().filter(log => !hiddenIds.current.has(log.id)).reverse());
    refresh(); const timer = window.setInterval(refresh, 2000);
    return () => window.clearInterval(timer);
  }, [open]);
  useEffect(() => {
    const clamp = () => setPosition(p => ({ x: Math.max(0, Math.min(p.x, window.innerWidth - 64)), y: Math.max(0, Math.min(p.y, window.innerHeight - 64)) }));
    window.addEventListener('resize', clamp); return () => window.removeEventListener('resize', clamp);
  }, []);
  useEffect(() => {
    if (!open) return;
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
      if (e.key !== 'Tab') return;
      const items = panelRef.current?.querySelectorAll<HTMLElement>('button, summary');
      if (!items?.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', escape); return () => window.removeEventListener('keydown', escape);
  }, [open]);
  const failed = records.filter(r => r.kind === 'error' || (r.status !== undefined && r.status >= 400));
  const shown = tab === 'errors' ? failed : records;
  async function copy() {
    const text = tab === 'models' ? JSON.stringify(logs, null, 2) : JSON.stringify(shown, null, 2);
    try { await navigator.clipboard.writeText(redactDiagnostic(text)); setNotice('已复制（分享前请检查聊天隐私）'); }
    catch { setNotice('复制失败，请长按详情手动复制'); }
  }
  return <>
    <button className="fc-launch" style={{ left: position.x, top: position.y }} aria-label="打开悬浮控制台" title="拖动移动，点击查看日志"
      onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, startX: position.x, startY: position.y, moved: false }; }}
      onPointerMove={e => { const d = drag.current; if (!d) return; if (Math.abs(e.clientX-d.x) + Math.abs(e.clientY-d.y) > 5) d.moved = true; if (d.moved) setPosition({ x: Math.max(0, Math.min(window.innerWidth-64, d.startX+e.clientX-d.x)), y: Math.max(0, Math.min(window.innerHeight-64, d.startY+e.clientY-d.y)) }); }}
      onPointerUp={() => { if (!drag.current?.moved) setOpen(true); }} onPointerCancel={() => { drag.current = null; }}
      onClick={e => { if (e.detail === 0) setOpen(true); drag.current = null; }}>
      日志{failed.length > 0 && <span>{failed.length}</span>}
    </button>
    {open && <div className="fc-backdrop" onClick={() => setOpen(false)}><section ref={panelRef} role="dialog" aria-modal="true" aria-label="悬浮控制台" className="fc-panel" onClick={e => e.stopPropagation()}>
      <header><div><small>DEBUG CONSOLE</small><h2>调用与错误记录</h2></div><button autoFocus aria-label="关闭控制台" onClick={() => setOpen(false)}>×</button></header>
      <p>本次页面运行 {records.length} 条诊断 · {failed.length} 条异常 · 最多保留 100 条</p>
      <nav>{([['calls', '请求记录'], ['errors', '异常记录'], ['models', '模型详情']] as const).map(([value, label]) => <button key={value} aria-pressed={tab === value} onClick={() => { setTab(value); setNotice(''); }}>{label}</button>)}</nav>
      <div className="fc-list">
        {tab === 'models' ? <>
          <p>复用已有模型日志；内容可能截断。这里不推测调用成功与否。</p>
          {logs.length === 0 && <p>暂无模型详情，发起一次模型调用后查看。</p>}
          {logs.map(log => <details key={log.id}><summary>{log.characterName || '模型调用'} · {log.model || '未知模型'}<time>{new Date(log.timestamp).toLocaleTimeString()}</time></summary>
            <p>来源：{log.source || '未记录'} · 输入 Token：{log.usage?.prompt_tokens ?? '未返回'} · 输出 Token：{log.usage?.completion_tokens ?? '未返回'}</p>
            <h3>模型返回</h3><pre>{redactDiagnostic(log.rawResponse)}</pre>
            <details><summary>请求消息（可能含私人聊天）</summary><pre>{redactDiagnostic(JSON.stringify(log.messages, null, 2))}</pre></details>
          </details>)}
        </> : <>
          {shown.length === 0 && <p>暂无记录。控制台记录打开页面后的模型请求及未处理异常。</p>}
          {[...shown].reverse().map(record => <details key={record.id}><summary><b>{record.kind === 'error' ? '异常' : `HTTP ${record.status ?? '失败'}`}</b> {record.title}<time>{new Date(record.timestamp).toLocaleTimeString()}</time></summary>
            <p>{record.model && `请求模型：${record.model} · `}{record.route && `通路：${record.route} · `}{record.durationMs !== undefined && `响应头耗时：${record.durationMs} ms`}</p>
            {record.detail && <pre>{record.detail}</pre>}
          </details>)}
        </>}
      </div>
      <footer><button onClick={() => void copy()}>复制当前记录</button><button onClick={() => { if (tab === 'models') { getApiLogs().forEach(log => hiddenIds.current.add(log.id)); setLogs([]); } else clearConsoleRecords(); setNotice('已清空面板记录'); }}>清空</button></footer>
      <p role="status">{notice || '诊断仅保留在本次页面；模型详情读取现有日志。清空模型面板不会删除原日志。'}</p>
    </section></div>}
  </>;
}
