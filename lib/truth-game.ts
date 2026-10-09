export type GameMode = "dice" | "wheel";
export type GameRound = { id: string; mode: GameMode; userName: string; characterName: string; userDice: number; characterDice: number; loser: "user" | "character" | "tie"; choice?: "真心话" | "大冒险"; sent?: boolean };
export function randomGameInt(size: number): number {
    const limit = Math.floor(0x100000000 / size) * size;
    const buffer = new Uint32Array(1);
    do { crypto.getRandomValues(buffer); } while (buffer[0] >= limit);
    return buffer[0] % size;
}
export function createGameRound(mode: GameMode, userName: string, characterName: string): GameRound {
    const userDice = randomGameInt(6) + 1;
    const characterDice = randomGameInt(6) + 1;
    const loser = mode === "wheel" ? (randomGameInt(2) === 0 ? "user" : "character") : userDice === characterDice ? "tie" : userDice < characterDice ? "user" : "character";
    return { id: crypto.randomUUID(), mode, userName, characterName, userDice, characterDice, loser };
}
export function gameRoundText(round: GameRound): string {
    const result = round.loser === "tie" ? "平局，本轮无人输赢，请重新掷骰子。" : `${round.loser === "user" ? round.userName : round.characterName}输了${round.choice ? `，选择${round.choice}` : ""}。`;
    return `【真心话小游戏 · ${round.mode === "dice" ? "骰子" : "转盘"}】\n${round.mode === "dice" ? `规则：双方各掷一枚六面骰子，点数小的人输，平局重掷。\n${round.userName}：${round.userDice}点；${round.characterName}：${round.characterDice}点。` : "规则：双方各占半个转盘，转到谁，谁就输。"}\n${result}\n本轮结果已由浏览器随机确定，请按此结果互动，不要另行决定或更改输赢。双方都可以跳过不愿回答的问题或不愿执行的挑战。`;
}
