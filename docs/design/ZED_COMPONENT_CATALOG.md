# Zed Component Catalog

Inventory of Zed's UI components, read from `C:\Projects\Teste\zed`. This is the
source-of-truth list we port from. Two crates matter:

- `crates/ui/src/components/*` — the reusable design-system primitives.
- `crates/agent_ui/src/*` — the AI assistant ("agent") panel & chat UX.

Design tokens (already adopted in Momor): `crates/ui/src/styles/` (`color.rs`,
`typography.rs`, `spacing.rs`, `elevation.rs`) + theme `assets/themes/one/one.json`.

---

## `ui` crate — design-system primitives

| Component | Source | Purpose / where Zed uses it |
|---|---|---|
| **Button family** | `components/button/*` | `Button` (label+icon), `ButtonLike` (base), `IconButton`, `ToggleButton`, `SplitButton`, `ButtonLink`, `CopyButton`. Styles: Filled, Tinted(Accent/Error/Warning/Success), Outlined, OutlinedGhost, Subtle (default), Transparent. Sizes 16–32px. Flat, `rounded_sm`. |
| **Label family** | `components/label/*` | `Label`, `HighlightedLabel` (fuzzy-match highlight), `LoadingLabel`, `SpinnerLabel`, `LabelLike`. Text with size/color/strikethrough. |
| **Headline** | `styles/typography.rs` | Section headings, 5 sizes (XSmall→XLarge), line-height 1.6. |
| **Icon** | `components/icon.rs` + `icon/*` | `Icon` (named, sized, colored), `DecoratedIcon`, `IconDecoration` (badge/overlay on an icon). |
| **Chip** | `components/chip.rs` | Small labeled container, optional icon. Status/metadata tags. ✅ ported |
| **Callout** | `components/callout.rs` | Attention block: severity, icon, title, description, actions, dismiss. Token limits, permission warnings. ✅ ported |
| **Banner** | `components/banner.rs` | Full-width inline banner for prominent messages. |
| **CountBadge** | `components/count_badge.rs` | Small numeric badge (unread counts, etc.). |
| **Indicator** | `components/indicator.rs` | Tiny status dot (online, modified, error). |
| **Avatar** | `components/avatar.rs` | Circular user image w/ fallback + optional availability indicator. |
| **Facepile** | `components/facepile.rs` | Overlapping stack of avatars (collaborators). |
| **List family** | `components/list/*` | `List`, `ListItem` (the core selectable row: icon, label, end-slot, toggle), `ListHeader`, `ListSubHeader`, `ListSeparator`, `ListBulletItem`. Used in pickers, panels, settings. |
| **TreeViewItem** | `components/tree_view_item.rs` | Tree node row (project panel, outline) w/ indent. |
| **IndentGuides** | `components/indent_guides.rs` | Vertical guide lines for tree indentation. |
| **Tab / TabBar** | `components/tab.rs`, `tab_bar.rs` | Editor/panel tab and the tab strip. |
| **Toggle** | `components/toggle.rs` | `Checkbox` and `Switch` controls (on/off, indeterminate). |
| **Disclosure** | `components/disclosure.rs` | Expand/collapse chevron toggle for sections. |
| **Divider** | `components/divider.rs` | Horizontal/vertical hairline separator. |
| **Tooltip** | `components/tooltip.rs` | Hover tooltip (text + optional keybinding). |
| **Keybinding / KeybindingHint** | `components/keybinding.rs`, `keybinding_hint.rs` | Render kbd keys; hint with a leading/trailing label. |
| **ContextMenu** | `components/context_menu.rs` | Right-click / action menu: items, icons, keybinds, separators, submenus. |
| **DropdownMenu** | `components/dropdown_menu.rs` | Trigger button + dropdown list. |
| **PopoverMenu** | `components/popover_menu.rs` | Menu rendered in a popover. |
| **RightClickMenu** | `components/right_click_menu.rs` | Wrapper attaching a context menu on right-click. |
| **Popover** | `components/popover.rs` | Floating surface anchored to a trigger. |
| **Modal** | `components/modal.rs` | Centered modal container (header/body/footer). |
| **Notification** | `components/notification/*` | `AlertModal` (blocking alert), `AnnouncementToast` (transient toast). |
| **Progress** | `components/progress/*` | `ProgressBar`, `CircularProgress`. |
| **DataTable** | `components/data_table.rs` + `table_row.rs` | Tabular data with rows/columns. |
| **DiffStat** | `components/diff_stat.rs` | `+adds / -dels` stat display. |
| **Scrollbar** | `components/scrollbar.rs` | Custom themed scrollbar / thumb. |
| **Stack** | `components/stack.rs` | `h_flex` / `v_flex` layout helpers (used everywhere). |
| **Group** | `components/group.rs` | Visual grouping container. |
| **GradientFade** | `components/gradient_fade.rs` | Edge gradient mask (overflow fade). |
| **Image** | `components/image.rs` | Image element w/ loading/fallback states. |
| **RedistributableColumns** | `components/redistributable_columns.rs` | Resizable / draggable column layout. |
| **StickyItems** | `components/sticky_items.rs` | Sticky headers/items in a scroll list. |
| **Navigable** | `components/navigable.rs` | Keyboard-navigable wrapper (arrow-key focus). |
| **AI setup widgets** | `components/ai/*` | `AgentSetupButton`, `AiSettingItem` (settings row), `ConfiguredApiCard` (a configured provider card), `ParallelAgentsIllustration`, `ThreadItem` (agent thread row). |
| **Collab** | `components/collab/*` | `CollabNotification`, `UpdateButton`. |

---

## `agent_ui` crate — the AI assistant / chat experience

| Component | Source | Purpose |
|---|---|---|
| **AgentPanel** | `agent_panel.rs` | The whole assistant panel: thread view + composer + toolbars. |
| **MessageEditor** | `message_editor.rs` | The composer: multiline input, context pills, bottom toolbar (model/mode/profile + send). |
| **ConversationView / ThreadView** | `conversation_view.rs`, `conversation_view/thread_view.rs` | The rendered message thread (user + assistant turns, tool calls). |
| **ModelSelector** | `model_selector.rs`, `language_model_selector.rs`, `agent_model_selector.rs`, `model_selector_popover.rs`, `favorite_models.rs`, `ui/model_selector_components.rs` | Language-model picker (provider → model, favorites, search). |
| **ModeSelector** | `mode_selector.rs` | Agent mode selector (ask / write / etc.). |
| **ProfileSelector** | `profile_selector.rs` | Agent profile picker. |
| **AgentConfiguration** | `agent_configuration.rs` + `agent_configuration/*` | Provider/config UI: `AddLlmProviderModal`, `ConfigureContextServerModal`, `ManageProfilesModal`, `ToolPicker`. |
| **AgentDiff** | `agent_diff.rs` | Diff view of agent-proposed edits. |
| **InlinePromptEditor** | `inline_prompt_editor.rs`, `inline_assistant.rs` | Inline "edit with AI" prompt box. |
| **Agent toasts/upsells** | `ui/agent_notification.rs`, `ui/end_trial_upsell.rs`, `ui/undo_reject_toast.rs`, `ui/hold_for_default.rs` | Transient agent notifications and upsell banners. |
| **ThreadsArchiveView** | `threads_archive_view.rs` | History of past threads. |

> Title bar / window chrome lives in a separate Zed crate (`crates/title_bar`) —
> referenced for Momor's `WindowControls` / header.
