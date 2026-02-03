
// src/lib/ai/estimator.ts

/**
 * Token Estimation Utility
 * - GPT-4 tokenizer reference (Claude is similar)
 * - English: ~4 chars / token
 * - Korean: ~2 chars / token (more expensive)
 */
export function estimateTokens(userMessage: string): number {
    if (!userMessage) return 0;

    const charCount = userMessage.length;

    // Korean characters have higher density
    // Simple heuristic: treat it as 2.5 chars per token for safety
    const estimatedInputTokens = Math.ceil(charCount / 2.5);

    // AI response estimation (Conservative: 3x input)
    // This is just a reservation, actual usage is corrected later
    const estimatedOutputTokens = estimatedInputTokens * 3;

    // System Prompt overhead (Fixed ~200)
    const systemPromptTokens = 200;

    // Safety buffer (1.5x)
    const buffer = 1.5;

    return Math.ceil(
        (estimatedInputTokens + estimatedOutputTokens + systemPromptTokens) * buffer
    );
}
