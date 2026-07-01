# Momor Component Catalog

Inventory of Momor's React components (`src/components/**`). Grouped by role.
Cross-referenced against Zed in [ZED_MOMOR_CROSSWALK.md](./ZED_MOMOR_CROSSWALK.md).

---

## `ui/` — shared primitives (shadcn-based)

| Component | File | Purpose |
|---|---|---|
| Button | `ui/button.tsx` | Core button (variants/sizes). |
| Input | `ui/input.tsx` | Text input. |
| Textarea | `ui/textarea.tsx` | Multiline input. |
| Label | `ui/label.tsx` | Form field label. |
| Card | `ui/card.tsx` | Generic content card (header/content/footer). |
| Badge | `ui/badge.tsx` | Small status/label badge. |
| Switch | `ui/switch.tsx` | On/off toggle. |
| Slider | `ui/slider.tsx` | Range slider. |
| Separator | `ui/separator.tsx` | Hairline divider. |
| Dialog | `ui/dialog.tsx` | Modal dialog. |
| AlertDialog | `ui/alert-dialog.tsx` | Confirm/alert dialog. |
| Sheet | `ui/sheet.tsx` | Slide-in panel. |
| Tabs | `ui/tabs.tsx` | Tabbed content. |
| Tooltip | `ui/tooltip.tsx` | Hover tooltip. |
| Popover | `ui/popover.tsx` | Floating popover. |
| Select | `ui/select.tsx` | Dropdown select. |
| DropdownMenu | `ui/dropdown-menu.tsx` | Action dropdown menu. |
| Command | `ui/command.tsx` | Command palette / combobox. |
| ScrollArea | `ui/scroll-area.tsx` | Scroll container w/ styled bar. |
| Toast / Sonner | `ui/toast.tsx`, `ui/sonner.tsx` | Transient notifications. |
| Chip | `ui/chip.tsx` | Status/metadata chip. ✅ Zed port |
| Callout | `ui/callout.tsx` | Attention callout. ✅ Zed port |
| KeyBadge / KeyRecorder | `ui/KeyBadge.tsx`, `ui/KeyRecorder.tsx` | Keybinding display + capture. |
| TopPill | `ui/TopPill.tsx` | Floating overlay pill. |
| RollingTranscript | `ui/RollingTranscript.tsx` | Live transcript ticker. |
| ChannelCard | `ui/ChannelCard.tsx` | Update-channel option card. |
| ModelSelector | `ui/ModelSelector.tsx` | Model picker dropdown. |
| GlassEffectLayer | `ui/GlassEffectLayer.tsx` | Liquid-glass backdrop layer. |
| settings-toggle-row | `ui/settings-toggle-row.tsx` | A settings row with a toggle. |
| onboarding-popover | `ui/onboarding-popover.tsx` | First-run hint popover. |
| **linear/** | `ui/linear/*` | Legacy "Linear" design primitives: `Surface`, `LinearCard`, `LinearButton`, `HairlineDivider` — candidates to retire/fold into Zed equivalents. |

## `overlay/` — in-meeting composer controls

| Component | File | Purpose |
|---|---|---|
| OverlayModelSelect | `overlay/OverlayModelSelect.tsx` | LLM model picker in the meeting overlay. |
| OverlaySttSelect | `overlay/OverlaySttSelect.tsx` | STT engine picker. |
| OverlayAiProfileSelect | `overlay/OverlayAiProfileSelect.tsx` | AI profile picker. |

## `settings/` — settings surfaces

| Group | Files | Purpose |
|---|---|---|
| Layout | `settings/layout/SettingsPage.tsx`, `SettingsList.tsx`, `SettingsListRow.tsx`, `SettingsSection.tsx`, `SettingsToolbar.tsx` | Settings page scaffolding, list rows, section headers, toolbar. |
| Provider cards | `settings/ProviderCard.tsx`, `CustomProviderCard.tsx`, `OllamaProviderCard.tsx`, `DeepSeekProviderCard.tsx`, `CliProviderCard.tsx`, `ConfiguredApiCard`-like | Cards for each configured AI/LLM provider. |
| Provider editing | `settings/ApiKeysListEditor.tsx`, `IntegrationField.tsx`, `IntegrationCardSection.tsx`, `IntegrationCardShell.tsx`, `IntegrationActionBar.tsx` | Editing keys / integration fields. |
| Dialogs | `settings/AddSttProfileDialog.tsx`, `AddIntegrationDialog.tsx` | Add-provider/profile modals. |
| STT | `settings/SttProfileCard.tsx`, `SttLiveTestPanel.tsx`, `SpeechSettingsSection.tsx`, `SttBrandIcon.tsx` | Speech-to-text config. |
| Tabs/sections | `settings/GeneralSettingsTab.tsx`, `AIProvidersSettings.tsx`, `IntegrationsSettings.tsx`, `LanguageSettings.tsx`, `HelpSettings.tsx`, `MomorApiSettings.tsx`, `MomorProSettings.tsx`, `PhoneMirrorSettings.tsx` | Settings sections. |
| Status | `settings/IntegrationStatusBadge.tsx`, `IntegrationTestResult.tsx`, `ProviderBrandIcon.tsx` | Status badges / brand icons. |
| Sidebar | `settings/Sidebar.tsx` | Settings nav sidebar. |

## `shell/` — app shell

| Component | File | Purpose |
|---|---|---|
| AppProviders | `shell/AppProviders.tsx` | Context providers wrapper. |
| SettingsNav | `shell/SettingsNav.tsx` | Settings navigation. |
| ModalShell | `shell/ModalShell.tsx` | Modal frame wrapper. |

## Top-level screens & features

| Component | File | Purpose |
|---|---|---|
| MomorInterface | `MomorInterface.tsx` | The in-meeting assistant overlay (chat + controls). |
| MeetingChatOverlay | `MeetingChatOverlay.tsx` | Meeting AI chat thread. |
| GlobalChatOverlay | `GlobalChatOverlay.tsx` | Global AI search/chat. |
| Launcher | `Launcher.tsx` | Main screen: meeting list + start CTA. |
| MeetingDetails | `MeetingDetails.tsx` | Meeting transcript/summary reader. |
| SettingsOverlay / SettingsPopup | `SettingsOverlay.tsx`, `SettingsPopup.tsx` | Settings modal windows. |
| ModelSelectorWindow | `ModelSelectorWindow.tsx` | Standalone model-picker window. |
| UserContextModal | `UserContextModal.tsx` | User-context editor modal. |
| Cropper | `Cropper.tsx` | Screenshot crop tool. |
| StartupSequence | `StartupSequence.tsx` | First-run startup animation. |
| FeatureSpotlight | `FeatureSpotlight.tsx` | Hero spotlight card on launcher. |
| TopSearchPill | `TopSearchPill.tsx` | Spotlight-style search bar. |
| WindowControls | `WindowControls.tsx` | Min/max/close window buttons. |
| MomorLogoMark | `MomorLogoMark.tsx` | Brand logo mark. |
| Banners/Toasters | `UpdateBanner.tsx`, `UpdateModal.tsx`, `MomorQuotaBanner.tsx`, `SupportToaster.tsx`, `trial/*`, `onboarding/PermissionsToaster.tsx` | Update/quota/trial/permission notifications. |
| dynamic-actions | `dynamic-actions/DynamicActionBar.tsx`, `DynamicActionCard.tsx` | Context-aware action chips. |
