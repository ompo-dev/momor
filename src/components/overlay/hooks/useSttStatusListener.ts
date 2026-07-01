import React, { useEffect } from "react";

type Setter = { (updater: (prev: any) => any): void; (value: any): void };
type Ref = React.MutableRefObject<any>;

interface Deps {
  setSttUserStatus: Setter;
  setSttUserProvider: Setter;
  setSttUserError: Setter;
  setSttInterviewerStatus: Setter;
  setSttInterviewerProvider: Setter;
  setSttInterviewerError: Setter;
}

/** STT status listener (survives isExpanded). Verbatim. Relocated (deps array unchanged). */
export function useSttStatusListener({
  setSttUserStatus,
  setSttUserProvider,
  setSttUserError,
  setSttInterviewerStatus,
  setSttInterviewerProvider,
  setSttInterviewerError,
}: Deps) {
  useEffect(() => {
    return window.electronAPI.onSttStatusChanged((data) => {
      if (data.channel === "user") {
        setSttUserStatus((prev) =>
          prev === "failed" && data.state === "reconnecting"
            ? prev
            : data.state,
        );
        setSttUserProvider(data.provider);
        if (data.error) setSttUserError(data.error);
        if (data.state === "connected") setSttUserError("");
      } else if (data.channel === "interviewer") {
        setSttInterviewerStatus((prev) =>
          prev === "failed" && data.state === "reconnecting"
            ? prev
            : data.state,
        );
        setSttInterviewerProvider(data.provider);
        if (data.error) setSttInterviewerError(data.error);
        if (data.state === "connected") setSttInterviewerError("");
      }
    });
  }, []);
}
