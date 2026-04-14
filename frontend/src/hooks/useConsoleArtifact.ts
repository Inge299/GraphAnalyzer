import { useCallback } from 'react';
import type { AppDispatch } from '../store';
import type { ApiArtifact } from '../types/api';
import { consoleApi } from '../services/api';

interface ConsoleProfileParam {
  key?: string;
  label?: string;
  type?: string;
  default?: unknown;
}

interface ConsoleProfile {
  id: string;
  params?: ConsoleProfileParam[];
}

interface ConsoleProfilesResponse {
  profiles?: ConsoleProfile[];
}

interface ConsoleRefreshResponse {
  id: number;
}

interface UseConsoleArtifactArgs {
  activeArtifact: ApiArtifact | null;
  currentProjectId?: number;
  dispatch: AppDispatch;
  fetchArtifactsAction: (projectId: number) => Parameters<AppDispatch>[0];
  setCurrentArtifactAction: (artifactId: number | null) => { type: string; payload: number | null };
}

const toErrorMessage = (error: unknown): string => {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const detail = (error as { response?: { data?: { detail?: unknown } } }).response?.data?.detail;
    if (typeof detail === 'string' && detail.trim()) return detail;
  }
  if (error instanceof Error && error.message) return error.message;
  return 'Не удалось обновить консоль';
};

export const useConsoleArtifact = ({
  activeArtifact,
  currentProjectId,
  dispatch,
  fetchArtifactsAction,
  setCurrentArtifactAction,
}: UseConsoleArtifactArgs) => {
  const refreshConsole = useCallback(async () => {
    if (!activeArtifact || activeArtifact.type !== 'console' || !currentProjectId) return;

    try {
      const profileResponse = await consoleApi.profiles() as ConsoleProfilesResponse;
      const profiles = Array.isArray(profileResponse?.profiles) ? profileResponse.profiles : [];
      if (profiles.length === 0) {
        window.alert('Нет доступных профилей консоли');
        return;
      }

      const defaultProfileId = String(activeArtifact.metadata?.console_profile_id || profiles[0].id || '').trim();
      const profileId = window.prompt(
        `Профиль консоли (${profiles.map((p) => p.id).join(', ')}):`,
        defaultProfileId,
      );
      if (profileId === null) return;

      const selectedProfile = profiles.find((item) => String(item.id) === String(profileId).trim());
      if (!selectedProfile) {
        window.alert('Профиль не найден');
        return;
      }

      const params: Record<string, unknown> = { ...(activeArtifact.metadata?.console_last_params || {}) };
      const profileParams = Array.isArray(selectedProfile.params) ? selectedProfile.params : [];
      for (const spec of profileParams) {
        const key = String(spec?.key || '').trim();
        if (!key) continue;
        const currentValue = params[key] ?? spec?.default ?? '';
        const answer = window.prompt(String(spec?.label || key), String(currentValue));
        if (answer === null) return;

        if (String(spec?.type || '').toLowerCase() === 'number') {
          const numeric = Number(answer);
          params[key] = Number.isFinite(numeric) ? numeric : currentValue;
        } else {
          params[key] = answer;
        }
      }

      const updated = await consoleApi.refresh(currentProjectId, activeArtifact.id, String(selectedProfile.id), params) as ConsoleRefreshResponse;
      dispatch(setCurrentArtifactAction(updated.id));
      await dispatch(fetchArtifactsAction(currentProjectId));
    } catch (error: unknown) {
      window.alert(toErrorMessage(error));
    }
  }, [activeArtifact, currentProjectId, dispatch, fetchArtifactsAction, setCurrentArtifactAction]);

  return {
    refreshConsole,
  };
};

