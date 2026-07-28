export {};

declare global {
  interface Window {
    electronAPI?: {
      isElectron: boolean;
      data: {
        request(method: string, endpoint: string, data?: unknown, authToken?: string | null): Promise<any>;
      };
      sync: {
        initial(token: string): Promise<{ success: boolean }>;
        pull(token?: string): Promise<{ success: boolean }>;
        push(): Promise<unknown>;
        status(): Promise<{
          online: boolean;
          pendingCount: number;
          lastFullPullAt: string | null;
          lastPushAt: string | null;
          pushBlockedReason: string | null;
          tableStates: Array<{ table_name: string; last_synced_at: string | null; record_count: number }>;
        }>;
        logs(limit?: number): Promise<Array<{
          id: number;
          direction: string;
          status: string;
          message: string;
          details: string | null;
          created_at: string;
        }>>;
      };
      auth: {
        setToken(token: string): Promise<{ success: boolean }>;
        clearToken(): Promise<{ success: boolean }>;
      };
      app: {
        startupState(): Promise<{ shouldResetSession: boolean }>;
        checkUpdate(): Promise<{
          currentVersion: string;
          latestVersion: string | null;
          updateAvailable: boolean;
        }>;
        openUpdate(): Promise<{ success: boolean }>;
      };
    };
  }
}
