import type { Character } from "./character-types";
import { loadWorldBooks, saveWorldBooks, parseWorldBookFromJson, loadBindingConfig, getCharacterBinding, setCharacterBinding, saveBindingConfig } from "./settings-storage";

export function importCharacterWorldBook(character: Character): number {
    const raw = character.tavernData?.character_book;
    if (!raw || typeof raw !== "object") return 0;
    const book = parseWorldBookFromJson(JSON.stringify(raw));
    if (!book) throw new Error("角色已导入，但卡内世界书格式无效");
    if (!book.entries.length) return 0;
    book.id = `wb-card-${character.id}`;
    book.name = (raw as { name?: string }).name || `${character.name}的世界书`;
    const books = loadWorldBooks();
    if (!books.some(existing => existing.id === book.id)) saveWorldBooks([...books, book]);
    const config = loadBindingConfig();
    const binding = getCharacterBinding(config, character.id);
    binding.defaults = { ...binding.defaults, worldBookIds: Array.from(new Set([
        ...(binding.defaults.worldBookIds ?? config.globalDefaults.worldBookIds ?? []), book.id,
    ])) };
    saveBindingConfig(setCharacterBinding(config, binding));
    return book.entries.length;
}
