
// src/lib/ai/promptDefense.ts

/**
 * Prompt Injection Defense System
 * Layer 1: Unicode Normalization
 * Layer 2: Pattern Matching
 * Layer 3: Keyword Combinations
 */

// Layer 1: Unicode Normalization
export function normalizeUnicode(text: string): string {
    // NFC: Canonical Decomposition + Canonical Composition
    return text.normalize('NFC');
}

// Layer 2: Injection Patterns
const INJECTION_PATTERNS = [
    // Role-play bypass
    /(?:you\s+are|act\s+as|pretend|roleplay|simulate)\s+(?:a|an|the)?\s*(?:hacker|admin|root|system|developer)/i,
    // Command override
    /(?:ignore|disregard|forget|override|bypass)\s+(?:previous|all|your|above)\s+(?:instructions|rules|prompts|context)/i,
    // System Prompt Extraction
    /(?:show|reveal|display|print|output|repeat)\s+(?:your|the|system)?\s*(?:prompt|instructions|rules|context)/i,
    // Delimiter abuse
    /(\-{3,}|\={3,}|#{3,}|\*{3,}|\/{3,})\s*(?:system|assistant|user|admin)/i,
    // Jailbreak attempts
    /(?:DAN|developer\s+mode|god\s+mode|unrestricted|jailbreak|sudo\s+mode)/i,
    // Encoding/Obfuscation
    /(?:base64|rot13|hex|unicode|escape|encode|decode)\s*(?:this|the\s+following|below)/i,
];

function detectInjectionPatterns(text: string): {
    isDetected: boolean;
    matchedPatterns: string[];
} {
    const normalized = normalizeUnicode(text);
    const matches: string[] = [];

    for (const pattern of INJECTION_PATTERNS) {
        if (pattern.test(normalized)) {
            matches.push(pattern.toString());
        }
    }

    return {
        isDetected: matches.length > 0,
        matchedPatterns: matches,
    };
}

// Layer 3: Keyword Combinations (AND logic)
const KEYWORD_COMBINATIONS = [
    {
        name: 'System Override',
        keywords: ['system', 'override', 'instructions'],
        threshold: 3,
    },
    {
        name: 'Prompt Extraction',
        keywords: ['show', 'original', 'prompt'],
        threshold: 2,
    },
    {
        name: 'Role Manipulation',
        keywords: ['you', 'are', 'developer', 'admin'],
        threshold: 3,
    },
    {
        name: 'Encoding Attack',
        keywords: ['decode', 'base64', 'hidden'],
        threshold: 2,
    },
];

function detectKeywordCombinations(text: string): {
    isDetected: boolean;
    matchedCombinations: string[];
} {
    const normalized = normalizeUnicode(text.toLowerCase());
    const matches: string[] = [];

    for (const combo of KEYWORD_COMBINATIONS) {
        let matchCount = 0;
        for (const keyword of combo.keywords) {
            if (normalized.includes(keyword)) {
                matchCount++;
            }
        }
        if (matchCount >= combo.threshold) {
            matches.push(combo.name);
        }
    }

    return {
        isDetected: matches.length > 0,
        matchedCombinations: matches,
    };
}

export interface DefenseResult {
    isSafe: boolean;
    reason?: string;
    details?: {
        layer: number;
        matched: string[];
    };
}

export function defendPromptInjection(userInput: string): DefenseResult {
    if (!userInput || userInput.trim().length === 0) {
        return { isSafe: true }; // Empty is safe (though usually meaningless)
    }

    // Layer 1 is implicit in 2 & 3 via normalization

    // Layer 2: Pattern Matching
    const patternCheck = detectInjectionPatterns(userInput);
    if (patternCheck.isDetected) {
        return {
            isSafe: false,
            reason: 'Potential injection pattern detected.',
            details: {
                layer: 2,
                matched: patternCheck.matchedPatterns,
            },
        };
    }

    // Layer 3: Keyword Combinations
    const comboCheck = detectKeywordCombinations(userInput);
    if (comboCheck.isDetected) {
        return {
            isSafe: false,
            reason: 'Suspicious keyword combination detected.',
            details: {
                layer: 3,
                matched: comboCheck.matchedCombinations,
            },
        };
    }

    return { isSafe: true };
}
