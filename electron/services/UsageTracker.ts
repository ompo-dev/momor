/**
 * UsageTracker — accumulates estimated token usage and cost per provider per session.
 *
 * Token estimation uses a fixed 4-char/token ratio (same as LLMHelper.estimateTokens).
 * Cost rates are approximate mid-2025 prices — close enough for user awareness.
 *
 * Exposed via IPC so the UI can show total spend per session and all-time totals.
 */

export interface ProviderUsageSample {
  provider: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  timestamp: number;
}

export interface SessionUsageSummary {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
  byProvider: Record<string, { inputTokens: number; outputTokens: number; costUsd: number }>;
  sessionStartMs: number;
}

// Approximate cost per 1M tokens (USD), mid-2025 pricing
const COST_PER_1M: Record<string, { input: number; output: number }> = {
  gemini:   { input: 0.075, output: 0.30  },  // Gemini Flash
  groq:     { input: 0.06,  output: 0.06  },  // Llama 3.3 70B via Groq
  openai:   { input: 2.50,  output: 10.0  },  // GPT-5.4 (approx)
  claude:   { input: 3.00,  output: 15.0  },  // Claude Sonnet
  deepseek: { input: 0.27,  output: 1.10  },  // DeepSeek Chat
  momor:    { input: 0.00,  output: 0.00  },  // Internal — no external cost
  codex:    { input: 0.00,  output: 0.00  },  // Local CLI
  ollama:   { input: 0.00,  output: 0.00  },  // Local
};

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function costForTokens(provider: string, inputTokens: number, outputTokens: number): number {
  const rates = COST_PER_1M[provider] ?? { input: 1.0, output: 4.0 };
  return (inputTokens * rates.input + outputTokens * rates.output) / 1_000_000;
}

export class UsageTracker {
  private static instance: UsageTracker | null = null;

  private samples: ProviderUsageSample[] = [];
  private sessionStartMs: number = Date.now();

  private constructor() {}

  static getInstance(): UsageTracker {
    if (!UsageTracker.instance) {
      UsageTracker.instance = new UsageTracker();
    }
    return UsageTracker.instance;
  }

  /** Call after each successful LLM response. inputText = prompt, outputText = response. */
  record(provider: string, inputText: string, outputText: string): void {
    const inputTokens = estimateTokens(inputText);
    const outputTokens = estimateTokens(outputText);
    const estimatedCostUsd = costForTokens(provider, inputTokens, outputTokens);

    this.samples.push({ provider, inputTokens, outputTokens, estimatedCostUsd, timestamp: Date.now() });

    if (estimatedCostUsd > 0.01) {
      console.log(`[UsageTracker] ${provider}: ~${inputTokens}in/${outputTokens}out tokens, ~$${estimatedCostUsd.toFixed(4)}`);
    }
  }

  /** Reset counters at meeting start. */
  resetSession(): void {
    this.samples = [];
    this.sessionStartMs = Date.now();
  }

  getSessionSummary(): SessionUsageSummary {
    const byProvider: Record<string, { inputTokens: number; outputTokens: number; costUsd: number }> = {};
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCostUsd = 0;

    for (const s of this.samples) {
      if (!byProvider[s.provider]) {
        byProvider[s.provider] = { inputTokens: 0, outputTokens: 0, costUsd: 0 };
      }
      byProvider[s.provider].inputTokens += s.inputTokens;
      byProvider[s.provider].outputTokens += s.outputTokens;
      byProvider[s.provider].costUsd += s.estimatedCostUsd;
      totalInputTokens += s.inputTokens;
      totalOutputTokens += s.outputTokens;
      totalCostUsd += s.estimatedCostUsd;
    }

    return { totalInputTokens, totalOutputTokens, totalCostUsd, byProvider, sessionStartMs: this.sessionStartMs };
  }
}
