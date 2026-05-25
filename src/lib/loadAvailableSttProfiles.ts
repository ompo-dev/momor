export interface SttProfileOption {
  id: string;
  name: string;
  kind: string;
  configured: boolean;
  isDefault: boolean;
}

const CACHE_KEY = "momor_stt_profiles_cache_v1";

export function readCachedSttProfiles(): SttProfileOption[] {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SttProfileOption[];
  } catch {
    return [];
  }
}

export async function loadAvailableSttProfiles(): Promise<SttProfileOption[]> {
  const res = await window.electronAPI?.getSttProfiles?.();
  if (!res?.success || !res.profiles?.length) return [];

  const options: SttProfileOption[] = res.profiles
    .filter((p) => p.enabled && p.kind !== "none")
    .map((p) => ({
      id: p.id,
      name: p.name,
      kind: p.kind,
      configured: p.configured,
      isDefault: p.id === res.defaultProfileId,
    }));

  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(options));
  } catch {
    /* ignore */
  }
  return options;
}
