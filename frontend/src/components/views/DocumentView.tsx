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
  title: '\u0414\u043e\u043a\u0443\u043c\u0435\u043d\u0442',
  contentPlaceholder: '\u041d\u0430\u0447\u043d\u0438\u0442\u0435 \u043f\u0438\u0441\u0430\u0442\u044c Markdown...',
  save: '\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c',
  saving: '\u0421\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u0438\u0435...',
  saved: '\u0421\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u043e',
  edit: '\u0420\u0435\u0434\u0430\u043a\u0442\u043e\u0440',
  preview: '\u041f\u0440\u043e\u0441\u043c\u043e\u0442\u0440'
};

const DocumentView: React.FC<DocumentViewProps> = ({ artifact }) => {
  const dispatch = useAppDispatch();
  const initialContent = useMemo(() => {
    if (artifact?.data && typeof artifact.data === 'object') {
      return (artifact.data as any).content || '';
    }
    return '';
  }, [artifact]);

  const [content, setContent] = useState<string>(initialContent);
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [isSaving, setIsSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

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
        content
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
        <div className="document-title">{artifact.name || labels.title}</div>
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
          {savedAt && <span className="document-saved">{labels.saved} · {savedAt}</span>}
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
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {content || labels.contentPlaceholder}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
};

export default DocumentView;
