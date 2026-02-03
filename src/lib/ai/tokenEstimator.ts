
export function estimateTokens(text: string): number {
    if (!text) return 0;
    // Rough estimation: 1 token ~= 4 chars or 0.75 words
    // For English: text.length / 4
    // For Korean/Unicode: text.length / 1.5 (conservative)

    // Simple heuristic
    return Math.ceil(text.length / 2.5);
}
