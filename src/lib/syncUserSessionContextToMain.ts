import {
  getActiveAiProfileId,
  loadUserSessionData,
  type UserSessionData,
} from "./userSessionContext";

export async function syncUserSessionContextToMain(
  data?: UserSessionData,
): Promise<void> {
  if (!window.electronAPI?.syncUserSessionContext) return;

  const sessionData = data ?? loadUserSessionData();
  const activeProfileId = getActiveAiProfileId();

  try {
    await window.electronAPI.syncUserSessionContext({
      personalContext: sessionData.personalContext,
      sessionContext: sessionData.sessionContext,
      profiles: sessionData.profiles,
      activeProfileId,
    });
  } catch (err) {
    console.warn("[syncUserSessionContextToMain] sync failed:", err);
  }
}
