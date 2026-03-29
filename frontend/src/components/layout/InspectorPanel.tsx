// frontend/src/components/layout/InspectorPanel.tsx
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../store';
import { fetchArtifacts, deleteArtifact, updateArtifactSync, setCurrentArtifact } from '../../store/slices/artifactsSlice';
import { artifactApi, pluginApi } from '../../services/api';
import type { ApiPlugin, ApiArtifact } from '../../types/api';
import './InspectorPanel.css';

interface InspectorPanelProps {
  // props placeholder
}

const labels = {
  inspector: '\u0418\u043d\u0441\u043f\u0435\u043a\u0442\u043e\u0440',
  selectArtifact: '\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0430\u0440\u0442\u0435\u0444\u0430\u043a\u0442 \u0434\u043b\u044f \u043f\u0440\u043e\u0441\u043c\u043e\u0442\u0440\u0430',
  properties: '\u0421\u0432\u043e\u0439\u0441\u0442\u0432\u0430',
  history: '\u0418\u0441\u0442\u043e\u0440\u0438\u044f',
  metadata: '\u041c\u0435\u0442\u0430\u0434\u0430\u043d\u043d\u044b\u0435',
  name: '\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435',
  type: '\u0422\u0438\u043f',
  description: '\u041e\u043f\u0438\u0441\u0430\u043d\u0438\u0435',
  version: '\u0412\u0435\u0440\u0441\u0438\u044f',
  created: '\u0421\u043e\u0437\u0434\u0430\u043d',
  updated: '\u041e\u0431\u043d\u043e\u0432\u043b\u0435\u043d',
  plugins: '\u041f\u043b\u0430\u0433\u0438\u043d\u044b',
  loading: '\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430...',
  noPlugins: '\u041d\u0435\u0442 \u0434\u043e\u0441\u0442\u0443\u043f\u043d\u044b\u0445 \u043f\u043b\u0430\u0433\u0438\u043d\u043e\u0432',
  pluginRun: '\u0417\u0430\u043f\u0443\u0441\u0442\u0438\u0442\u044c',
  pluginRunning: '\u0417\u0430\u043f\u0443\u0441\u043a...',
  pluginDone: '\u041f\u043b\u0430\u0433\u0438\u043d "{name}" \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d',
  typeGraph: '\u0413\u0440\u0430\u0444',
  typeTable: '\u0422\u0430\u0431\u043b\u0438\u0446\u0430',
  typeMap: '\u041a\u0430\u0440\u0442\u0430',
  typeChart: '\u0414\u0438\u0430\u0433\u0440\u0430\u043c\u043c\u0430',
  typeDocument: '\u0414\u043e\u043a\u0443\u043c\u0435\u043d\u0442',
  historyPlaceholder: '\u0418\u0441\u0442\u043e\u0440\u0438\u044f \u0438\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u0439',
  artifactId: 'ID \u0430\u0440\u0442\u0435\u0444\u0430\u043a\u0442\u0430',
  projectId: 'ID \u043f\u0440\u043e\u0435\u043a\u0442\u0430',
  extraMetadata: '\u0414\u043e\u043f. \u043c\u0435\u0442\u0430\u0434\u0430\u043d\u043d\u044b\u0435',
  rename: '\u041f\u0435\u0440\u0435\u0438\u043c\u0435\u043d\u043e\u0432\u0430\u0442\u044c',
  renameConfirm: '\u041f\u0435\u0440\u0435\u0438\u043c\u0435\u043d\u043e\u0432\u0430\u0442\u044c \u0430\u0440\u0442\u0435\u0444\u0430\u043a\u0442? \u042d\u0442\u043e \u0438\u0437\u043c\u0435\u043d\u0438\u0442 \u0435\u0433\u043e \u043d\u0430\u0437\u0432\u0430\u043d\u0438\u0435.',
  delete: '\u0423\u0434\u0430\u043b\u0438\u0442\u044c',
  deleteConfirm: '\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u0430\u0440\u0442\u0435\u0444\u0430\u043a\u0442? \u042d\u0442\u043e \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u043d\u0435\u043e\u0431\u0440\u0430\u0442\u0438\u043c\u043e.',
  cancel: '\u041e\u0442\u043c\u0435\u043d\u0430',
  save: '\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c',
  selectResult: '\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0440\u0435\u0437\u0443\u043b\u044c\u0442\u0430\u0442'
};

const InspectorPanel: React.FC<InspectorPanelProps> = () => {
  const dispatch = useAppDispatch();
  const [activeTab, setActiveTab] = useState<'properties' | 'history' | 'metadata'>('properties');
  const [plugins, setPlugins] = useState<ApiPlugin[]>([]);
  const [pluginsLoading, setPluginsLoading] = useState(false);
  const [pluginsError, setPluginsError] = useState<string | null>(null);
  const [runningPluginId, setRunningPluginId] = useState<string | null>(null);
  const [pluginsMessage, setPluginsMessage] = useState<string | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [createdArtifacts, setCreatedArtifacts] = useState<ApiArtifact[] | null>(null);

  const selectedArtifact = useAppSelector(state => {
    const { currentArtifactId, items } = state.artifacts;
    return currentArtifactId ? items[currentArtifactId] : null;
  });

  const currentProject = useAppSelector(state => state.projects.currentProject);
  const handleTabChange = useCallback((tab: 'properties' | 'history' | 'metadata') => {
    setActiveTab(tab);
  }, []);

  useEffect(() => {
    const loadPlugins = async () => {
      if (!selectedArtifact) {
        setPlugins([]);
        return;
      }
      setPluginsLoading(true);
      setPluginsError(null);
      try {
        const response = await pluginApi.list();
        const list: ApiPlugin[] = response?.plugins || [];
        setPlugins(list);
      } catch (error: any) {
        setPluginsError(error?.message || 'Failed to load plugins');
      } finally {
        setPluginsLoading(false);
      }
    };

    loadPlugins();
  }, [selectedArtifact]);

  useEffect(() => {
    if (selectedArtifact?.name) {
      setRenameValue(selectedArtifact.name);
    }
  }, [selectedArtifact?.name]);

  const applicablePlugins = useMemo(() => {
    if (!selectedArtifact) return [];
    return plugins.filter(p => !p.applicable_to?.length || p.applicable_to.includes(selectedArtifact.type));
  }, [plugins, selectedArtifact]);

  const handleRunPlugin = useCallback(async (plugin: ApiPlugin) => {
    if (!selectedArtifact || !currentProject) return;
    setRunningPluginId(plugin.id);
    setPluginsMessage(null);
    setPluginsError(null);
    try {
      const response = await pluginApi.execute(plugin.id, currentProject.id, [selectedArtifact.id], {});
      await dispatch(fetchArtifacts(currentProject.id));
      const created = response?.created || [];
      if (created.length === 1) {
        dispatch(setCurrentArtifact(created[0].id));
      } else if (created.length > 1) {
        setCreatedArtifacts(created);
      }
      setPluginsMessage(labels.pluginDone.replace('{name}', plugin.name));
    } catch (error: any) {
      setPluginsError(error?.message || 'Failed to execute plugin');
    } finally {
      setRunningPluginId(null);
    }
  }, [selectedArtifact, currentProject, dispatch]);

  const handleSelectCreated = useCallback((artifactId: number) => {
    dispatch(setCurrentArtifact(artifactId));
    setCreatedArtifacts(null);
  }, [dispatch]);

  const handleRename = useCallback(async () => {
    if (!selectedArtifact || !currentProject) return;
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === selectedArtifact.name) {
      setIsRenaming(false);
      return;
    }
    const ok = window.confirm(`${labels.renameConfirm}\n\n${selectedArtifact.name} -> ${trimmed}`);
    if (!ok) return;
    setRenaming(true);
    try {
      const updated = await artifactApi.update(currentProject.id, selectedArtifact.id, { name: trimmed });
      dispatch(updateArtifactSync(updated));
      await dispatch(fetchArtifacts(currentProject.id));
      setIsRenaming(false);
    } catch (error) {
      // no-op
    } finally {
      setRenaming(false);
    }
  }, [selectedArtifact, currentProject, renameValue, dispatch]);

  const handleDelete = useCallback(async () => {
    if (!selectedArtifact || !currentProject || deleting) return;
    const ok = window.confirm(`${labels.deleteConfirm}\n\n${selectedArtifact.name}`);
    if (!ok) return;
    setDeleting(true);
    try {
      await dispatch(deleteArtifact({ projectId: currentProject.id, id: selectedArtifact.id }));
      await dispatch(fetchArtifacts(currentProject.id));
    } catch (error) {
      // no-op
    } finally {
      setDeleting(false);
    }
  }, [selectedArtifact, currentProject, deleting, dispatch]);

  if (!selectedArtifact) {
    return (
      <div className="inspector-panel">
        <div className="inspector-header">
          <h3>{labels.inspector}</h3>
        </div>
        <div className="inspector-empty">
          <p>{labels.selectArtifact}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="inspector-panel">
      {createdArtifacts && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000
          }}
        >
          <div
            style={{
              background: '#1f2937',
              border: '1px solid #2f3b4a',
              borderRadius: 8,
              padding: 12,
              minWidth: 260,
              maxWidth: 320
            }}
          >
            <div style={{ fontSize: 13, color: '#e5e7eb', marginBottom: 8 }}>{labels.selectResult}</div>
            {createdArtifacts.map(item => (
              <button
                key={item.id}
                onClick={() => handleSelectCreated(item.id)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: '#111827',
                  border: '1px solid #2f3b4a',
                  color: '#e5e7eb',
                  padding: '6px 8px',
                  borderRadius: 6,
                  marginBottom: 6,
                  cursor: 'pointer'
                }}
              >
                {item.name}
              </button>
            ))}
            <button
              onClick={() => setCreatedArtifacts(null)}
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                color: '#9ca3af',
                padding: '6px 4px',
                cursor: 'pointer'
              }}
            >
              {labels.cancel}
            </button>
          </div>
        </div>
      )}

      <div className="inspector-header">
        <h3>{labels.inspector}</h3>
        {currentProject && (
          <div className="project-badge">
            {currentProject.name}
          </div>
        )}
      </div>

      <div className="inspector-tabs">
        <button
          className={`tab-btn ${activeTab === 'properties' ? 'active' : ''}`}
          onClick={() => handleTabChange('properties')}
        >
          {labels.properties}
        </button>
        <button
          className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => handleTabChange('history')}
        >
          {labels.history}
        </button>
        <button
          className={`tab-btn ${activeTab === 'metadata' ? 'active' : ''}`}
          onClick={() => handleTabChange('metadata')}
        >
          {labels.metadata}
        </button>
      </div>

      <div className="inspector-content">
        {activeTab === 'properties' && (
          <div className="properties-tab">
            <div className="property-group">
              <label>{labels.name}</label>
              {!isRenaming ? (
                <div className="property-inline">
                  <div className="property-value">{selectedArtifact.name}</div>
                  <button
                    className="property-action"
                    onClick={() => setIsRenaming(true)}
                  >
                    {labels.rename}
                  </button>
                </div>
              ) : (
                <div className="property-inline">
                  <input
                    className="property-input"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                  />
                  <button
                    className="property-action"
                    onClick={handleRename}
                    disabled={renaming}
                  >
                    {labels.save}
                  </button>
                  <button
                    className="property-action secondary"
                    onClick={() => {
                      setIsRenaming(false);
                      setRenameValue(selectedArtifact.name);
                    }}
                  >
                    {labels.cancel}
                  </button>
                </div>
              )}
            </div>

            <div className="property-group">
              <label>{labels.type}</label>
              <div className="property-value type-badge">
                {selectedArtifact.type === 'graph' ? labels.typeGraph :
                 selectedArtifact.type === 'table' ? labels.typeTable :
                 selectedArtifact.type === 'map' ? labels.typeMap :
                 selectedArtifact.type === 'chart' ? labels.typeChart : labels.typeDocument}
              </div>
            </div>

            {selectedArtifact.description && (
              <div className="property-group">
                <label>{labels.description}</label>
                <div className="property-value">{selectedArtifact.description}</div>
              </div>
            )}

            <div className="property-group">
              <label>{labels.version}</label>
              <div className="property-value">v{selectedArtifact.version || 1}</div>
            </div>

            <div className="property-group">
              <label>{labels.created}</label>
              <div className="property-value">
                {new Date(selectedArtifact.created_at).toLocaleString()}
              </div>
            </div>

            <div className="property-group">
              <label>{labels.updated}</label>
              <div className="property-value">
                {new Date(selectedArtifact.updated_at).toLocaleString()}
              </div>
            </div>

            <div className="property-group">
              <label>{labels.plugins}</label>
              {pluginsLoading && (
                <div className="property-value">{labels.loading}</div>
              )}
              {pluginsError && (
                <div className="property-value" style={{ color: '#ff6b6b' }}>
                  {pluginsError}
                </div>
              )}
              {pluginsMessage && (
                <div className="property-value" style={{ color: '#81c784' }}>
                  {pluginsMessage}
                </div>
              )}
              {!pluginsLoading && !pluginsError && applicablePlugins.length === 0 && (
                <div className="property-value">{labels.noPlugins}</div>
              )}
              {applicablePlugins.map((plugin) => (
                <div key={plugin.id} className="property-value" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    className="tab-btn"
                    onClick={() => handleRunPlugin(plugin)}
                    disabled={!!runningPluginId}
                  >
                    {runningPluginId === plugin.id ? labels.pluginRunning : `${labels.pluginRun}: ${plugin.name}`}
                  </button>
                </div>
              ))}
            </div>

            <div className="property-group">
              <label>{labels.delete}</label>
              <div className="property-inline">
                <button
                  className="property-action danger"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {labels.delete}
                </button>
              </div>
            </div>

            {selectedArtifact.metadata && Object.entries(selectedArtifact.metadata).map(([key, value]) => (
              <div key={key} className="property-group">
                <label>{key}</label>
                <div className="property-value">
                  {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="history-tab">
            <p className="placeholder">{labels.historyPlaceholder}</p>
          </div>
        )}

        {activeTab === 'metadata' && (
          <div className="metadata-tab">
            <div className="property-group">
              <label>{labels.artifactId}</label>
              <div className="property-value">{selectedArtifact.id}</div>
            </div>

            <div className="property-group">
              <label>{labels.projectId}</label>
              <div className="property-value">{selectedArtifact.project_id}</div>
            </div>

            {selectedArtifact.metadata && (
              <div className="property-group">
                <label>{labels.extraMetadata}</label>
                <pre className="metadata-json">
                  {JSON.stringify(selectedArtifact.metadata, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default InspectorPanel;


