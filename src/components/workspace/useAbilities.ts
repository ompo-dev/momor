// React-Query hooks for the sidebar "MCPs" + "Skills" sections.
import { useQuery, useQueryClient } from "@tanstack/react-query";

export interface McpServer {
  id: string;
  name: string;
  transport: "stdio" | "sse" | "http";
  command: string | null;
  args: string[];
  env: Record<string, string>;
  url: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  content: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

const MCPS_KEY = ["mcp-servers"] as const;
const SKILLS_KEY = ["skills"] as const;

export function useMcpServers() {
  return useQuery({
    queryKey: MCPS_KEY,
    queryFn: async (): Promise<McpServer[]> =>
      (await window.electronAPI?.mcpGetAll?.()) ?? [],
    staleTime: 5_000,
  });
}

export function useSkills() {
  return useQuery({
    queryKey: SKILLS_KEY,
    queryFn: async (): Promise<Skill[]> =>
      (await window.electronAPI?.skillGetAll?.()) ?? [],
    staleTime: 5_000,
  });
}

export function useAbilityActions() {
  const queryClient = useQueryClient();
  const invalidateMcps = () =>
    queryClient.invalidateQueries({ queryKey: MCPS_KEY });
  const invalidateSkills = () =>
    queryClient.invalidateQueries({ queryKey: SKILLS_KEY });
  return { invalidateMcps, invalidateSkills };
}
