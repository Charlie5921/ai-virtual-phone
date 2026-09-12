import { createWorldBook, parseWorldBookFromJson } from "./settings-storage";
import type { WorldBookConfig } from "./settings-types";

export function worldBookFromText(text: string, name: string): WorldBookConfig {
    const normalized = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").trim();
    if (!normalized) throw new Error("文档没有可导入的文字");
    const book = createWorldBook(name);
    const sections: { title: string; content: string }[] = [];
    let title = "";
    let lines: string[] = [];
    let hasHeading = false;
    const flush = () => {
        const content = lines.join("\n").trim();
        if (content || title) sections.push({ title, content });
        lines = [];
    };
    for (const line of normalized.split("\n")) {
        const heading = line.match(/^\s*#{1,6}\s+(.+)$/) || line.match(/^\s*【([^】]+)】\s*$/);
        if (heading) {
            hasHeading = true;
            flush();
            title = heading[1].trim();
        } else lines.push(line);
    }
    flush();
    const entries = hasHeading ? sections : normalized.split(/\n\s*\n/).filter(Boolean).map(content => ({ title: "", content }));
    book.entries = entries.map((entry, index) => ({
        uid: `${book.id}-entry-${index}`, key: "", comment: entry.title || `条目 ${index + 1}`,
        content: entry.content, use_regex: false, disable: false, constant: true,
        position: "before_char", insertion_order: index, probability: 100, useProbability: false,
    }));
    return book;
}

export async function importWorldBookFile(file: File): Promise<WorldBookConfig> {
    if (file.size > 20 * 1024 * 1024) throw new Error("文件不能超过 20 MB");
    const name = file.name.replace(/\.[^.]+$/, "");
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (extension === "json") {
        const book = parseWorldBookFromJson((await file.text()).replace(/^\uFEFF/, ""));
        if (!book) throw new Error("无法解析世界书 JSON，请检查条目格式");
        return book;
    }
    if (extension === "txt") {
        const bytes = await file.arrayBuffer();
        let text: string;
        const prefix = new Uint8Array(bytes);
        if (prefix[0] === 255 && prefix[1] === 254) text = new TextDecoder("utf-16le").decode(bytes);
        else if (prefix[0] === 254 && prefix[1] === 255) text = new TextDecoder("utf-16be").decode(bytes);
        else {
            try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
            catch { text = new TextDecoder("gb18030").decode(bytes); }
        }
        return worldBookFromText(text, name);
    }
    if (extension !== "docx") throw new Error("请选择 JSON、TXT 或 DOCX 文件");
    const { default: JSZip } = await import("jszip");
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const document = zip.file("word/document.xml");
    if (!document) throw new Error("无效的 DOCX 文档（不支持旧版 DOC 文件）");
    const xml = new DOMParser().parseFromString(await document.async("string"), "application/xml");
    if (xml.getElementsByTagName("parsererror").length) throw new Error("DOCX 文档内容已损坏");
    const ns = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
    const paragraphs = Array.from(xml.getElementsByTagNameNS(ns, "p")).map(p => {
        const text = Array.from(p.getElementsByTagNameNS(ns, "t")).map(t => t.textContent || "").join("");
        const style = p.getElementsByTagNameNS(ns, "pStyle")[0]?.getAttributeNS(ns, "val") || "";
        return /^(heading[1-6]|标题[1-6])$/i.test(style) ? `# ${text}` : text;
    });
    return worldBookFromText(paragraphs.join("\n\n"), name);
}
