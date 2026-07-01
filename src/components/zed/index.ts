// Zed component library — faithful React ports of Zed's GPUI components
// (crates/ui + crates/agent_ui). See docs/design/ZED_MOMOR_CROSSWALK.md.
//
// Primitives already live under components/ui (button, chip, callout, switch,
// tooltip, etc. — all Zed-anatomy). This folder adds the higher-level / chat
// components that have no shadcn base and are ported directly from Zed.

export { ZedIconButton } from "./ZedIconButton";
export type { ZedIconButtonProps } from "./ZedIconButton";
export { ZedKeyBinding } from "./ZedKeyBinding";
export type { ZedKeyBindingProps } from "./ZedKeyBinding";
export { ZedListItem } from "./ZedListItem";
export type { ZedListItemProps } from "./ZedListItem";
export { ZedThreadMessage } from "./ZedThreadMessage";
export type { ZedThreadMessageProps, ZedThreadRole } from "./ZedThreadMessage";
export { ZedComposer } from "./ZedComposer";
export type { ZedComposerProps } from "./ZedComposer";
