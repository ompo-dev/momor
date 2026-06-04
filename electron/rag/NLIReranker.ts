/**
 * NLIReranker — uses the bundled mobilebert-uncased-mnli model as a cross-encoder
 * to rerank RAG candidates by semantic relevance to a query.
 *
 * Pattern: zero-shot-classification with hypothesis_template
 *   pipe(chunkText, [query], { hypothesis_template: "This is relevant to: {}" })
 *   → scores[0] = ENTAILMENT probability = relevance score
 *
 * Only applied to the top-N candidates after embedding-similarity sort to keep
 * latency bounded (~10-50ms per chunk on CPU with quantized model).
 */

import path from 'path';
import { app } from 'electron';
import type { ScoredChunk } from './VectorStore';

/** Maximum candidates to rerank with NLI (bounds latency). */
const NLI_RERANK_TOP_N = 4;

/** Weight of NLI score vs original embedding similarity (0–1). */
const NLI_BLEND_WEIGHT = 0.35;

export class NLIReranker {
    private static instance: NLIReranker | null = null;
    private pipe: any = null;
    private loadingPromise: Promise<void> | null = null;
    private loadFailed = false;

    private constructor() {}

    static getInstance(): NLIReranker {
        if (!NLIReranker.instance) {
            NLIReranker.instance = new NLIReranker();
        }
        return NLIReranker.instance;
    }

    private async ensureLoaded(): Promise<void> {
        if (this.pipe) return;
        if (this.loadFailed) return;

        if (this.loadingPromise) {
            await this.loadingPromise;
            return;
        }

        this.loadingPromise = (async () => {
            try {
                const { pipeline, env } = await new Function("return import('@huggingface/transformers')")();

                if (app.isPackaged) {
                    env.allowRemoteModels = false;
                    env.localModelPath = path.join(process.resourcesPath, 'models');
                } else {
                    env.allowRemoteModels = true;
                    env.cacheDir = path.join(__dirname, '../../resources/models');
                }

                console.log('[NLIReranker] Loading mobilebert-uncased-mnli...');
                this.pipe = await pipeline(
                    'zero-shot-classification',
                    'Xenova/mobilebert-uncased-mnli',
                    { local_files_only: app.isPackaged }
                );
                console.log('[NLIReranker] Model loaded.');
            } catch (e) {
                console.warn('[NLIReranker] Failed to load model, NLI reranking disabled:', e);
                this.loadFailed = true;
                this.pipe = null;
            }
        })();

        try {
            await this.loadingPromise;
        } catch {
            this.loadingPromise = null;
        }
    }

    /**
     * Rerank the top-N chunks using NLI entailment scores.
     * Blends NLI score with existing finalScore. Falls back to original order on failure.
     * Only processes the first NLI_RERANK_TOP_N chunks; the rest are returned unchanged.
     */
    async rerank(query: string, chunks: ScoredChunk[]): Promise<ScoredChunk[]> {
        if (chunks.length === 0) return chunks;

        await this.ensureLoaded();
        if (!this.pipe) return chunks;

        const toRerank = chunks.slice(0, NLI_RERANK_TOP_N);
        const rest = chunks.slice(NLI_RERANK_TOP_N);

        try {
            const nliScores = await Promise.all(
                toRerank.map(async (chunk) => {
                    try {
                        const result = await this.pipe(
                            chunk.text,
                            [query],
                            { hypothesis_template: 'This text is relevant to: {}', multi_label: false }
                        );
                        return result.scores[0] as number;
                    } catch {
                        return chunk.similarity; // fallback: use embedding similarity
                    }
                })
            );

            const reranked = toRerank.map((chunk, i) => ({
                ...chunk,
                finalScore: (1 - NLI_BLEND_WEIGHT) * (chunk.finalScore ?? chunk.similarity)
                    + NLI_BLEND_WEIGHT * nliScores[i],
            }));

            reranked.sort((a, b) => (b.finalScore ?? 0) - (a.finalScore ?? 0));

            console.log(`[NLIReranker] Reranked ${toRerank.length} chunks for query (${query.slice(0, 40)}...)`);
            return [...reranked, ...rest];
        } catch (e) {
            console.warn('[NLIReranker] Reranking failed, using original order:', e);
            return chunks;
        }
    }
}
