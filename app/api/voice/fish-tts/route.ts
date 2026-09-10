import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 120;

const FISH_TTS_ENDPOINT = "https://api.fish.audio/v1/tts";
const FISH_MODEL = "s2.1-pro-free";
const MAX_TEXT_LENGTH = 5000;
const MAX_REFERENCE_ID_LENGTH = 200;

function clampSpeed(value: unknown): number {
    const speed = typeof value === "number" && Number.isFinite(value) ? value : 1;
    return Math.min(2, Math.max(0.5, speed));
}

function safeUpstreamMessage(payload: unknown, fallback: string): string {
    if (!payload || typeof payload !== "object") return fallback;
    const data = payload as Record<string, unknown>;
    const detail = data.detail;
    if (typeof detail === "string") return detail.slice(0, 500);
    if (Array.isArray(detail)) {
        return detail
            .map(item => {
                if (!item || typeof item !== "object") return "";
                const message = (item as Record<string, unknown>).msg;
                return typeof message === "string" ? message : "";
            })
            .filter(Boolean)
            .join("；")
            .slice(0, 500) || fallback;
    }
    if (typeof data.message === "string") return data.message.slice(0, 500);
    return fallback;
}

export async function POST(request: Request) {
    let body: Record<string, unknown>;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "请求内容不是有效的 JSON" }, { status: 400 });
    }

    const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
    const text = typeof body.text === "string" ? body.text.trim() : "";
    const referenceId = typeof body.referenceId === "string" ? body.referenceId.trim() : "";

    if (!apiKey) {
        return NextResponse.json({ error: "请先填写 Fish Audio API Key" }, { status: 400 });
    }
    if (!text) {
        return NextResponse.json({ error: "朗读文字不能为空" }, { status: 400 });
    }
    if (text.length > MAX_TEXT_LENGTH) {
        return NextResponse.json({ error: `单次朗读不能超过 ${MAX_TEXT_LENGTH} 个字符` }, { status: 400 });
    }
    if (!referenceId) {
        return NextResponse.json({ error: "请填写 Fish Audio 音色 reference_id" }, { status: 400 });
    }
    if (referenceId.length > MAX_REFERENCE_ID_LENGTH || /[\r\n]/.test(referenceId)) {
        return NextResponse.json({ error: "Fish Audio 音色 reference_id 格式不正确" }, { status: 400 });
    }

    try {
        const response = await fetch(FISH_TTS_ENDPOINT, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
                model: FISH_MODEL,
            },
            body: JSON.stringify({
                text,
                reference_id: referenceId,
                format: "mp3",
                normalize: true,
                latency: "normal",
                prosody: {
                    speed: clampSpeed(body.speed),
                    volume: 0,
                    normalize_loudness: true,
                },
            }),
            cache: "no-store",
        });

        if (!response.ok) {
            const payload = await response.json().catch(() => null);
            const message = safeUpstreamMessage(payload, `Fish Audio 请求失败 (${response.status})`);
            const status = response.status >= 400 && response.status < 500 ? response.status : 502;
            return NextResponse.json({ error: message }, { status });
        }

        return new Response(response.body, {
            status: 200,
            headers: {
                "Content-Type": response.headers.get("content-type") || "audio/mpeg",
                "Cache-Control": "no-store",
            },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Fish Audio 服务暂时无法连接";
        return NextResponse.json({ error: message.slice(0, 500) }, { status: 502 });
    }
}
