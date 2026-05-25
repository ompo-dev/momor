// Startup banner shown when any Momor quota bucket reaches ≥90% usage.

import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X, ArrowUpRight } from "lucide-react";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";

interface QuotaBucket {
  used: number;
  limit: number;
  remaining: number;
}

interface NearLimitBucket {
  label: string;
  used: number;
  limit: number;
  pct: number;
}

const STARTUP_DELAY_MS = 3000;
const THRESHOLD_PCT = 90;
const UPGRADE_URL =
  "https://github.com/momor-AI-assistant/momor-cluely-ai-assistant";

export const MomorQuotaBanner: React.FC = () => {
  const { t } = useTranslation();
  const [nearLimitBuckets, setNearLimitBuckets] = useState<NearLimitBucket[]>(
    [],
  );
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      await new Promise((r) => setTimeout(r, STARTUP_DELAY_MS));
      if (cancelled) return;

      try {
        const result = await window.electronAPI?.getmomorUsage?.();
        if (cancelled || !result?.ok || !result.quota) return;

        const { transcription, ai, search } = result.quota as {
          transcription: QuotaBucket;
          ai: QuotaBucket;
          search: QuotaBucket;
        };

        const near: NearLimitBucket[] = (
          [
            { label: "AI requests", bucket: ai },
            { label: "Transcription", bucket: transcription },
            { label: "Web searches", bucket: search },
          ] as Array<{ label: string; bucket: QuotaBucket }>
        )
          .filter(
            ({ bucket }) =>
              bucket.limit > 0 &&
              (bucket.used / bucket.limit) * 100 >= THRESHOLD_PCT,
          )
          .map(({ label, bucket }) => ({
            label,
            used: bucket.used,
            limit: bucket.limit,
            pct: Math.round((bucket.used / bucket.limit) * 100),
          }));

        if (near.length === 0) return;
        setNearLimitBuckets(near);
        setVisible(true);
      } catch {
        /* non-critical */
      }
    };

    check();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!visible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.96 }}
        transition={{ duration: 0.25, ease: [0.2, 0, 0, 1] }}
        className="fixed bottom-6 right-6 z-[9999] pointer-events-auto w-[320px]"
      >
        <Card className="border-amber-500/30 shadow-2xl">
          <CardContent className="p-4 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertTriangle size={14} className="text-amber-500 shrink-0" />
                <span className="text-sm font-semibold">{t("quota.almostFull")}</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => setVisible(false)}
              >
                <X size={14} />
              </Button>
            </div>
            <div className="flex flex-col gap-1.5">
              {nearLimitBuckets.map(({ label, used, limit, pct }) => (
                <div key={label} className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">{label}</span>
                  <Badge
                    variant={pct >= 100 ? "destructive" : "secondary"}
                    className="tabular-nums text-[11px]"
                  >
                    {used.toLocaleString()} / {limit.toLocaleString()} ({pct}%)
                  </Badge>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between pt-0.5">
              <span className="text-[11px] text-muted-foreground">{t("quota.resetsOn")}</span>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 text-amber-600 dark:text-amber-400"
                onClick={() =>
                  (window.electronAPI as { openExternal?: (u: string) => void })?.openExternal?.(
                    UPGRADE_URL,
                  )
                }
              >
                {t("quota.upgrade")} <ArrowUpRight size={11} className="ml-0.5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
};
