import React, { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { Heart } from "lucide-react";
import mainui from "../UI_comp/mainui.png";

interface FeatureSlide {
  id: string;
  headline: string;
  subtitle?: string;
  subtitleLines?: string[];
  type?: "love";
  eyebrow?: string;
  bullets?: string[];
  footer?: string;
}

const fontStack =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text"';

export const FeatureSpotlight: React.FC = () => {
  const { t } = useTranslation();

  const FEATURES: FeatureSlide[] = useMemo(
    () => [
      {
        id: "made_for_you",
        eyebrow: t("featureSpotlight.slide1Eyebrow"),
        headline: t("featureSpotlight.slide1Headline"),
        subtitleLines: [
          t("featureSpotlight.slide1Line1"),
          t("featureSpotlight.slide1Line2"),
        ],
        type: "love",
      },
      {
        id: "interviews",
        eyebrow: t("featureSpotlight.slide2Eyebrow"),
        headline: t("featureSpotlight.slide2Headline"),
        subtitle: t("featureSpotlight.slide2Subtitle"),
        bullets: [
          t("featureSpotlight.slide2Bullet1"),
          t("featureSpotlight.slide2Bullet2"),
        ],
        type: "love",
      },
      {
        id: "together",
        eyebrow: t("featureSpotlight.slide3Eyebrow"),
        headline: t("featureSpotlight.slide3Headline"),
        subtitleLines: [
          t("featureSpotlight.slide3Line1"),
          t("featureSpotlight.slide3Line2"),
        ],
        type: "love",
      },
      {
        id: "kisses",
        eyebrow: t("featureSpotlight.slide4Eyebrow"),
        headline: t("featureSpotlight.slide4Headline"),
        subtitleLines: [
          t("featureSpotlight.slide4Line1"),
          t("featureSpotlight.slide4Line2"),
        ],
        footer: t("featureSpotlight.slide4Footer"),
        type: "love",
      },
    ],
    [t],
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const currentFeature = FEATURES[currentIndex];

  useEffect(() => {
    if (isPaused) return;
    const timer = setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % FEATURES.length);
    }, 8500);
    return () => clearTimeout(timer);
  }, [currentIndex, isPaused, FEATURES.length]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="relative h-full w-full overflow-hidden rounded-xl select-none bg-gradient-to-br from-[#1a1218] via-[#1C1C1E] to-[#151516]"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      style={{ isolation: "isolate" }}
    >
      <div className="absolute inset-0 z-0 pointer-events-none">
        <img
          src={mainui}
          alt=""
          className="w-full h-full object-cover opacity-85 transition-transform duration-700 ease-out group-hover:scale-110"
        />
        <motion.div
          className="absolute inset-0 bg-black/20"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        />
      </div>

      <div
        className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none"
        aria-hidden
      >
        <div
          className="w-[200px] h-[200px] rounded-full blur-[70px]"
          style={{
            background:
              "radial-gradient(circle, rgba(244, 164, 184, 0.2) 0%, transparent 70%)",
          }}
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentFeature.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="absolute inset-0 z-10 flex items-center justify-center px-6 pb-8"
        >
          <div className="flex flex-col items-center text-center gap-1 max-w-[320px]">
            {currentFeature.eyebrow && (
              <div className="flex items-center gap-1 text-[10px] font-semibold tracking-[0.12em] text-rose-300/90 uppercase">
                <Heart
                  size={10}
                  className="fill-rose-300/40 text-rose-300/90 shrink-0"
                />
                {currentFeature.eyebrow}
              </div>
            )}

            <h2
              className="text-[25px] font-medium leading-[1.15] tracking-tight text-[#F9C4D2]"
              style={{ fontFamily: fontStack }}
            >
              {currentFeature.headline}
            </h2>

            {currentFeature.subtitleLines ? (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
                className="flex flex-col items-center gap-0.5"
              >
                {currentFeature.subtitleLines.map((line, idx) => (
                  <p
                    key={idx}
                    className="text-[13px] leading-[1.35] text-[#F5F7FA]/88"
                    style={{ fontFamily: fontStack }}
                  >
                    {line}
                  </p>
                ))}
              </motion.div>
            ) : currentFeature.subtitle ? (
              <p
                className="text-[13px] leading-[1.35] text-[#F5F7FA]/88"
                style={{ fontFamily: fontStack }}
              >
                {currentFeature.subtitle}
              </p>
            ) : null}

            {currentFeature.bullets && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1], delay: 0.08 }}
                className="flex flex-col items-center gap-0.5 mt-0.5"
              >
                {currentFeature.bullets.map((bullet, idx) => (
                  <span
                    key={idx}
                    className="text-[11.5px] leading-snug font-medium text-[#F9C4D2]/90"
                  >
                    {bullet}
                  </span>
                ))}
              </motion.div>
            )}

            {currentFeature.footer && (
              <p className="text-[13px] font-medium text-[#F9C4D2]/90 mt-0.5">
                {currentFeature.footer}
              </p>
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="absolute bottom-2.5 left-0 right-0 z-20 flex items-center justify-center gap-1.5">
        {FEATURES.map((slide, idx) => (
          <button
            key={slide.id}
            type="button"
            aria-label={`Slide ${idx + 1}`}
            onClick={() => setCurrentIndex(idx)}
            className={`h-1 rounded-full transition-all duration-300 ${
              idx === currentIndex
                ? "w-4 bg-rose-300/90"
                : "w-1 bg-white/30 hover:bg-white/50"
            }`}
          />
        ))}
      </div>
    </motion.div>
  );
};
