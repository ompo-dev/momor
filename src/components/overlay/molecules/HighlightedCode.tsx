import React from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";

// Module-scope stable style object so SyntaxHighlighter (Prism), which has no
// internal render bailout, keeps referential identity across streaming tokens.
const HC_CUSTOM_STYLE = {
  margin: 0,
  borderRadius: 0,
  fontSize: "13px",
  lineHeight: "1.6",
  background: "transparent",
  padding: "16px",
  fontFamily:
    "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
} as const;

export interface HighlightedCodeProps {
  code: string;
  lang: string;
  isLightTheme: boolean;
  codeTheme: any;
  codeBlockClass: string;
  codeHeaderClass: string;
  codeHeaderTextClass: string;
  codeLineNumberColor: string;
  appearance: any;
}

/** One syntax-highlighted code block. Memoized so streaming re-renders skip it. */
const HighlightedCode = React.memo(
  function HighlightedCode({
    code,
    lang,
    codeTheme,
    codeBlockClass,
    codeHeaderClass,
    codeHeaderTextClass,
    codeLineNumberColor,
    appearance,
  }: HighlightedCodeProps) {
    return (
      <div
        className={`my-3 rounded-xl overflow-hidden border shadow-lg ${codeBlockClass}`}
        style={appearance.codeBlockStyle}
      >
        <div
          className={`px-3 py-1.5 border-b ${codeHeaderClass}`}
          style={appearance.codeHeaderStyle}
        >
          <span
            className={`text-[10px] uppercase tracking-widest font-semibold font-mono ${codeHeaderTextClass}`}
          >
            {lang || "CODE"}
          </span>
        </div>
        <div className="bg-transparent overflow-x-auto">
          <SyntaxHighlighter
            language={lang}
            style={codeTheme}
            customStyle={HC_CUSTOM_STYLE}
            wrapLongLines={false}
            showLineNumbers={true}
            lineNumberStyle={{
              minWidth: "2.5em",
              paddingRight: "1.2em",
              color: codeLineNumberColor,
              textAlign: "right",
              fontSize: "11px",
            }}
          >
            {code}
          </SyntaxHighlighter>
        </div>
      </div>
    );
  },
  (prev, next) =>
    prev.code === next.code &&
    prev.lang === next.lang &&
    prev.appearance === next.appearance,
);

export default HighlightedCode;
