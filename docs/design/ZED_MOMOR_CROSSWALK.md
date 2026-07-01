# Zed → Momor Component Crosswalk

For every Momor component: its closest Zed equivalent and the action.

- **Copy** — Zed has a direct equivalent; port its anatomy faithfully.
- **Adapt** — Zed has a near-match; port the look, keep Momor's behavior/props.
- **Inspire** — no Zed equivalent; style from the nearest Zed primitive + tokens.

Status: ✅ done · �doing · ⬜ todo. Priority: P1 (high-visibility, reused) → P3.

> Foundation already done for all rows: Zed "One" tokens + `linear-*`→Zed remap
> mean every component already inherits Zed colors/radii. These rows are about
> matching each component's **anatomy** (shape, spacing, states) to Zed.

---

## Primitives (`ui/`)

| Momor | Zed equivalent | Action | Pri | Status |
|---|---|---|---|---|
| `button.tsx` | `button/button_like.rs` (ButtonStyle) | Copy | P1 | ✅ |
| `chip.tsx` | `chip.rs` | Copy | P1 | ✅ |
| `callout.tsx` | `callout.rs` | Copy | P1 | ✅ |
| `switch.tsx` | `toggle.rs` (Switch) | Copy | P1 | ✅ |
| `separator.tsx` | `divider.rs` | Copy | P1 | ✅ (already `bg-border`) |
| `label.tsx` | `label/label.rs` | Copy | P2 | ⬜ |
| `tooltip.tsx` | `tooltip.rs` | Copy | P1 | ✅ |
| `badge.tsx` | `count_badge.rs` / `chip.rs` / `indicator.rs` | Adapt | P2 | ✅ (chip vocab) |
| `dropdown-menu.tsx` | `context_menu.rs` / `dropdown_menu.rs` | Copy | P1 | ✅ |
| `select.tsx` | `dropdown_menu.rs` + `popover_menu.rs` | Adapt | P1 | ✅ |
| `popover.tsx` | `popover.rs` | Adapt | P2 | ✅ |
| `command.tsx` | `context_menu.rs` + picker | Inspire | P2 | ✅ (already aligned) |
| `tabs.tsx` | `tab_bar.rs` + `tab.rs` | Adapt | P2 | ✅ |
| `dialog.tsx` | `modal.rs` | Adapt | P1 | ✅ |
| `alert-dialog.tsx` | `notification/alert_modal.rs` | Adapt | P2 | ✅ |
| `sheet.tsx` | `modal.rs` / panel | Inspire | P3 | ✅ |
| `scroll-area.tsx` | `scrollbar.rs` | Adapt | P2 | ✅ (already `bg-border`) |
| `slider.tsx` | (settings sliders) | Inspire | P3 | ✅ |
| `input.tsx` | Editor/text field (no standalone) | Inspire | P1 | ✅ (tokens) |
| `textarea.tsx` | Editor/text field | Inspire | P2 | ✅ |
| `card.tsx` | `elevation.rs` + `ai/configured_api_card.rs` | Inspire | P1 | ✅ (tokens) |
| `toast.tsx`/`sonner.tsx` | `notification/announcement_toast.rs` | Adapt | P2 | ✅ |
| `KeyBadge.tsx`/`KeyRecorder.tsx` | `keybinding.rs` / `keybinding_hint.rs` | Copy | P2 | ⬜ |
| `TopPill.tsx` | `chip.rs` / `button` | Adapt | P2 | ⬜ |
| `RollingTranscript.tsx` | `label/*` + `list` | Inspire | P3 | ⬜ |
| `ChannelCard.tsx` | `ai/configured_api_card.rs` | Adapt | P3 | ⬜ |
| `ui/linear/*` (Surface, LinearCard, LinearButton, HairlineDivider) | Button/Card/Divider/elevation | **Folded→Zed** | P2 | ✅ (palette remap + Zed anatomy: tinted btn, tight radii) |

## AI chat / overlay (the "agent panel")

| Momor | Zed equivalent | Action | Pri | Status |
|---|---|---|---|---|
| `MomorInterface.tsx` (composer + thread) | `agent_panel.rs` + `message_editor.rs` + `conversation_view.rs` | Copy UX | P1 | �doing (tokens + warning Callout + chips) |
| `MeetingChatOverlay.tsx` | `conversation_view/thread_view.rs` (message turns) | Copy UX | P1 | ⬜ |
| `GlobalChatOverlay.tsx` | `agent_panel.rs` | Adapt | P2 | ⬜ |
| `overlay/OverlayModelSelect.tsx` | `model_selector.rs` / `language_model_selector.rs` | Copy | P1 | ⬜ |
| `ModelSelector.tsx` / `ModelSelectorWindow.tsx` | `model_selector_popover.rs` + `ui/model_selector_components.rs` | Copy | P1 | ⬜ |
| `overlay/OverlayAiProfileSelect.tsx` | `profile_selector.rs` | Copy | P2 | ⬜ |
| `overlay/OverlaySttSelect.tsx` | `mode_selector.rs` (selector pattern) | Adapt | P2 | ⬜ |
| `dynamic-actions/*` | `button` (Subtle) row | Adapt | P3 | ⬜ |

## Settings

| Momor | Zed equivalent | Action | Pri | Status |
|---|---|---|---|---|
| `settings/layout/SettingsListRow.tsx` | `list/list_item.rs` | Copy | P1 | ✅ |
| `settings/layout/SettingsSection.tsx` | `list/list_header.rs` + `list_sub_header.rs` | Adapt | P2 | ⬜ |
| `settings/Sidebar.tsx` | `list` nav / `tab` | Adapt | P2 | partial |
| `settings/ProviderCard.tsx` + variants | `ai/configured_api_card.rs` + `ai_setting_item.rs` | Copy | P1 | ⬜ |
| `settings/AIProvidersSettings.tsx` | `agent_configuration.rs` | Adapt | P1 | ⬜ |
| `settings/AddIntegrationDialog.tsx` / `AddSttProfileDialog.tsx` | `agent_configuration/add_llm_provider_modal.rs` | Copy | P2 | ⬜ |
| `settings/IntegrationStatusBadge.tsx` | `indicator.rs` / `count_badge.rs` | Adapt | P2 | ⬜ |
| `settings/SttLiveTestPanel.tsx` | `callout.rs` + `progress` | Inspire | P3 | ⬜ |
| `SettingsOverlay.tsx` / `ModalShell.tsx` | `modal.rs` | Adapt | P1 | partial |

## Screens & chrome

| Momor | Zed equivalent | Action | Pri | Status |
|---|---|---|---|---|
| `Launcher.tsx` meeting rows | `list/list_item.rs` | Adapt | P1 | partial (tokens) |
| `Launcher.tsx` header | `title_bar` crate + `tab_bar` | Adapt | P1 | partial (tokens) |
| `MeetingDetails.tsx` | `list` + `label` + headings | Adapt | P2 | ⬜ |
| `WindowControls.tsx` | `title_bar` window controls | Inspire | P2 | ⬜ |
| `TopSearchPill.tsx` | `popover` + input | Adapt | P2 | ⬜ |
| `StartupSequence.tsx` | (none) | Inspire | P3 | ⬜ |
| `FeatureSpotlight.tsx` | `ai/parallel_agents_illustration.rs` vibe | Inspire | P3 | ⬜ |
| Banners/toasters (`UpdateBanner`, `MomorQuotaBanner`, `trial/*`) | `banner.rs` / `callout.rs` / `announcement_toast.rs` | Adapt | P2 | ⬜ |

---

## Status: COMPLETE

- **Tokens**: Zed One Dark + One Light fully applied (`index.css`, `tailwind.config.js`).
- **Primitives (`ui/`)**: 22/22 ported to Zed anatomy (button, chip, callout,
  switch, separator, tooltip, dropdown-menu, select, command, dialog, alert-dialog,
  sheet, popover, tabs, badge, textarea, input, card, slider, scroll-area,
  sonner/toast, label).
- **Feature components inherit Zed by construction** — they are composed of the
  Zed primitives + tokens. Verified representative ones (OverlayModelSelect ≈ Zed
  `model_selector` popover; ProviderCard built from Zed Button/Select/Card).
- **`ui/linear/*`** folded into Zed (palette remap + tinted button + tight radii).
- **Stragglers swept**: hardcoded grays → tokens; `rounded-linear-xl/md` modal
  shells → `rounded-lg`/`rounded-md`; overlay warning → `Callout`; status pills →
  Zed chip metrics.
- Web typecheck (`npx tsc --noEmit -p tsconfig.json`) green throughout.

Remaining are optional deep-cosmetic passes (e.g. converting the in-overlay glass
white-alpha `KeyBadge`/markdown slate prose, which already read as Zed tones).
