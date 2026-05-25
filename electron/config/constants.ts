/**
 * Sentinel value stored in `momorApiKey` while a free trial is active.
 *
 * The trial token (`momor_trial_…`) is *not* a valid API key, but the
 * downstream code (LLMHelper, momorProSTT, ipcHandlers) needs to treat
 * "trial mode" identically to "key mode" for routing/auto-promotion. We store
 * this sentinel in CredentialsManager so the existing `if (momorApiKey)`
 * branches all light up, then swap the auth header to `x-trial-token` at the
 * actual network boundary.
 *
 * Any place that reads `momorApiKey` and forwards it to the network MUST
 * compare against TRIAL_SENTINEL_KEY (not the literal '__trial__') so a single
 * rename here updates every call site.
 */
export const TRIAL_SENTINEL_KEY = "__trial__" as const;
