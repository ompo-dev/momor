#![allow(clippy::needless_pass_by_value)]

use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

use base64::Engine;
use chrono::{DateTime, Utc};
use parking_lot::Mutex;
use screenshots::Screen;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::{
    AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, PhysicalPosition, Position, Size,
    RunEvent, State,
};
use uuid::Uuid;

const SETTINGS_FILE: &str = "settings.json";
const THEME_FILE: &str = "theme-config.json";
const KEYBINDS_FILE: &str = "keybinds.json";
const CREDENTIALS_FILE: &str = "credentials.tauri.json";
const MIGRATION_REPORT_FILE: &str = "tauri_migration_report.json";
const MIGRATION_LOCK_FILE: &str = ".tauri_migration.lock";
const SCREENSHOTS_DIR: &str = "screenshots";
const MEETINGS_FILE: &str = "meetings.tauri.json";

#[derive(Default)]
struct RuntimeState {
    meeting_active: bool,
    active_meeting: Option<ActiveMeetingSession>,
    window_mode: String,
    default_model: String,
    runtime_model: String,
    stt_provider: String,
    theme_mode: String,
    theme_resolved: String,
    keybinds: HashMap<String, String>,
}

#[derive(Clone)]
struct ActiveMeetingSession {
    id: String,
    title: String,
    started_at_ms: i64,
    do_not_persist: bool,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MeetingRecord {
    id: String,
    title: String,
    date: String,
    duration: String,
    summary: String,
    detailed_summary: Value,
    transcript: Vec<Value>,
    usage: Vec<Value>,
    #[serde(default)]
    created_at_ms: i64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ThemeModePayload {
    mode: String,
    resolved: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct LlmConfigPayload {
    provider: String,
    model: String,
    is_ollama: bool,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct MeetingStatePayload {
    is_active: bool,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ScreenshotPayload {
    path: String,
    preview: String,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MigrationReport {
    created_at: String,
    copied_files: Vec<String>,
    copied_dirs: Vec<String>,
    source_dir: Option<String>,
    target_dir: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct StoredCredentialsPayload {
    has_gemini_key: bool,
    has_groq_key: bool,
    has_openai_key: bool,
    has_claude_key: bool,
    has_momor_key: bool,
    google_service_account_path: Option<String>,
    stt_provider: String,
    has_stt_groq_key: bool,
    has_stt_openai_key: bool,
    has_deepgram_key: bool,
    has_eleven_labs_key: bool,
    has_azure_key: bool,
    azure_region: String,
    has_ibm_watson_key: bool,
    ibm_watson_region: String,
    has_soniox_key: bool,
    has_tavily_key: bool,
    stt_groq_key: String,
    stt_openai_key: String,
    stt_deepgram_key: String,
    stt_eleven_labs_key: String,
    stt_azure_key: String,
    stt_ibm_key: String,
    stt_soniox_key: String,
    groq_stt_model: String,
    open_ai_stt_base_url: String,
}

fn default_runtime_state() -> RuntimeState {
    RuntimeState {
        meeting_active: false,
        active_meeting: None,
        window_mode: "launcher".to_string(),
        default_model: "gemini-3.1-flash-lite-preview".to_string(),
        runtime_model: "gemini-3.1-flash-lite-preview".to_string(),
        stt_provider: "none".to_string(),
        theme_mode: "system".to_string(),
        theme_resolved: "dark".to_string(),
        keybinds: HashMap::new(),
    }
}

fn app_data_dir(app: &AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .unwrap_or_else(|_| std::env::temp_dir().join("momor-tauri"))
}

fn screenshots_dir(app: &AppHandle) -> PathBuf {
    app_data_dir(app).join(SCREENSHOTS_DIR)
}

fn settings_path(app: &AppHandle) -> PathBuf {
    app_data_dir(app).join(SETTINGS_FILE)
}

fn theme_path(app: &AppHandle) -> PathBuf {
    app_data_dir(app).join(THEME_FILE)
}

fn keybinds_path(app: &AppHandle) -> PathBuf {
    app_data_dir(app).join(KEYBINDS_FILE)
}

fn credentials_path(app: &AppHandle) -> PathBuf {
    app_data_dir(app).join(CREDENTIALS_FILE)
}

fn meetings_path(app: &AppHandle) -> PathBuf {
    app_data_dir(app).join(MEETINGS_FILE)
}

fn normalize_path(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

fn read_json_file(path: &Path) -> Option<Value> {
    let content = fs::read_to_string(path).ok()?;
    serde_json::from_str::<Value>(&content).ok()
}

fn write_json_file(path: &Path, value: &Value) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let serialized = serde_json::to_string_pretty(value).map_err(|e| e.to_string())?;
    fs::write(path, serialized).map_err(|e| e.to_string())
}

fn load_credentials_json(app: &AppHandle) -> Value {
    read_json_file(&credentials_path(app)).unwrap_or_else(|| json!({}))
}

fn save_credentials_json(app: &AppHandle, credentials: &Value) -> Result<(), String> {
    write_json_file(&credentials_path(app), credentials)
}

fn get_credential_string(app: &AppHandle, key: &str) -> String {
    load_credentials_json(app)
        .get(key)
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string()
}

fn set_credential_string(app: &AppHandle, key: &str, value: &str) -> Result<(), String> {
    let mut credentials = load_credentials_json(app);
    credentials[key] = Value::String(value.to_string());
    save_credentials_json(app, &credentials)
}

fn set_setting_string(app: &AppHandle, key: &str, value: &str) -> Result<(), String> {
    let path = settings_path(app);
    let mut settings = read_json_file(&path).unwrap_or_else(|| json!({}));
    settings[key] = Value::String(value.to_string());
    write_json_file(&path, &settings)
}

fn get_setting_string(app: &AppHandle, key: &str, default_value: &str) -> String {
    read_json_file(&settings_path(app))
        .and_then(|v| v.get(key).and_then(Value::as_str).map(ToString::to_string))
        .unwrap_or_else(|| default_value.to_string())
}

fn default_detailed_summary() -> Value {
    json!({
        "overview": "",
        "actionItems": [],
        "keyPoints": [],
        "actionItemsTitle": "Action Items",
        "keyPointsTitle": "Key Points"
    })
}

fn format_duration(duration_ms: i64) -> String {
    let safe_ms = duration_ms.max(0);
    let minutes = safe_ms / 60_000;
    let seconds = (safe_ms % 60_000) / 1_000;
    format!("{minutes}:{seconds:02}")
}

fn timestamp_ms_to_rfc3339(timestamp_ms: i64) -> String {
    DateTime::<Utc>::from_timestamp_millis(timestamp_ms)
        .map(|dt| dt.to_rfc3339())
        .unwrap_or_else(|| Utc::now().to_rfc3339())
}

fn build_meeting_placeholder(session: &ActiveMeetingSession) -> MeetingRecord {
    MeetingRecord {
        id: session.id.clone(),
        title: session.title.clone(),
        date: timestamp_ms_to_rfc3339(session.started_at_ms),
        duration: "0:00".to_string(),
        summary: String::new(),
        detailed_summary: default_detailed_summary(),
        transcript: Vec::new(),
        usage: Vec::new(),
        created_at_ms: session.started_at_ms,
    }
}

fn save_meeting_placeholder(app: &AppHandle, session: &ActiveMeetingSession) -> Result<(), String> {
    let mut meetings = load_meetings(app);
    if meetings.iter().any(|m| m.id == session.id) {
        return Ok(());
    }
    meetings.push(build_meeting_placeholder(session));
    meetings.sort_by(|a, b| b.created_at_ms.cmp(&a.created_at_ms));
    save_meetings(app, &meetings)
}

fn finalize_meeting_record(app: &AppHandle, session: &ActiveMeetingSession) -> Result<(), String> {
    let ended_at = Utc::now();
    let ended_at_ms = ended_at.timestamp_millis();
    let duration_ms = ended_at_ms - session.started_at_ms;

    let mut meetings = load_meetings(app);
    if let Some(record) = meetings.iter_mut().find(|m| m.id == session.id) {
        record.title = session.title.clone();
        record.duration = format_duration(duration_ms);
        // Keep original date for stable day grouping if already present.
        if record.date.trim().is_empty() {
            record.date = timestamp_ms_to_rfc3339(session.started_at_ms);
        }
        if record.created_at_ms <= 0 {
            record.created_at_ms = session.started_at_ms;
        }
    } else {
        let mut created = build_meeting_placeholder(session);
        created.duration = format_duration(duration_ms);
        meetings.push(created);
    }

    meetings.sort_by(|a, b| b.created_at_ms.cmp(&a.created_at_ms));
    save_meetings(app, &meetings)
}

fn finalize_active_meeting_if_any(app: &AppHandle, runtime_state: &Mutex<RuntimeState>) -> bool {
    let maybe_session = {
        let mut state = runtime_state.lock();
        state.meeting_active = false;
        state.window_mode = "launcher".to_string();
        state.active_meeting.take()
    };

    if let Some(session) = maybe_session {
        if !session.do_not_persist {
            if let Err(err) = finalize_meeting_record(app, &session) {
                eprintln!("[tauri] failed to finalize active meeting: {err}");
            }
        }
        emit_all(app, "meetings-updated", json!({}));
        return true;
    }

    false
}

fn load_meetings(app: &AppHandle) -> Vec<MeetingRecord> {
    let path = meetings_path(app);
    if !path.exists() {
        return Vec::new();
    }
    let raw = match fs::read_to_string(path) {
        Ok(raw) => raw,
        Err(_) => return Vec::new(),
    };
    serde_json::from_str::<Vec<MeetingRecord>>(&raw).unwrap_or_default()
}

fn save_meetings(app: &AppHandle, meetings: &[MeetingRecord]) -> Result<(), String> {
    let path = meetings_path(app);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let serialized = serde_json::to_string_pretty(meetings).map_err(|e| e.to_string())?;
    fs::write(path, serialized).map_err(|e| e.to_string())
}

fn meeting_to_list_item(meeting: &MeetingRecord) -> Value {
    json!({
        "id": meeting.id,
        "title": meeting.title,
        "date": meeting.date,
        "duration": meeting.duration,
        "summary": meeting.summary,
        "detailedSummary": meeting.detailed_summary,
        "transcript": [],
        "usage": []
    })
}

fn detect_old_electron_data_dir() -> Option<PathBuf> {
    let base = dirs::data_dir()?;
    let candidates = [
        base.join("momor"),
        base.join("momor"),
        base.join("com.electron.meeting-notes"),
        base.join("com.electron.momor"),
    ];
    candidates.into_iter().find(|p| p.exists())
}

fn copy_file_if_exists(src: &Path, dst: &Path, report: &mut MigrationReport) -> Result<(), String> {
    if !src.exists() {
        return Ok(());
    }
    if let Some(parent) = dst.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::copy(src, dst).map_err(|e| e.to_string())?;
    report.copied_files.push(normalize_path(dst));
    Ok(())
}

fn copy_dir_recursive(src: &Path, dst: &Path, report: &mut MigrationReport) -> Result<(), String> {
    if !src.exists() {
        return Ok(());
    }
    fs::create_dir_all(dst).map_err(|e| e.to_string())?;
    for entry in fs::read_dir(src).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());
        if src_path.is_dir() {
            copy_dir_recursive(&src_path, &dst_path, report)?;
        } else {
            fs::copy(&src_path, &dst_path).map_err(|e| e.to_string())?;
        }
    }
    report.copied_dirs.push(normalize_path(dst));
    Ok(())
}

fn migrate_from_electron(app: &AppHandle) -> Result<(), String> {
    let target_dir = app_data_dir(app);
    fs::create_dir_all(&target_dir).map_err(|e| e.to_string())?;
    let lock_path = target_dir.join(MIGRATION_LOCK_FILE);
    let report_path = target_dir.join(MIGRATION_REPORT_FILE);

    if report_path.exists() {
        return Ok(());
    }
    if lock_path.exists() {
        return Ok(());
    }

    fs::write(&lock_path, Utc::now().to_rfc3339()).map_err(|e| e.to_string())?;
    let mut report = MigrationReport {
        created_at: Utc::now().to_rfc3339(),
        copied_files: Vec::new(),
        copied_dirs: Vec::new(),
        source_dir: None,
        target_dir: normalize_path(&target_dir),
    };

    let result = (|| -> Result<(), String> {
        let Some(src_dir) = detect_old_electron_data_dir() else {
            return Ok(());
        };
        report.source_dir = Some(normalize_path(&src_dir));

        copy_file_if_exists(&src_dir.join(SETTINGS_FILE), &target_dir.join(SETTINGS_FILE), &mut report)?;
        copy_file_if_exists(&src_dir.join(THEME_FILE), &target_dir.join(THEME_FILE), &mut report)?;
        copy_file_if_exists(&src_dir.join(KEYBINDS_FILE), &target_dir.join(KEYBINDS_FILE), &mut report)?;
        copy_file_if_exists(
            &src_dir.join("credentials.enc"),
            &target_dir.join("credentials.enc"),
            &mut report,
        )?;
        copy_file_if_exists(
            &src_dir.join("calendar_tokens.enc"),
            &target_dir.join("calendar_tokens.enc"),
            &mut report,
        )?;
        copy_file_if_exists(
            &src_dir.join("meetings.db"),
            &target_dir.join("meetings.db"),
            &mut report,
        )?;
        copy_file_if_exists(
            &src_dir.join("vectorstore.db"),
            &target_dir.join("vectorstore.db"),
            &mut report,
        )?;
        copy_dir_recursive(
            &src_dir.join(SCREENSHOTS_DIR),
            &target_dir.join(SCREENSHOTS_DIR),
            &mut report,
        )?;
        copy_dir_recursive(
            &src_dir.join("whisper-models"),
            &target_dir.join("whisper-models"),
            &mut report,
        )?;
        Ok(())
    })();

    let report_value = serde_json::to_value(&report).map_err(|e| e.to_string())?;
    let _ = write_json_file(&report_path, &report_value);
    let _ = fs::remove_file(&lock_path);
    result
}

fn load_runtime_state_from_disk(app: &AppHandle, state: &mut RuntimeState) {
    let settings_file = settings_path(app);
    if let Some(settings) = read_json_file(&settings_file) {
        if let Some(model) = settings.get("defaultModel").and_then(Value::as_str) {
            state.default_model = model.to_string();
            state.runtime_model = model.to_string();
        }
        if let Some(runtime_model) = settings.get("runtimeModel").and_then(Value::as_str) {
            let runtime_model = runtime_model.trim();
            if !runtime_model.is_empty() {
                state.runtime_model = runtime_model.to_string();
            }
        }
        if let Some(stt) = settings.get("sttProvider").and_then(Value::as_str) {
            state.stt_provider = stt.to_string();
        }
    }

    let theme_file = theme_path(app);
    if let Some(theme) = read_json_file(&theme_file) {
        if let Some(mode) = theme.get("mode").and_then(Value::as_str) {
            state.theme_mode = mode.to_string();
        }
        if let Some(resolved) = theme.get("resolved").and_then(Value::as_str) {
            state.theme_resolved = resolved.to_string();
        }
    }

    let keybinds_file = keybinds_path(app);
    if let Some(keybinds) = read_json_file(&keybinds_file).and_then(|v| v.as_object().cloned()) {
        for (k, v) in keybinds {
            if let Some(accel) = v.as_str() {
                state.keybinds.insert(k, accel.to_string());
            }
        }
    }
}

fn persist_settings_model(app: &AppHandle, model: &str) -> Result<(), String> {
    let path = settings_path(app);
    let mut settings = read_json_file(&path).unwrap_or_else(|| json!({}));
    settings["defaultModel"] = Value::String(model.to_string());
    write_json_file(&path, &settings)
}

fn persist_runtime_model(app: &AppHandle, model: &str) -> Result<(), String> {
    let path = settings_path(app);
    let mut settings = read_json_file(&path).unwrap_or_else(|| json!({}));
    settings["runtimeModel"] = Value::String(model.to_string());
    write_json_file(&path, &settings)
}

fn persist_theme(app: &AppHandle, mode: &str, resolved: &str) -> Result<(), String> {
    let path = theme_path(app);
    let value = json!({
        "mode": mode,
        "resolved": resolved
    });
    write_json_file(&path, &value)
}

fn infer_provider(model: &str) -> (String, bool) {
    if model == "momor" {
        return ("momor".to_string(), false);
    }
    if model.starts_with("ollama-") {
        return ("ollama".to_string(), true);
    }
    if model.starts_with("gpt-") {
        return ("openai".to_string(), false);
    }
    if model.starts_with("claude-") {
        return ("claude".to_string(), false);
    }
    if model.starts_with("llama-") {
        return ("groq".to_string(), false);
    }
    if model.starts_with("gemini-") {
        return ("gemini".to_string(), false);
    }
    ("gemini".to_string(), false)
}

fn stt_provider_has_credentials(app: &AppHandle, provider: &str) -> bool {
    match provider {
        "none" | "google" | "momor" | "local-whisper" => true,
        "groq" => !get_credential_string(app, "sttGroqKey").is_empty(),
        "openai" => !get_credential_string(app, "sttOpenaiKey").is_empty(),
        "deepgram" => !get_credential_string(app, "sttDeepgramKey").is_empty()
            || std::env::var("DEEPGRAM_API_KEY").ok().is_some(),
        "elevenlabs" => !get_credential_string(app, "sttElevenLabsKey").is_empty(),
        "azure" => !get_credential_string(app, "sttAzureKey").is_empty(),
        "ibmwatson" => !get_credential_string(app, "sttIbmKey").is_empty(),
        "soniox" => !get_credential_string(app, "sttSonioxKey").is_empty(),
        _ => false,
    }
}

fn emit_stt_config_changed(app: &AppHandle, provider: &str) {
    emit_all(
        app,
        "stt-config-changed",
        json!({
            "configured": stt_provider_has_credentials(app, provider),
            "provider": provider
        }),
    );
}

fn emit_all(app: &AppHandle, event: &str, payload: impl Serialize + Clone) {
    let _ = app.emit(event, payload);
}

#[tauri::command]
fn get_theme_mode(state: State<'_, Mutex<RuntimeState>>) -> ThemeModePayload {
    let state = state.lock();
    ThemeModePayload {
        mode: state.theme_mode.clone(),
        resolved: state.theme_resolved.clone(),
    }
}

#[tauri::command]
fn set_theme_mode(
    app: AppHandle,
    state: State<'_, Mutex<RuntimeState>>,
    mode: String,
) -> Result<(), String> {
    let resolved = if mode == "light" {
        "light"
    } else if mode == "dark" {
        "dark"
    } else {
        "dark"
    };
    {
        let mut state = state.lock();
        state.theme_mode = mode.clone();
        state.theme_resolved = resolved.to_string();
    }
    persist_theme(&app, &mode, resolved)?;
    emit_all(
        &app,
        "theme-changed",
        ThemeModePayload {
            mode,
            resolved: resolved.to_string(),
        },
    );
    Ok(())
}

#[tauri::command]
fn get_stored_credentials(
    app: AppHandle,
    state: State<'_, Mutex<RuntimeState>>,
) -> StoredCredentialsPayload {
    let credentials = load_credentials_json(&app);
    let from_cred = |key: &str| -> String {
        credentials
            .get(key)
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string()
    };

    let stt_provider = {
        let runtime = state.lock().stt_provider.clone();
        if runtime != "none" {
            runtime
        } else {
            read_json_file(&settings_path(&app))
                .and_then(|v| v.get("sttProvider").and_then(Value::as_str).map(ToString::to_string))
                .unwrap_or_else(|| "none".to_string())
        }
    };

    let gemini_key = from_cred("geminiApiKey");
    let groq_key = from_cred("groqApiKey");
    let openai_key = from_cred("openaiApiKey");
    let claude_key = from_cred("claudeApiKey");
    let momor_key = from_cred("momorApiKey");
    let stt_groq_key = from_cred("sttGroqKey");
    let stt_openai_key = from_cred("sttOpenaiKey");
    let stt_deepgram_key = from_cred("sttDeepgramKey");
    let stt_eleven_labs_key = from_cred("sttElevenLabsKey");
    let stt_azure_key = from_cred("sttAzureKey");
    let stt_ibm_key = from_cred("sttIbmKey");
    let stt_soniox_key = from_cred("sttSonioxKey");
    let azure_region = {
        let region = from_cred("azureRegion");
        if region.is_empty() {
            "eastus".to_string()
        } else {
            region
        }
    };
    let ibm_watson_region = {
        let region = from_cred("ibmWatsonRegion");
        if region.is_empty() {
            "us-south".to_string()
        } else {
            region
        }
    };

    StoredCredentialsPayload {
        has_gemini_key: !gemini_key.is_empty(),
        has_groq_key: !groq_key.is_empty(),
        has_openai_key: !openai_key.is_empty(),
        has_claude_key: !claude_key.is_empty(),
        has_momor_key: !momor_key.is_empty(),
        google_service_account_path: None,
        stt_provider,
        has_stt_groq_key: !stt_groq_key.is_empty(),
        has_stt_openai_key: !stt_openai_key.is_empty(),
        has_deepgram_key: !stt_deepgram_key.is_empty() || std::env::var("DEEPGRAM_API_KEY").ok().is_some(),
        has_eleven_labs_key: !stt_eleven_labs_key.is_empty(),
        has_azure_key: !stt_azure_key.is_empty(),
        azure_region,
        has_ibm_watson_key: !stt_ibm_key.is_empty(),
        ibm_watson_region,
        has_soniox_key: !stt_soniox_key.is_empty(),
        has_tavily_key: !from_cred("tavilyApiKey").is_empty(),
        stt_groq_key,
        stt_openai_key,
        stt_deepgram_key,
        stt_eleven_labs_key,
        stt_azure_key,
        stt_ibm_key,
        stt_soniox_key,
        groq_stt_model: {
            let model = from_cred("groqSttModel");
            if model.is_empty() {
                "whisper-large-v3-turbo".to_string()
            } else {
                model
            }
        },
        open_ai_stt_base_url: from_cred("openAiSttBaseUrl"),
    }
}

#[tauri::command]
fn get_recognition_languages() -> Value {
    json!({
        "auto": { "label": "Auto Detect", "code": "auto", "bcp47": "auto", "iso639": "auto", "group": "Auto" },
        "english-us": { "label": "United States", "code": "english-us", "bcp47": "en-US", "iso639": "en", "group": "English", "primary": "en-US", "alternates": ["en-GB", "en-IN", "en-AU", "en-CA"] },
        "english-uk": { "label": "United Kingdom", "code": "english-uk", "bcp47": "en-GB", "iso639": "en", "group": "English", "primary": "en-GB", "alternates": ["en-US", "en-IN", "en-AU", "en-CA"] },
        "english-in": { "label": "India", "code": "english-in", "bcp47": "en-IN", "iso639": "en", "group": "English", "primary": "en-IN", "alternates": ["en-US", "en-GB", "en-AU", "en-CA"] },
        "english-au": { "label": "Australia", "code": "english-au", "bcp47": "en-AU", "iso639": "en", "group": "English", "primary": "en-AU", "alternates": ["en-US", "en-GB", "en-IN", "en-CA"] },
        "english-ca": { "label": "Canada", "code": "english-ca", "bcp47": "en-CA", "iso639": "en", "group": "English", "primary": "en-CA", "alternates": ["en-US", "en-GB", "en-IN", "en-AU"] },
        "indonesian": { "label": "Indonesian", "code": "indonesian", "bcp47": "id-ID", "iso639": "id", "group": "Indonesian" },
        "russian": { "label": "Russian", "code": "russian", "bcp47": "ru-RU", "iso639": "ru", "group": "Russian" },
        "spanish": { "label": "Spanish", "code": "spanish", "bcp47": "es-ES", "iso639": "es", "group": "Spanish" },
        "french": { "label": "French", "code": "french", "bcp47": "fr-FR", "iso639": "fr", "group": "French" },
        "german": { "label": "German", "code": "german", "bcp47": "de-DE", "iso639": "de", "group": "German" },
        "italian": { "label": "Italian", "code": "italian", "bcp47": "it-IT", "iso639": "it", "group": "Italian" },
        "portuguese": { "label": "Portuguese", "code": "portuguese", "bcp47": "pt-PT", "iso639": "pt", "group": "Portuguese" },
        "japanese": { "label": "Japanese", "code": "japanese", "bcp47": "ja-JP", "iso639": "ja", "group": "Japanese" },
        "korean": { "label": "Korean", "code": "korean", "bcp47": "ko-KR", "iso639": "ko", "group": "Korean" },
        "chinese": { "label": "Chinese (Simplified)", "code": "chinese", "bcp47": "zh-CN", "iso639": "zh", "group": "Chinese" },
        "turkish": { "label": "Turkish", "code": "turkish", "bcp47": "tr-TR", "iso639": "tr", "group": "Turkish" },
        "ukrainian": { "label": "Ukrainian", "code": "ukrainian", "bcp47": "uk-UA", "iso639": "uk", "group": "Ukrainian" }
    })
}

#[tauri::command]
fn get_ai_response_languages() -> Value {
    json!([
        { "label": "Auto (Detect)", "code": "auto" },
        { "label": "English", "code": "English" },
        { "label": "Indonesian", "code": "Indonesian" },
        { "label": "Russian", "code": "Russian" },
        { "label": "Spanish", "code": "Spanish" },
        { "label": "French", "code": "French" },
        { "label": "German", "code": "German" },
        { "label": "Italian", "code": "Italian" },
        { "label": "Portuguese", "code": "Portuguese" },
        { "label": "Japanese", "code": "Japanese" },
        { "label": "Korean", "code": "Korean" },
        { "label": "Chinese", "code": "Chinese" },
        { "label": "Turkish", "code": "Turkish" },
        { "label": "Ukrainian", "code": "Ukrainian" }
    ])
}

#[tauri::command]
fn set_recognition_language(app: AppHandle, key: String) -> Value {
    let language_key = if key.trim().is_empty() { "auto" } else { key.trim() };
    let _ = set_setting_string(&app, "sttLanguage", language_key);
    json!({ "success": true })
}

#[tauri::command]
fn get_stt_language(app: AppHandle) -> String {
    get_setting_string(&app, "sttLanguage", "auto")
}

#[tauri::command]
fn set_ai_response_language(app: AppHandle, language: String) -> Value {
    let value = if language.trim().is_empty() {
        "auto"
    } else {
        language.trim()
    };
    let _ = set_setting_string(&app, "aiResponseLanguage", value);
    json!({ "success": true })
}

#[tauri::command]
fn get_ai_response_language(app: AppHandle) -> String {
    get_setting_string(&app, "aiResponseLanguage", "auto")
}

#[tauri::command]
fn set_gemini_api_key(app: AppHandle, api_key: String) -> Value {
    let _ = set_credential_string(&app, "geminiApiKey", api_key.trim());
    emit_all(&app, "credentials-changed", json!({}));
    json!({ "success": true })
}

#[tauri::command]
fn set_groq_api_key(app: AppHandle, api_key: String) -> Value {
    let _ = set_credential_string(&app, "groqApiKey", api_key.trim());
    emit_all(&app, "credentials-changed", json!({}));
    json!({ "success": true })
}

#[tauri::command]
fn set_openai_api_key(app: AppHandle, api_key: String) -> Value {
    let _ = set_credential_string(&app, "openaiApiKey", api_key.trim());
    emit_all(&app, "credentials-changed", json!({}));
    json!({ "success": true })
}

#[tauri::command]
fn set_claude_api_key(app: AppHandle, api_key: String) -> Value {
    let _ = set_credential_string(&app, "claudeApiKey", api_key.trim());
    emit_all(&app, "credentials-changed", json!({}));
    json!({ "success": true })
}

#[tauri::command]
fn set_momor_api_key(app: AppHandle, api_key: String) -> Value {
    let _ = set_credential_string(&app, "momorApiKey", api_key.trim());
    emit_all(&app, "credentials-changed", json!({}));
    json!({ "success": true })
}

#[tauri::command]
fn set_deepseek_api_key(app: AppHandle, key: String) -> Value {
    let _ = set_credential_string(&app, "deepseekApiKey", key.trim());
    emit_all(&app, "credentials-changed", json!({}));
    json!({ "success": true })
}

#[tauri::command]
fn set_deepseek_model(app: AppHandle, model: String) -> Value {
    let _ = set_credential_string(&app, "deepseekModel", model.trim());
    emit_all(&app, "credentials-changed", json!({}));
    json!({ "success": true })
}

#[tauri::command]
fn get_deepseek_api_key(app: AppHandle) -> String {
    get_credential_string(&app, "deepseekApiKey")
}

#[tauri::command]
fn set_tavily_api_key(app: AppHandle, api_key: String) -> Value {
    let _ = set_credential_string(&app, "tavilyApiKey", api_key.trim());
    emit_all(&app, "credentials-changed", json!({}));
    json!({ "success": true })
}

#[tauri::command]
fn license_get_details() -> Value {
    json!({
        "isPremium": true,
        "provider": "open_source"
    })
}

#[tauri::command]
fn license_check_premium() -> bool {
    true
}

#[tauri::command]
fn license_check_premium_async() -> bool {
    true
}

#[tauri::command]
fn profile_get_status() -> Value {
    json!({
        "hasProfile": false,
        "profileMode": false
    })
}

#[tauri::command]
fn get_local_trial() -> Value {
    json!({
        "hasToken": false,
        "trialClaimed": false,
        "expired": false
    })
}

#[tauri::command]
fn get_trial_status() -> Value {
    json!({
        "ok": false,
        "error": "trial_not_supported_in_tauri_core"
    })
}

#[tauri::command]
fn start_meeting(app: AppHandle, state: State<'_, Mutex<RuntimeState>>, metadata: Option<Value>) -> Value {
    let now = Utc::now();
    let title = metadata
        .as_ref()
        .and_then(|m| {
            m.get("title")
                .or_else(|| m.get("meetingTitle"))
                .or_else(|| m.get("eventTitle"))
                .and_then(Value::as_str)
        })
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "Meeting".to_string());
    let do_not_persist = metadata
        .as_ref()
        .and_then(|m| m.get("doNotPersist"))
        .and_then(Value::as_bool)
        .unwrap_or(false);

    let session = ActiveMeetingSession {
        id: Uuid::new_v4().to_string(),
        title,
        started_at_ms: now.timestamp_millis(),
        do_not_persist,
    };
    {
        let mut state = state.lock();
        state.meeting_active = true;
        state.window_mode = "overlay".to_string();
        state.active_meeting = Some(session.clone());
    }
    if !session.do_not_persist {
        if let Err(err) = save_meeting_placeholder(&app, &session) {
            eprintln!("[tauri] failed to create meeting placeholder: {err}");
        } else {
            emit_all(&app, "meetings-updated", json!({}));
        }
    }
    emit_all(&app, "meeting-state-changed", MeetingStatePayload { is_active: true });
    if let Some(launcher) = app.get_webview_window("launcher") {
        let _ = launcher.hide();
    }
    if let Some(overlay) = app.get_webview_window("overlay") {
        let _ = overlay.show();
        let _ = overlay.set_focus();
    }
    json!({ "success": true })
}

#[tauri::command]
fn end_meeting(app: AppHandle, state: State<'_, Mutex<RuntimeState>>) -> Value {
    let _ = finalize_active_meeting_if_any(&app, &state);

    emit_all(&app, "meeting-state-changed", MeetingStatePayload { is_active: false });
    if let Some(overlay) = app.get_webview_window("overlay") {
        let _ = overlay.hide();
    }
    if let Some(launcher) = app.get_webview_window("launcher") {
        let _ = launcher.show();
        let _ = launcher.set_focus();
    }
    json!({ "success": true })
}

#[tauri::command]
fn get_meeting_active(state: State<'_, Mutex<RuntimeState>>) -> bool {
    state.lock().meeting_active
}

#[tauri::command]
fn get_native_audio_status() -> Value {
    json!({
        "connected": false,
        "error": "stt_backend_not_available_in_tauri"
    })
}

#[tauri::command]
fn start_answer_now_mic() -> Value {
    json!({
        "success": false,
        "error": "stt_backend_not_available_in_tauri"
    })
}

#[tauri::command]
fn stop_answer_now_mic() -> Value {
    json!({
        "success": true
    })
}

#[tauri::command]
fn finalize_mic_stt() -> Value {
    json!({
        "success": true
    })
}

#[tauri::command]
fn get_input_devices() -> Vec<Value> {
    Vec::new()
}

#[tauri::command]
fn get_output_devices() -> Vec<Value> {
    Vec::new()
}

#[tauri::command]
fn append_meeting_transcript(
    app: AppHandle,
    state: State<'_, Mutex<RuntimeState>>,
    entry: Value,
) -> bool {
    let session = {
        let state = state.lock();
        state.active_meeting.clone()
    };

    let Some(session) = session else {
        return false;
    };
    if session.do_not_persist {
        return false;
    }

    let speaker = entry
        .get("speaker")
        .and_then(Value::as_str)
        .unwrap_or("interviewer")
        .trim()
        .to_string();
    let text = entry
        .get("text")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .trim()
        .to_string();
    if text.is_empty() {
        return false;
    }
    let timestamp = entry
        .get("timestamp")
        .and_then(Value::as_i64)
        .unwrap_or_else(|| Utc::now().timestamp_millis());

    let mut meetings = load_meetings(&app);
    if let Some(record) = meetings.iter_mut().find(|m| m.id == session.id) {
        record.transcript.push(json!({
            "speaker": speaker,
            "text": text,
            "timestamp": timestamp
        }));
    } else {
        let mut placeholder = build_meeting_placeholder(&session);
        placeholder.transcript.push(json!({
            "speaker": speaker,
            "text": text,
            "timestamp": timestamp
        }));
        meetings.push(placeholder);
    }

    save_meetings(&app, &meetings).is_ok()
}

#[tauri::command]
fn set_window_mode(app: AppHandle, state: State<'_, Mutex<RuntimeState>>, mode: String, _inactive: Option<bool>) -> Value {
    {
        let mut state = state.lock();
        state.window_mode = mode.clone();
    }
    match mode.as_str() {
        "overlay" => {
            if let Some(launcher) = app.get_webview_window("launcher") {
                let _ = launcher.hide();
            }
            if let Some(overlay) = app.get_webview_window("overlay") {
                let _ = overlay.show();
                let _ = overlay.set_focus();
            }
        }
        _ => {
            if let Some(overlay) = app.get_webview_window("overlay") {
                let _ = overlay.hide();
            }
            if let Some(launcher) = app.get_webview_window("launcher") {
                let _ = launcher.show();
                let _ = launcher.set_focus();
            }
        }
    }
    json!({ "success": true })
}

#[tauri::command]
fn show_window(app: AppHandle) {
    if let Some(launcher) = app.get_webview_window("launcher") {
        let _ = launcher.show();
        let _ = launcher.set_focus();
    }
}

#[tauri::command]
fn hide_window(app: AppHandle) {
    if let Some(launcher) = app.get_webview_window("launcher") {
        let _ = launcher.hide();
    }
}

#[tauri::command]
fn toggle_window(app: AppHandle, state: State<'_, Mutex<RuntimeState>>) {
    let mode = state.lock().window_mode.clone();
    let label = if mode == "overlay" { "overlay" } else { "launcher" };
    if let Some(win) = app.get_webview_window(label) {
        let visible = win.is_visible().unwrap_or(true);
        if visible {
            let _ = win.hide();
        } else {
            let _ = win.show();
            let _ = win.set_focus();
        }
    }
}

#[tauri::command]
fn show_overlay(app: AppHandle, state: State<'_, Mutex<RuntimeState>>) {
    state.lock().window_mode = "overlay".to_string();
    if let Some(overlay) = app.get_webview_window("overlay") {
        let _ = overlay.show();
        let _ = overlay.set_focus();
    }
}

#[tauri::command]
fn hide_overlay(app: AppHandle) {
    if let Some(overlay) = app.get_webview_window("overlay") {
        let _ = overlay.hide();
    }
}

#[tauri::command]
fn update_content_dimensions(app: AppHandle, width: f64, height: f64) {
    if let Some(win) = app.get_webview_window("overlay") {
        let _ = win.set_size(Size::Logical(LogicalSize::new(width, height)));
    }
}

#[tauri::command]
fn update_content_dimensions_centered(app: AppHandle, width: f64, height: f64) {
    if let Some(win) = app.get_webview_window("overlay") {
        if let Ok(current_pos) = win.outer_position() {
            if let Ok(current_size) = win.outer_size() {
                let new_x =
                    current_pos.x + ((current_size.width as i32 - width.round() as i32) / 2);
                let _ = win.set_position(Position::Physical(PhysicalPosition::new(
                    new_x,
                    current_pos.y,
                )));
            }
        }
        let _ = win.set_size(Size::Logical(LogicalSize::new(width, height)));
    }
}

#[tauri::command]
fn move_window_left(app: AppHandle) {
    move_active_window(app, -20, 0);
}

#[tauri::command]
fn move_window_right(app: AppHandle) {
    move_active_window(app, 20, 0);
}

#[tauri::command]
fn move_window_up(app: AppHandle) {
    move_active_window(app, 0, -20);
}

#[tauri::command]
fn move_window_down(app: AppHandle) {
    move_active_window(app, 0, 20);
}

fn primary_window(app: &AppHandle) -> Option<tauri::WebviewWindow> {
    if let Some(win) = app.get_webview_window("overlay") {
        if win.is_visible().unwrap_or(false) {
            return Some(win);
        }
    }
    if let Some(win) = app.get_webview_window("launcher") {
        return Some(win);
    }
    app.get_webview_window("settings")
        .or_else(|| app.get_webview_window("model-selector"))
        .or_else(|| app.get_webview_window("cropper"))
}

fn move_active_window(app: AppHandle, dx: i32, dy: i32) {
    if let Some(win) = primary_window(&app) {
        if let Ok(pos) = win.outer_position() {
            let _ = win.set_position(Position::Logical(LogicalPosition::new(
                (pos.x + dx) as f64,
                (pos.y + dy) as f64,
            )));
        }
    }
}

#[tauri::command]
fn window_minimize(app: AppHandle) {
    if let Some(win) = primary_window(&app) {
        let _ = win.minimize();
    }
}

#[tauri::command]
fn window_maximize(app: AppHandle) {
    if let Some(win) = primary_window(&app) {
        let maximized = win.is_maximized().unwrap_or(false);
        if maximized {
            let _ = win.unmaximize();
        } else {
            let _ = win.maximize();
        }
    }
}

#[tauri::command]
fn window_close(app: AppHandle) {
    if let Some(win) = primary_window(&app) {
        let _ = win.hide();
    }
}

#[tauri::command]
fn window_is_maximized(app: AppHandle) -> bool {
    if let Some(win) = primary_window(&app) {
        return win.is_maximized().unwrap_or(false);
    }
    false
}

#[tauri::command]
fn get_default_model(state: State<'_, Mutex<RuntimeState>>) -> Value {
    let model = state.lock().default_model.clone();
    json!({ "model": model })
}

#[tauri::command]
fn set_default_model(
    app: AppHandle,
    state: State<'_, Mutex<RuntimeState>>,
    model_id: String,
) -> Result<Value, String> {
    {
        let mut state = state.lock();
        state.default_model = model_id.clone();
        state.runtime_model = model_id.clone();
    }
    persist_settings_model(&app, &model_id)?;
    persist_runtime_model(&app, &model_id)?;
    emit_all(&app, "model-changed", model_id.clone());
    Ok(json!({ "success": true }))
}

#[tauri::command]
fn set_model(app: AppHandle, state: State<'_, Mutex<RuntimeState>>, model_id: String) -> Value {
    let active_model = {
        let mut runtime = state.lock();
        runtime.runtime_model = model_id;
        runtime.runtime_model.clone()
    };
    let _ = persist_runtime_model(&app, &active_model);
    emit_all(&app, "model-changed", active_model);
    json!({ "success": true })
}

#[tauri::command]
fn get_current_llm_config(state: State<'_, Mutex<RuntimeState>>) -> LlmConfigPayload {
    let state = state.lock();
    let model = state.runtime_model.clone();
    let (provider, is_ollama) = infer_provider(&model);
    LlmConfigPayload {
        provider,
        model,
        is_ollama,
    }
}

#[tauri::command]
fn set_stt_provider(
    app: AppHandle,
    state: State<'_, Mutex<RuntimeState>>,
    provider: String,
) -> Value {
    {
        let mut runtime = state.lock();
        runtime.stt_provider = provider.clone();
    }
    let _ = set_setting_string(&app, "sttProvider", &provider);
    emit_all(&app, "credentials-changed", json!({}));
    emit_stt_config_changed(&app, &provider);
    json!({ "success": true })
}

#[tauri::command]
fn get_stt_provider(app: AppHandle, state: State<'_, Mutex<RuntimeState>>) -> String {
    let runtime = state.lock().stt_provider.clone();
    if runtime != "none" {
        return runtime;
    }
    read_json_file(&settings_path(&app))
        .and_then(|v| {
            v.get("sttProvider")
                .and_then(Value::as_str)
                .map(ToString::to_string)
        })
        .unwrap_or_else(|| "none".to_string())
}

#[tauri::command]
fn set_groq_stt_api_key(app: AppHandle, api_key: String) -> Value {
    let _ = set_credential_string(&app, "sttGroqKey", api_key.trim());
    emit_all(&app, "credentials-changed", json!({}));
    let provider = read_json_file(&settings_path(&app))
        .and_then(|v| v.get("sttProvider").and_then(Value::as_str).map(ToString::to_string))
        .unwrap_or_else(|| "none".to_string());
    emit_stt_config_changed(&app, &provider);
    json!({ "success": true })
}

#[tauri::command]
fn set_open_ai_stt_api_key(app: AppHandle, api_key: String) -> Value {
    let _ = set_credential_string(&app, "sttOpenaiKey", api_key.trim());
    emit_all(&app, "credentials-changed", json!({}));
    let provider = read_json_file(&settings_path(&app))
        .and_then(|v| v.get("sttProvider").and_then(Value::as_str).map(ToString::to_string))
        .unwrap_or_else(|| "none".to_string());
    emit_stt_config_changed(&app, &provider);
    json!({ "success": true })
}

#[tauri::command]
fn set_open_ai_stt_base_url(app: AppHandle, url: String) -> Value {
    let _ = set_credential_string(&app, "openAiSttBaseUrl", url.trim());
    emit_all(&app, "credentials-changed", json!({}));
    json!({ "success": true })
}

#[tauri::command]
fn set_deepgram_api_key(app: AppHandle, api_key: String) -> Value {
    let _ = set_credential_string(&app, "sttDeepgramKey", api_key.trim());
    emit_all(&app, "credentials-changed", json!({}));
    let provider = read_json_file(&settings_path(&app))
        .and_then(|v| v.get("sttProvider").and_then(Value::as_str).map(ToString::to_string))
        .unwrap_or_else(|| "none".to_string());
    emit_stt_config_changed(&app, &provider);
    json!({ "success": true })
}

#[tauri::command]
fn set_eleven_labs_api_key(app: AppHandle, api_key: String) -> Value {
    let _ = set_credential_string(&app, "sttElevenLabsKey", api_key.trim());
    emit_all(&app, "credentials-changed", json!({}));
    let provider = read_json_file(&settings_path(&app))
        .and_then(|v| v.get("sttProvider").and_then(Value::as_str).map(ToString::to_string))
        .unwrap_or_else(|| "none".to_string());
    emit_stt_config_changed(&app, &provider);
    json!({ "success": true })
}

#[tauri::command]
fn set_azure_api_key(app: AppHandle, api_key: String) -> Value {
    let _ = set_credential_string(&app, "sttAzureKey", api_key.trim());
    emit_all(&app, "credentials-changed", json!({}));
    let provider = read_json_file(&settings_path(&app))
        .and_then(|v| v.get("sttProvider").and_then(Value::as_str).map(ToString::to_string))
        .unwrap_or_else(|| "none".to_string());
    emit_stt_config_changed(&app, &provider);
    json!({ "success": true })
}

#[tauri::command]
fn set_azure_region(app: AppHandle, region: String) -> Value {
    let value = if region.trim().is_empty() {
        "eastus"
    } else {
        region.trim()
    };
    let _ = set_credential_string(&app, "azureRegion", value);
    emit_all(&app, "credentials-changed", json!({}));
    json!({ "success": true })
}

#[tauri::command]
fn set_ibm_watson_api_key(app: AppHandle, api_key: String) -> Value {
    let _ = set_credential_string(&app, "sttIbmKey", api_key.trim());
    emit_all(&app, "credentials-changed", json!({}));
    let provider = read_json_file(&settings_path(&app))
        .and_then(|v| v.get("sttProvider").and_then(Value::as_str).map(ToString::to_string))
        .unwrap_or_else(|| "none".to_string());
    emit_stt_config_changed(&app, &provider);
    json!({ "success": true })
}

#[tauri::command]
fn set_ibm_watson_region(app: AppHandle, region: String) -> Value {
    let value = if region.trim().is_empty() {
        "us-south"
    } else {
        region.trim()
    };
    let _ = set_credential_string(&app, "ibmWatsonRegion", value);
    emit_all(&app, "credentials-changed", json!({}));
    json!({ "success": true })
}

#[tauri::command]
fn set_soniox_api_key(app: AppHandle, api_key: String) -> Value {
    let _ = set_credential_string(&app, "sttSonioxKey", api_key.trim());
    emit_all(&app, "credentials-changed", json!({}));
    let provider = read_json_file(&settings_path(&app))
        .and_then(|v| v.get("sttProvider").and_then(Value::as_str).map(ToString::to_string))
        .unwrap_or_else(|| "none".to_string());
    emit_stt_config_changed(&app, &provider);
    json!({ "success": true })
}

#[tauri::command]
fn set_groq_stt_model(app: AppHandle, model: String) -> Value {
    let value = if model.trim().is_empty() {
        "whisper-large-v3-turbo"
    } else {
        model.trim()
    };
    let _ = set_credential_string(&app, "groqSttModel", value);
    emit_all(&app, "credentials-changed", json!({}));
    json!({ "success": true })
}

#[tauri::command]
async fn test_stt_connection(
    provider: String,
    api_key: String,
    _region: Option<String>,
) -> Value {
    if api_key.trim().is_empty() {
        return json!({ "success": false, "error": "API key is empty" });
    }

    if provider != "deepgram" {
        return json!({ "success": true });
    }

    let client = reqwest::Client::new();
    let response = client
        .get("https://api.deepgram.com/v1/auth/token")
        .header("Authorization", format!("Token {}", api_key.trim()))
        .send()
        .await;

    match response {
        Ok(resp) if resp.status().is_success() => json!({ "success": true }),
        Ok(resp) => {
            let status = resp.status();
            let body = resp
                .text()
                .await
                .unwrap_or_else(|_| "Unknown Deepgram error".to_string());
            json!({
                "success": false,
                "error": format!("Deepgram auth failed ({}): {}", status.as_u16(), body)
            })
        }
        Err(err) => json!({ "success": false, "error": err.to_string() }),
    }
}

#[tauri::command]
async fn deepgram_transcribe_answer_now(
    app: AppHandle,
    audio_base64: String,
    mime_type: Option<String>,
    model: Option<String>,
) -> Value {
    let api_key = {
        let stored = get_credential_string(&app, "sttDeepgramKey");
        if stored.trim().is_empty() {
            std::env::var("DEEPGRAM_API_KEY").unwrap_or_default()
        } else {
            stored
        }
    };
    if api_key.trim().is_empty() {
        return json!({
            "success": false,
            "error": "missing_deepgram_api_key"
        });
    }

    let audio_bytes = match base64::engine::general_purpose::STANDARD.decode(audio_base64.as_bytes()) {
        Ok(bytes) if !bytes.is_empty() => bytes,
        Ok(_) => {
            return json!({
                "success": false,
                "error": "empty_audio_payload"
            })
        }
        Err(err) => {
            return json!({
                "success": false,
                "error": format!("invalid_audio_payload: {}", err)
            })
        }
    };

    let requested_model = model
        .map(|m| m.trim().to_string())
        .filter(|m| !m.is_empty())
        .unwrap_or_else(|| "nova-3".to_string());
    let model_name = if requested_model == "flux-general-multi" {
        "nova-3".to_string()
    } else {
        requested_model
    };
    let content_type = mime_type
        .map(|m| m.trim().to_string())
        .filter(|m| !m.is_empty())
        .unwrap_or_else(|| "audio/webm".to_string());

    let mut url = format!(
        "https://api.deepgram.com/v1/listen?model={}&smart_format=true&punctuate=true",
        model_name
    );
    if model_name.starts_with("nova-") {
        url.push_str("&language=multi");
    }

    let response = reqwest::Client::new()
        .post(url)
        .header("Authorization", format!("Token {}", api_key.trim()))
        .header("Content-Type", content_type)
        .body(audio_bytes)
        .send()
        .await;

    let resp = match response {
        Ok(resp) => resp,
        Err(err) => {
            return json!({
                "success": false,
                "error": format!("deepgram_request_failed: {}", err)
            })
        }
    };

    let status = resp.status();
    let response_text = resp
        .text()
        .await
        .unwrap_or_else(|_| "unreadable_deepgram_response".to_string());

    if !status.is_success() {
        return json!({
            "success": false,
            "error": format!("deepgram_http_{}: {}", status.as_u16(), response_text)
        });
    }

    let payload: Value = match serde_json::from_str(&response_text) {
        Ok(payload) => payload,
        Err(err) => {
            return json!({
                "success": false,
                "error": format!("invalid_deepgram_json: {}", err)
            })
        }
    };

    let transcript = payload
        .pointer("/results/channels/0/alternatives/0/transcript")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .trim()
        .to_string();

    let languages = payload
        .pointer("/results/channels/0/alternatives/0/languages")
        .cloned()
        .unwrap_or_else(|| json!([]));

    json!({
        "success": true,
        "transcript": transcript,
        "languages": languages
    })
}

#[tauri::command]
fn open_external(_app: AppHandle, url: String) -> Result<(), String> {
    tauri_plugin_opener::open_url(&url, None::<String>).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_meeting_retention(app: AppHandle) -> String {
    let settings_file = settings_path(&app);
    read_json_file(&settings_file)
        .and_then(|v| {
            v.get("meetingRetention")
                .and_then(Value::as_str)
                .map(ToString::to_string)
        })
        .unwrap_or_else(|| "forever".to_string())
}

#[tauri::command]
fn set_meeting_retention(app: AppHandle, retention: String) -> Value {
    let normalized = match retention.as_str() {
        "7d" | "30d" | "never" | "forever" => retention,
        _ => "forever".to_string(),
    };
    let _ = set_setting_string(&app, "meetingRetention", &normalized);
    emit_all(&app, "meeting-retention-changed", normalized.clone());
    json!({ "success": true })
}

#[tauri::command]
fn take_screenshot(app: AppHandle) -> Result<ScreenshotPayload, String> {
    fs::create_dir_all(screenshots_dir(&app)).map_err(|e| e.to_string())?;
    let screens = Screen::all().map_err(|e| e.to_string())?;
    let Some(screen) = screens.first() else {
        return Err("No displays available".to_string());
    };
    let image = screen.capture().map_err(|e| e.to_string())?;
    let filename = format!("{}.png", Uuid::new_v4());
    let out_path = screenshots_dir(&app).join(filename);
    image.save(&out_path).map_err(|e| e.to_string())?;
    let bytes = fs::read(&out_path).map_err(|e| e.to_string())?;
    let preview = format!(
        "data:image/png;base64,{}",
        base64::engine::general_purpose::STANDARD.encode(bytes)
    );
    let payload = ScreenshotPayload {
        path: normalize_path(&out_path),
        preview,
    };
    emit_all(&app, "screenshot-taken", payload.clone());
    Ok(payload)
}

#[tauri::command]
fn take_selective_screenshot(app: AppHandle) -> Result<Value, String> {
    let shot = take_screenshot(app)?;
    Ok(json!({
        "path": shot.path,
        "preview": shot.preview,
        "cancelled": false
    }))
}

#[tauri::command]
fn get_screenshots(app: AppHandle) -> Result<Vec<ScreenshotPayload>, String> {
    let dir = screenshots_dir(&app);
    if !dir.exists() {
        return Ok(Vec::new());
    }
    let mut out = Vec::new();
    for entry in fs::read_dir(dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("png") {
            continue;
        }
        let bytes = fs::read(&path).map_err(|e| e.to_string())?;
        let preview = format!(
            "data:image/png;base64,{}",
            base64::engine::general_purpose::STANDARD.encode(bytes)
        );
        out.push(ScreenshotPayload {
            path: normalize_path(&path),
            preview,
        });
    }
    Ok(out)
}

#[tauri::command]
fn delete_screenshot(app: AppHandle, path: String) -> Result<Value, String> {
    let screenshots = screenshots_dir(&app);
    let resolved = PathBuf::from(&path);
    let inside = resolved
        .canonicalize()
        .ok()
        .map(|p| p.starts_with(&screenshots))
        .unwrap_or(false);
    if !inside {
        return Ok(json!({ "success": false, "error": "Path not allowed" }));
    }
    fs::remove_file(resolved).map_err(|e| e.to_string())?;
    Ok(json!({ "success": true }))
}

#[tauri::command]
fn get_recent_meetings(app: AppHandle) -> Vec<Value> {
    let mut meetings = load_meetings(&app);
    meetings.sort_by(|a, b| b.created_at_ms.cmp(&a.created_at_ms));
    meetings
        .into_iter()
        .take(50)
        .map(|meeting| meeting_to_list_item(&meeting))
        .collect()
}

#[tauri::command]
fn get_meeting_details(app: AppHandle, id: String) -> Value {
    let meetings = load_meetings(&app);
    if let Some(meeting) = meetings.into_iter().find(|m| m.id == id) {
        return json!({
            "id": meeting.id,
            "title": meeting.title,
            "date": meeting.date,
            "duration": meeting.duration,
            "summary": meeting.summary,
            "detailedSummary": meeting.detailed_summary,
            "transcript": meeting.transcript,
            "usage": meeting.usage
        });
    }
    Value::Null
}

#[tauri::command]
fn update_meeting_title(app: AppHandle, id: String, title: String) -> bool {
    let mut meetings = load_meetings(&app);
    let mut updated = false;
    for meeting in &mut meetings {
        if meeting.id == id {
            meeting.title = title.clone();
            updated = true;
            break;
        }
    }
    if !updated {
        return false;
    }
    let saved = save_meetings(&app, &meetings).is_ok();
    if saved {
        emit_all(&app, "meetings-updated", json!({}));
    }
    saved
}

#[tauri::command]
fn update_meeting_summary(app: AppHandle, id: String, updates: Value) -> bool {
    let mut meetings = load_meetings(&app);
    let Some(meeting) = meetings.iter_mut().find(|m| m.id == id) else {
        return false;
    };

    let mut detailed = meeting.detailed_summary.clone();
    if !detailed.is_object() {
        detailed = default_detailed_summary();
    }

    if let Some(overview) = updates.get("overview").and_then(Value::as_str) {
        detailed["overview"] = Value::String(overview.to_string());
        meeting.summary = overview.to_string();
    }
    if let Some(action_items) = updates.get("actionItems").and_then(Value::as_array) {
        detailed["actionItems"] = Value::Array(action_items.clone());
    }
    if let Some(key_points) = updates.get("keyPoints").and_then(Value::as_array) {
        detailed["keyPoints"] = Value::Array(key_points.clone());
    }
    if let Some(action_items_title) = updates.get("actionItemsTitle").and_then(Value::as_str) {
        detailed["actionItemsTitle"] = Value::String(action_items_title.to_string());
    }
    if let Some(key_points_title) = updates.get("keyPointsTitle").and_then(Value::as_str) {
        detailed["keyPointsTitle"] = Value::String(key_points_title.to_string());
    }
    if let Some(sections) = updates.get("sections").and_then(Value::as_array) {
        detailed["sections"] = Value::Array(sections.clone());
    }
    if let Some(action_items_structured) = updates.get("actionItemsStructured").and_then(Value::as_array)
    {
        detailed["actionItemsStructured"] = Value::Array(action_items_structured.clone());
    }
    if let Some(follow_up_draft) = updates.get("followUpDraft").and_then(Value::as_str) {
        detailed["followUpDraft"] = Value::String(follow_up_draft.to_string());
    }
    if let Some(coaching_insights) = updates.get("coachingInsights").and_then(Value::as_array) {
        detailed["coachingInsights"] = Value::Array(coaching_insights.clone());
    }
    if let Some(schema_version) = updates.get("schemaVersion") {
        detailed["schemaVersion"] = schema_version.clone();
    }

    meeting.detailed_summary = detailed;
    let saved = save_meetings(&app, &meetings).is_ok();
    if saved {
        emit_all(&app, "meetings-updated", json!({}));
    }
    saved
}

#[tauri::command]
fn get_keybinds(state: State<'_, Mutex<RuntimeState>>) -> Vec<Value> {
    let state = state.lock();
    state
        .keybinds
        .iter()
        .map(|(id, accelerator)| {
            json!({
                "id": id,
                "label": id,
                "accelerator": accelerator,
                "defaultAccelerator": accelerator,
                "isGlobal": true
            })
        })
        .collect()
}

#[tauri::command]
fn set_keybind(
    app: AppHandle,
    state: State<'_, Mutex<RuntimeState>>,
    id: String,
    accelerator: String,
) -> bool {
    {
        let mut state = state.lock();
        state.keybinds.insert(id, accelerator);
    }
    emit_all(&app, "keybinds-update", get_keybinds(state));
    true
}

#[tauri::command]
fn reset_keybinds(app: AppHandle, state: State<'_, Mutex<RuntimeState>>) -> Vec<Value> {
    {
        let mut state = state.lock();
        state.keybinds.clear();
        state
            .keybinds
            .insert("toggleWindow".to_string(), "CommandOrControl+B".to_string());
    }
    let keybinds = get_keybinds(state);
    emit_all(&app, "keybinds-update", keybinds.clone());
    keybinds
}

#[tauri::command]
fn toggle_settings_window(app: AppHandle) {
    if let Some(win) = app.get_webview_window("settings") {
        let visible = win.is_visible().unwrap_or(false);
        if visible {
            let _ = win.hide();
        } else {
            let _ = win.show();
            let _ = win.set_focus();
        }
    }
}

#[tauri::command]
fn toggle_model_selector(app: AppHandle) {
    if let Some(win) = app.get_webview_window("model-selector") {
        let visible = win.is_visible().unwrap_or(false);
        if visible {
            let _ = win.hide();
        } else {
            let _ = win.show();
            let _ = win.set_focus();
        }
    }
}

#[tauri::command]
fn model_selector_close_if_open(app: AppHandle) {
    if let Some(win) = app.get_webview_window("model-selector") {
        let _ = win.hide();
    }
}

#[tauri::command]
fn check_for_updates() -> Value {
    json!({ "checked": true, "available": false })
}

#[tauri::command]
fn download_update() -> Value {
    json!({ "success": false, "reason": "not_available" })
}

#[tauri::command]
fn restart_and_install() -> Value {
    json!({ "success": false, "reason": "not_available" })
}

#[tauri::command]
fn test_release_fetch() -> Value {
    json!({ "success": false, "error": "not_implemented" })
}

#[tauri::command]
fn get_arch() -> String {
    std::env::consts::ARCH.to_string()
}

#[tauri::command]
fn quit_app(app: AppHandle, state: State<'_, Mutex<RuntimeState>>) {
    let _ = finalize_active_meeting_if_any(&app, &state);
    app.exit(0);
}

#[tauri::command]
fn legacy_invoke(channel: String, _args: Option<Value>) -> Value {
    json!({
        "success": false,
        "channel": channel,
        "error": "legacy_channel_not_mapped_in_tauri_yet"
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let runtime_state = Mutex::new(default_runtime_state());

    tauri::Builder::default()
        .manage(runtime_state)
        .plugin(tauri_plugin_log::Builder::default().level(log::LevelFilter::Info).build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            let handle = app.handle().clone();
            let _ = migrate_from_electron(&handle);
            {
                let state = app.state::<Mutex<RuntimeState>>();
                let mut state = state.lock();
                load_runtime_state_from_disk(&handle, &mut state);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_theme_mode,
            set_theme_mode,
            get_stored_credentials,
            get_recognition_languages,
            get_ai_response_languages,
            set_recognition_language,
            get_stt_language,
            set_ai_response_language,
            get_ai_response_language,
            set_gemini_api_key,
            set_groq_api_key,
            set_openai_api_key,
            set_claude_api_key,
            set_momor_api_key,
            set_deepseek_api_key,
            set_deepseek_model,
            get_deepseek_api_key,
            set_tavily_api_key,
            license_get_details,
            license_check_premium,
            license_check_premium_async,
            profile_get_status,
            get_local_trial,
            get_trial_status,
            start_meeting,
            end_meeting,
            get_meeting_active,
            get_native_audio_status,
            start_answer_now_mic,
            stop_answer_now_mic,
            finalize_mic_stt,
            append_meeting_transcript,
            get_input_devices,
            get_output_devices,
            set_window_mode,
            show_window,
            hide_window,
            toggle_window,
            show_overlay,
            hide_overlay,
            update_content_dimensions,
            update_content_dimensions_centered,
            move_window_left,
            move_window_right,
            move_window_up,
            move_window_down,
            window_minimize,
            window_maximize,
            window_close,
            window_is_maximized,
            get_default_model,
            set_default_model,
            set_model,
            get_current_llm_config,
            set_stt_provider,
            get_stt_provider,
            set_groq_stt_api_key,
            set_open_ai_stt_api_key,
            set_open_ai_stt_base_url,
            set_deepgram_api_key,
            set_eleven_labs_api_key,
            set_azure_api_key,
            set_azure_region,
            set_ibm_watson_api_key,
            set_ibm_watson_region,
            set_soniox_api_key,
            set_groq_stt_model,
            test_stt_connection,
            deepgram_transcribe_answer_now,
            open_external,
            get_meeting_retention,
            set_meeting_retention,
            take_screenshot,
            take_selective_screenshot,
            get_screenshots,
            delete_screenshot,
            get_recent_meetings,
            get_meeting_details,
            update_meeting_title,
            update_meeting_summary,
            get_keybinds,
            set_keybind,
            reset_keybinds,
            toggle_settings_window,
            toggle_model_selector,
            model_selector_close_if_open,
            check_for_updates,
            download_update,
            restart_and_install,
            test_release_fetch,
            get_arch,
            quit_app,
            legacy_invoke
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(move |app, event| {
            if matches!(event, RunEvent::Exit | RunEvent::ExitRequested { .. }) {
                let runtime_state = app.state::<Mutex<RuntimeState>>();
                let _ = finalize_active_meeting_if_any(app, &runtime_state);
            }
        });
}
