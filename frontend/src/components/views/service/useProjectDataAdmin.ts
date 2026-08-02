import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { domainModelApi, projectDataApi } from '../../../services/api';
import type { MetadataBundle, ProjectDataImportJob, ProjectDataImportPlugin, ProjectDataLoadResponse } from '../../../types/api';
import { createLocalId, detectProjectDataFileKind } from './formOptions';
import type { ProjectDataSelectedFileItem } from './types';

interface UseProjectDataAdminOptions {
  projectId: number | null;
  onMessage: (message: string | null) => void;
  onError: (message: string | null) => void;
  getRequestErrorMessage: (error: unknown, fallback: string, timeoutMessage?: string) => string;
}

const decodeHeaderText = async (file: File): Promise<string> => {
  const chunk = await file.slice(0, 65536).arrayBuffer();
  const bytes = new Uint8Array(chunk);
  for (const encoding of ['utf-8', 'windows-1251']) {
    try {
      const text = new TextDecoder(encoding, { fatal: false }).decode(bytes);
      if (text) return text;
    } catch {
      // ignore and try next encoding
    }
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
};

const detectImportPluginForFile = async (
  file: File,
  plugins: ProjectDataImportPlugin[],
): Promise<{ id: string | null; name: string | null }> => {
  const userActionsPlugin = plugins.find((plugin) => plugin.id === 'nodex_user_actions_address_book') ?? null;
  const trafficPlugin = plugins.find((plugin) => plugin.id === 'nodex_traffic_geo') ?? null;

  // ZIP contents are inspected on the backend; do not guess from its filename.
  if (file.name.toLowerCase().endsWith('.zip')) return { id: null, name: null };

  const text = await decodeHeaderText(file);
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const headers = new Set(
    firstLine
      .split(';')
      .map((value) => value.trim().replace(/^"|"$/g, '').toLowerCase())
      .filter(Boolean),
  );

  const hasUserActionsHeaders =
    headers.has('\u0434\u0430\u0442\u0430 \u0438 \u0432\u0440\u0435\u043c\u044f') &&
    headers.has('\u0442\u0435\u0445\u0434\u0430\u043d\u043d\u044b\u0435, \u0438\u0434\u0435\u043d\u0442. \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f') &&
    headers.has('\u0442\u0435\u043a\u0441\u0442 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u044f');
  if (hasUserActionsHeaders) return { id: userActionsPlugin?.id ?? null, name: userActionsPlugin?.name ?? null };

  const hasTrafficHeaders =
    headers.has('abon1') ||
    headers.has('identifier_type') ||
    headers.has('identifier_value') ||
    (headers.has('\u043d\u043e\u043c\u0435\u0440 \u0430\u0431\u043e\u043d\u0435\u043d\u0442\u0430') &&
      (headers.has('\u043d\u043e\u043c\u0435\u0440 \u043a\u043e\u043d\u0442\u0430\u043a\u0442\u0430') ||
        headers.has('\u0432\u0440\u0435\u043c\u044f \u043d\u0430\u0447\u0430\u043b\u0430 \u0441\u043e\u0435\u0434\u0438\u043d\u0435\u043d\u0438\u044f') ||
        headers.has('\u0432\u0440\u0435\u043c\u044f \u043e\u043f\u0440\u0435\u0434\u0435\u043b\u0435\u043d\u0438\u044f \u043c\u0435\u0441\u0442\u043e\u043f\u043e\u043b\u043e\u0436\u0435\u043d\u0438\u044f')));
  return hasTrafficHeaders
    ? { id: trafficPlugin?.id ?? null, name: trafficPlugin?.name ?? null }
    : { id: null, name: null };
};

export const useProjectDataAdmin = ({
  projectId,
  onMessage,
  onError,
  getRequestErrorMessage,
}: UseProjectDataAdminOptions) => {
  const [projectStats, setProjectStats] = useState<any | null>(null);
  const [projectStatsLoading, setProjectStatsLoading] = useState(false);
  const [projectStatsError, setProjectStatsError] = useState<string | null>(null);

  const [projectDataLoading, setProjectDataLoading] = useState(false);
  const [projectDataClearing, setProjectDataClearing] = useState(false);
  const [projectDataLastLoadResult, setProjectDataLastLoadResult] = useState<ProjectDataLoadResponse | null>(null);
  const [projectDataImportJob, setProjectDataImportJob] = useState<ProjectDataImportJob | null>(null);
  const [projectDataSelectedFiles, setProjectDataSelectedFiles] = useState<ProjectDataSelectedFileItem[]>([]);

  const [availableImportPlugins, setAvailableImportPlugins] = useState<ProjectDataImportPlugin[]>([]);
  const [importPluginSaving, setImportPluginSaving] = useState(false);
  const [importPluginManaging, setImportPluginManaging] = useState(false);
  const [selectedImportPluginId, setSelectedImportPluginId] = useState<string | null>(null);
  const [importPluginForm, setImportPluginForm] = useState({
    name: '',
    description: '',
    priority: '',
    enabled: true,
  });
  const [metadataExporting, setMetadataExporting] = useState(false);
  const [metadataImporting, setMetadataImporting] = useState(false);

  const [cellStats, setCellStats] = useState<any | null>(null);
  const [cellStatsLoading, setCellStatsLoading] = useState(false);
  const [cellStatsError, setCellStatsError] = useState<string | null>(null);

  const [enrichLoading, setEnrichLoading] = useState(false);
  const [enrichReport, setEnrichReport] = useState<any | null>(null);

  const projectDataFilesInputRef = useRef<HTMLInputElement | null>(null);
  const projectDataFileInputId = 'project-data-files-input';
  const metadataImportInputRef = useRef<HTMLInputElement | null>(null);

  const projectDataSelectedSummary = useMemo(() => {
    const totalSizeBytes = projectDataSelectedFiles.reduce((sum, item) => sum + item.sizeBytes, 0);
    const byKind = projectDataSelectedFiles.reduce<Record<string, number>>((acc, item) => {
      acc[item.kind] = (acc[item.kind] || 0) + 1;
      return acc;
    }, {});
    return {
      totalFiles: projectDataSelectedFiles.length,
      totalSizeBytes,
      byKind: Object.entries(byKind),
    };
  }, [projectDataSelectedFiles]);


  const fetchCellStats = useCallback(async () => {
    setCellStatsLoading(true);
    setCellStatsError(null);
    try {
      setCellStats(await projectDataApi.cellTowerStats());
    } catch (err: unknown) {
      setCellStatsError(
        getRequestErrorMessage(
          err,
          'Не удалось получить статистику справочника БС',
          'Статистика справочника БС обновляется дольше обычного. Попробуй повторить через минуту.',
        ),
      );
    } finally {
      setCellStatsLoading(false);
    }
  }, [getRequestErrorMessage]);

  const fetchImportPlugins = useCallback(async () => {
    try {
      const plugins = await projectDataApi.listImportPlugins();
      const normalized = Array.isArray(plugins) ? plugins : [];
      setAvailableImportPlugins(normalized);
      setSelectedImportPluginId((current) => current ?? normalized[0]?.id ?? null);
    } catch {
      setAvailableImportPlugins([]);
      setSelectedImportPluginId(null);
    }
  }, []);

  const fetchProjectStats = useCallback(async () => {
    if (!projectId) {
      setProjectStats(null);
      return;
    }
    setProjectStatsLoading(true);
    setProjectStatsError(null);
    try {
      setProjectStats(await projectDataApi.stats(projectId));
    } catch (err: unknown) {
      setProjectStatsError(
        getRequestErrorMessage(
          err,
          'Не удалось получить статистику проекта',
          'Статистика проекта обновляется дольше обычного. Попробуй повторить через минуту.',
        ),
      );
    } finally {
      setProjectStatsLoading(false);
    }
  }, [getRequestErrorMessage, projectId]);

  useEffect(() => {
    const selected = availableImportPlugins.find((plugin) => plugin.id === selectedImportPluginId) ?? null;
    if (!selected) {
      setImportPluginForm({ name: '', description: '', priority: '', enabled: true });
      return;
    }
    setImportPluginForm({
      name: selected.name,
      description: selected.description,
      priority: String(selected.priority),
      enabled: selected.enabled,
    });
  }, [availableImportPlugins, selectedImportPluginId]);

  const handleSaveImportPlugin = useCallback(async () => {
    if (!selectedImportPluginId) return;
    setImportPluginSaving(true);
    onError(null);
    try {
      await projectDataApi.updateImportPlugin(selectedImportPluginId, {
        name: importPluginForm.name,
        description: importPluginForm.description,
        priority: Number.parseInt(importPluginForm.priority, 10) || 0,
        enabled: importPluginForm.enabled,
      });
      await fetchImportPlugins();
      onMessage(`Настройки import-плагина ${selectedImportPluginId} сохранены.`);
    } catch (err: unknown) {
      onError(getRequestErrorMessage(err, 'Не удалось сохранить настройки import-плагина'));
    } finally {
      setImportPluginSaving(false);
    }
  }, [fetchImportPlugins, getRequestErrorMessage, importPluginForm, onError, onMessage, selectedImportPluginId]);

  const handleInstallImportPlugin = useCallback(async (file: File) => {
    setImportPluginManaging(true);
    onError(null);
    try {
      const result = await projectDataApi.installImportPlugin(file);
      await fetchImportPlugins();
      const installedPlugin = result.plugins[0] ?? null;
      if (installedPlugin) {
        setSelectedImportPluginId(installedPlugin.id);
      }
      onMessage(
        installedPlugin
          ? `Python-плагин «${installedPlugin.name}» подключён и активирован.`
          : `Python-модуль ${result.filename} подключён.`,
      );
    } catch (err: unknown) {
      onError(getRequestErrorMessage(err, 'Не удалось подключить Python-плагин импорта'));
    } finally {
      setImportPluginManaging(false);
    }
  }, [fetchImportPlugins, getRequestErrorMessage, onError, onMessage]);

  const handleDeleteImportPlugin = useCallback(async () => {
    if (!selectedImportPluginId) return;
    const plugin = availableImportPlugins.find((item) => item.id === selectedImportPluginId) ?? null;
    if (!plugin?.removable) return;
    if (!window.confirm(`Удалить внешний модуль «${plugin.name}»?`)) return;

    setImportPluginManaging(true);
    onError(null);
    try {
      await projectDataApi.deleteImportPlugin(plugin.id);
      setSelectedImportPluginId(null);
      await fetchImportPlugins();
      onMessage(`Python-плагин «${plugin.name}» удалён.`);
    } catch (err: unknown) {
      onError(getRequestErrorMessage(err, 'Не удалось удалить Python-плагин импорта'));
    } finally {
      setImportPluginManaging(false);
    }
  }, [availableImportPlugins, fetchImportPlugins, getRequestErrorMessage, onError, onMessage, selectedImportPluginId]);

  const handleExportMetadataBundle = useCallback(async () => {
    setMetadataExporting(true);
    onError(null);
    try {
      const bundle = await domainModelApi.exportMetadataBundle();
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `graphanalyzer-metadata-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      onMessage('Пакет метаданных выгружен в JSON-файл.');
    } catch (err: unknown) {
      onError(getRequestErrorMessage(err, 'Не удалось выгрузить пакет метаданных'));
    } finally {
      setMetadataExporting(false);
    }
  }, [getRequestErrorMessage, onError, onMessage]);

  const handleImportMetadataBundle = useCallback(async (file: File) => {
    setMetadataImporting(true);
    onError(null);
    try {
      const payload = JSON.parse(await file.text()) as MetadataBundle;
      await domainModelApi.importMetadataBundle(payload);
      await fetchImportPlugins();
      onMessage('Пакет метаданных импортирован.');
    } catch (err: unknown) {
      onError(getRequestErrorMessage(err, 'Не удалось импортировать пакет метаданных'));
    } finally {
      setMetadataImporting(false);
    }
  }, [fetchImportPlugins, getRequestErrorMessage, onError, onMessage]);

  const handleMetadataImportFile = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    void handleImportMetadataBundle(file);
  }, [handleImportMetadataBundle]);

  const handleLoadProjectDataFiles = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length === 0) return;

    onError(null);
    setProjectDataLastLoadResult(null);

    const recognized = await Promise.all(
      files.map(async (file) => {
        const detected = await detectImportPluginForFile(file, availableImportPlugins);
        return {
          id: createLocalId('project-file'),
          file,
          name: file.name,
          kind: detectProjectDataFileKind(file.name),
          sizeBytes: file.size,
          recognizedPluginId: detected.id,
          recognizedPluginName: detected.name,
          pluginSelectionMode: 'auto',
        } satisfies ProjectDataSelectedFileItem;
      }),
    );

    setProjectDataSelectedFiles((prev) => {
      const known = new Set(prev.map((item) => `${item.name}::${item.sizeBytes}::${item.file.lastModified}`));
      const next = [...prev];
      recognized.forEach((item) => {
        const key = `${item.name}::${item.sizeBytes}::${item.file.lastModified}`;
        if (!known.has(key)) {
          next.push(item);
          known.add(key);
        }
      });
      return next;
    });

    onMessage(`Выбрано файлов: ${files.length}. Формат для каждого файла предварительно распознан.`);
  }, [availableImportPlugins, onError, onMessage]);

  const handleRemoveProjectDataFile = useCallback((fileId: string) => {
    setProjectDataSelectedFiles((prev) => prev.filter((item) => item.id !== fileId));
  }, []);

  const handleClearProjectDataSelection = useCallback(() => {
    setProjectDataSelectedFiles([]);
    onMessage(null);
  }, [onMessage]);

  const handleChangeProjectDataFilePlugin = useCallback((fileId: string, pluginId: string) => {
    const selectedPlugin = availableImportPlugins.find((plugin) => plugin.id === pluginId) ?? null;
    setProjectDataSelectedFiles((prev) =>
      prev.map((item) =>
        item.id === fileId
          ? {
              ...item,
              recognizedPluginId: pluginId || null,
              recognizedPluginName: selectedPlugin?.name ?? null,
              pluginSelectionMode: 'manual',
            }
          : item,
      ),
    );
  }, [availableImportPlugins]);


  const handleUploadProjectData = useCallback(async () => {
    if (!projectId || projectDataSelectedFiles.length === 0) return;

    setProjectDataLoading(true);
    onError(null);
    onMessage(null);
    setProjectDataLastLoadResult(null);

    try {
      const pluginOverrides = projectDataSelectedFiles
        .filter((item) => item.recognizedPluginId)
        .map((item) => ({
          path: (item.file as any).webkitRelativePath || item.file.name,
          plugin_id: item.recognizedPluginId as string,
        }));
      onMessage('\u041f\u0435\u0440\u0435\u0434\u0430\u0447\u0430 \u0444\u0430\u0439\u043b\u043e\u0432 \u043d\u0430 \u0441\u0435\u0440\u0432\u0435\u0440...');
      let job = await projectDataApi.loadFromFiles(
        projectId,
        projectDataSelectedFiles.map((item) => item.file),
        pluginOverrides,
        (loaded, total) => {
          if (total && total > 0) {
            onMessage(`\u041f\u0435\u0440\u0435\u0434\u0430\u0447\u0430 \u0444\u0430\u0439\u043b\u043e\u0432 \u043d\u0430 \u0441\u0435\u0440\u0432\u0435\u0440: ${Math.min(100, Math.round((loaded / total) * 100))}%`);
          }
        },
      );
      setProjectDataImportJob(job);
      setProjectDataSelectedFiles([]);
      onMessage('\\u0418\\u043c\\u043f\\u043e\\u0440\\u0442 \\u0437\\u0430\\u043f\\u0443\\u0449\\u0435\\u043d \\u0432 \\u0444\\u043e\\u043d\\u0435. \\u041e\\u0441\\u0442\\u0430\\u0432\\u044c\\u0442\\u0435 \\u0441\\u0442\\u0440\\u0430\\u043d\\u0438\\u0446\\u0443 \\u043e\\u0442\\u043a\\u0440\\u044b\\u0442\\u043e\\u0439 \\u0434\\u043b\\u044f \\u043e\\u0442\\u0441\\u043b\\u0435\\u0436\\u0438\\u0432\\u0430\\u043d\\u0438\\u044f \\u043f\\u0440\\u043e\\u0433\\u0440\\u0435\\u0441\\u0441\\u0430.');

      while (job.status === 'queued' || job.status === 'running') {
        await new Promise((resolve) => window.setTimeout(resolve, 1000));
        job = await projectDataApi.getImportJob(projectId, job.id);
        setProjectDataImportJob(job);
      }

      if (job.status === 'completed' && job.result) {
        const result = job.result;
        const totalRead = Object.values(result.source_counts || {}).reduce(
          (sum, count) => sum + Number(count || 0),
          0,
        );
        onMessage(`\\u0418\\u043c\\u043f\\u043e\\u0440\\u0442 \\u0437\\u0430\\u0432\\u0435\\u0440\\u0448\\u0451\\u043d: \\u043e\\u0431\\u0440\\u0430\\u0431\\u043e\\u0442\\u0430\\u043d\\u043e ${totalRead} \\u0441\\u0442\\u0440\\u043e\\u043a, \\u0441\\u043e\\u0437\\u0434\\u0430\\u043d\\u043e ${result.entities} \\u0441\\u0443\\u0449\\u043d\\u043e\\u0441\\u0442\\u0435\\u0439, ${result.facts} \\u0444\\u0430\\u043a\\u0442\\u043e\\u0432, ${result.relations} \\u0441\\u0432\\u044f\\u0437\\u0435\\u0439.`);
        setProjectDataLastLoadResult(result);
        await Promise.all([fetchProjectStats(), fetchCellStats()]);
      } else {
        onError(job.error || '\\u0418\\u043c\\u043f\\u043e\\u0440\\u0442 \\u0437\\u0430\\u0432\\u0435\\u0440\\u0448\\u0438\\u043b\\u0441\\u044f \\u0441 \\u043e\\u0448\\u0438\\u0431\\u043a\\u043e\\u0439');
      }
    } catch (err: unknown) {
      onError(getRequestErrorMessage(err, '\\u041d\\u0435 \\u0443\\u0434\\u0430\\u043b\\u043e\\u0441\\u044c \\u0437\\u0430\\u043f\\u0443\\u0441\\u0442\\u0438\\u0442\\u044c \\u0438\\u043c\\u043f\\u043e\\u0440\\u0442 \\u0434\\u0430\\u043d\\u043d\\u044b\\u0445 \\u043f\\u0440\\u043e\\u0435\\u043a\\u0442\\u0430'));
    } finally {
      setProjectDataLoading(false);
    }
  }, [fetchCellStats, fetchProjectStats, getRequestErrorMessage, onError, onMessage, projectDataSelectedFiles, projectId]);
  const handleClearProjectData = useCallback(async () => {
    if (!projectId) return;
    if (!window.confirm(`\u041e\u0447\u0438\u0441\u0442\u0438\u0442\u044c \u0434\u0430\u043d\u043d\u044b\u0435 \u043f\u0440\u043e\u0435\u043a\u0442\u0430?\n\nProject ID: ${projectId}`)) return;

    setProjectDataClearing(true);
    onError(null);
    onMessage(null);
    setProjectDataLastLoadResult(null);

    try {
      await projectDataApi.clear(projectId);
      onMessage('\u0414\u0430\u043d\u043d\u044b\u0435 \u043f\u0440\u043e\u0435\u043a\u0442\u0430 \u043e\u0447\u0438\u0449\u0435\u043d\u044b.');
      await Promise.all([fetchProjectStats(), fetchCellStats()]);
    } catch (err: unknown) {
      onError(getRequestErrorMessage(err, '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043e\u0447\u0438\u0441\u0442\u0438\u0442\u044c \u0434\u0430\u043d\u043d\u044b\u0435 \u043f\u0440\u043e\u0435\u043a\u0442\u0430'));
    } finally {
      setProjectDataClearing(false);
    }
  }, [fetchCellStats, fetchProjectStats, getRequestErrorMessage, onError, onMessage, projectId]);
  const handleEnrichCellTowersByAddress = useCallback(async () => {
    if (!projectId) {
      onError('Сначала выбери проект');
      return;
    }
    setEnrichLoading(true);
    setEnrichReport(null);
    onMessage(null);
    onError(null);
    try {
      const report = await projectDataApi.enrichCellTowersByProjectAddresses(projectId);
      setEnrichReport(report);
      onMessage('Справочник БС обогащён по адресам из данных проекта.');
      await Promise.all([fetchCellStats(), fetchProjectStats()]);
    } catch (err: unknown) {
      onError(
        getRequestErrorMessage(
          err,
          'Не удалось обогатить справочник по адресам',
          'Обогащение справочника БС по адресам выполняется дольше обычного. Попробуй позже или увеличь время на операцию.',
        ),
      );
    } finally {
      setEnrichLoading(false);
    }
  }, [fetchCellStats, fetchProjectStats, getRequestErrorMessage, onError, onMessage, projectId]);

  useEffect(() => {
    void fetchCellStats();
    void fetchImportPlugins();
  }, [fetchCellStats, fetchImportPlugins]);

  useEffect(() => {
    void fetchProjectStats();
  }, [fetchProjectStats]);

  useEffect(() => {
    setProjectDataSelectedFiles([]);
    setProjectDataLastLoadResult(null);
  }, [projectId]);

  return {
    projectDataFilesInputRef,
    projectDataFileInputId,
    metadataImportInputRef,
    metadataExporting,
    metadataImporting,
    projectStats,
    projectStatsLoading,
    projectStatsError,
    projectDataLoading,
    projectDataClearing,
    projectDataLastLoadResult,
    projectDataImportJob,
    projectDataSelectedFiles,
    projectDataSelectedSummary,
    availableImportPlugins,
    selectedImportPluginId,
    setSelectedImportPluginId,
    importPluginForm,
    setImportPluginForm,
    importPluginSaving,
    importPluginManaging,
    handleSaveImportPlugin,
    handleInstallImportPlugin,
    handleDeleteImportPlugin,
    fetchImportPlugins,
    handleExportMetadataBundle,
    handleMetadataImportFile,
    cellStats,
    cellStatsLoading,
    cellStatsError,
    enrichLoading,
    enrichReport,
    fetchCellStats,
    fetchProjectStats,
    handleLoadProjectDataFiles,
    handleRemoveProjectDataFile,
    handleClearProjectDataSelection,
    handleChangeProjectDataFilePlugin,
    handleUploadProjectData,
    handleClearProjectData,
    handleEnrichCellTowersByAddress,
  };
};
