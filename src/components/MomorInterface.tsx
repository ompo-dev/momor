import React from "react";
import OverlayPanel from "./overlay/OverlayPanel";
import { useMomorOverlay } from "./useMomorOverlay";
import type { momorInterfaceProps } from "./momorShared";

const MomorInterface: React.FC<momorInterfaceProps> = (props) => {
  const panelProps = useMomorOverlay(props);
  return <OverlayPanel {...panelProps} />;
};

export default MomorInterface;
