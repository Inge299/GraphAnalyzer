// frontend/src/components/views/DocumentView.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAppDispatch } from '../../store';
import { api } from '../../services/api';
import { updateArtifactSync } from '../../store/slices/artifactsSlice';
import type { ApiArtifact } from '../../types/api';
import './DocumentView.css';

interface DocumentViewProps {
  artifact: ApiArtifact;
}

const labels = {
  title: 'Документ',
  contentPlaceholder: 'Начните писать Markdown...',
  save: 'Сохранить',
  saving: 'Сохранение...',
  saved: 'Сохранено',
  edit: 'Редактор',
  preview: 'Просмотр',
  llmModel: 'Модель',
  llmRuntime: 'Режим',
  llmLatency: 'Задержка',
};

const formatLatency = (value: unknown): string => {
  const ms = Number(value);
  if (!Number.isFinite(ms) || ms <= 0) return '-';
  if (ms < 1000) return `${Math.round(ms)} мс`;
  return `${(ms / 1000).toFixed(2)} с`;
};

const normalizePreviewMarkdown = (value: string): string => {
  return value
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      if (/^\|+$/.test(trimmed)) return false;
      if (/^[-*+]$/.test(trimmed)) return false;
      return true;
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

const DocumentView: React.FC<DocumentViewProps> = ({ artifact }) => {
  const dispatch = useAppDispatch();
  const initialContent = useMemo(() => {
    if (artifact?.data && typeof artifact.data === 'object') {
      return (artifact.data as { content?: string }).content || '';
    }
    return '';
  }, [artifact]);

  const llmMeta = useMemo(() => {
    const metadata =
      artifact?.metadata && typeof artifact.metadata === 'object'
        ? artifact.metadata
        : {};
    const typedMetadata = metadata as Record<string, unknown>;

    const model = String(typedMetadata.llm_model || '').trim();
    const runtime = String(typedMetadata.llm_runtime || '').trim();
    const latency = formatLatency(typedMetadata.llm_latency_ms);

    const hasAny = Boolean(model || runtime || latency !== '-');
    return {
      hasAny,
      model: model || '-',
      runtime: runtime || '-',
      latency,
    };
  }, [artifact?.metadata]);

  const [content, setContent] = useState<string>(initialContent);
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [isSaving, setIsSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const previewContent = useMemo(
    () => normalizePreviewMarkdown(content || labels.contentPlaceholder),
    [content]
  );

  useEffect(() => {
    setContent(initialContent);
  }, [initialContent]);

  const handleSave = useCallback(async () => {
    if (!artifact?.project_id) return;
    setIsSaving(true);
    setSavedAt(null);

    try {
      const updatedData = {
        ...(artifact.data || {}),
        content,
      };

      const response = await api.put(
        `/api/v2/projects/${artifact.project_id}/artifacts/${artifact.id}`,
        { data: updatedData }
      );
      dispatch(updateArtifactSync(response.data));
      setSavedAt(new Date().toLocaleTimeString());
    } catch (error) {
      // no-op for now; could add toast later
    } finally {
      setIsSaving(false);
    }
  }, [artifact, content, dispatch]);

  return (
    <div className="document-view">
      <div className="document-header">
        <div>
          <div className="document-title">{artifact.name || labels.title}</div>
          {llmMeta.hasAny && (
            <div className="document-saved" style={{ marginTop: 4 }}>
              {labels.llmModel}: {llmMeta.model} · {labels.llmRuntime}: {llmMeta.runtime} ·{' '}
              {labels.llmLatency}: {llmMeta.latency}
            </div>
          )}
        </div>

        <div className="document-actions">
          <button
            className={`document-tab ${mode === 'edit' ? 'active' : ''}`}
            onClick={() => setMode('edit')}
          >
            {labels.edit}
          </button>
          <button
            className={`document-tab ${mode === 'preview' ? 'active' : ''}`}
            onClick={() => setMode('preview')}
          >
            {labels.preview}
          </button>
          <button className="document-save" onClick={handleSave} disabled={isSaving}>
            {isSaving ? labels.saving : labels.save}
          </button>
          {savedAt && (
            <span className="document-saved">
              {labels.saved} · {savedAt}
            </span>
          )}
        </div>
      </div>

      {mode === 'edit' ? (
        <textarea
          className="document-editor"
          value={content}
          placeholder={labels.contentPlaceholder}
          onChange={(e) => setContent(e.target.value)}
        />
      ) : (
        <div className="document-preview">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{previewContent}</ReactMarkdown>
        </div>
      )}
    </div>
  );
};

export default DocumentView;
