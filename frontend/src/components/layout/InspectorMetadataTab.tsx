import React from 'react';
import type { ApiArtifact } from '../../types/api';

type InspectorMetadataTabProps = {
  artifact: ApiArtifact;
  labels: Record<string, string>;
  hasLlmMeta: boolean;
  llmModel: string;
  llmRuntime: string;
  llmLatency: string;
  sourcePlugin: unknown;
  derivedFrom: unknown;
  metadataRest: Record<string, unknown>;
};

export const InspectorMetadataTab: React.FC<InspectorMetadataTabProps> = ({
  artifact,
  labels,
  hasLlmMeta,
  llmModel,
  llmRuntime,
  llmLatency,
  sourcePlugin,
  derivedFrom,
  metadataRest,
}) => {
  const artifactTypeLabel =
    artifact.type === 'graph' ? labels.typeGraph :
    artifact.type === 'table' ? labels.typeTable :
    artifact.type === 'map' ? labels.typeMap :
    artifact.type === 'chart' ? labels.typeChart :
    artifact.type === 'console' ? labels.typeConsole :
    labels.typeDocument;

  return (
    <div className="metadata-tab">
      <div className="property-group">
        <label>{labels.type}</label>
        <div className="property-value type-badge">{artifactTypeLabel}</div>
      </div>

      {artifact.description && (
        <div className="property-group">
          <label>{labels.description}</label>
          <div className="property-value">{artifact.description}</div>
        </div>
      )}

      <div className="property-group">
        <label>{labels.version}</label>
        <div className="property-value">v{artifact.version || 1}</div>
      </div>

      {hasLlmMeta && (
        <div className="property-group">
          <label>{labels.llmSection}</label>
          <div className="property-value">
            {labels.llmModel}: {llmModel || '-'}
            <br />
            {labels.llmRuntime}: {llmRuntime || '-'}
            <br />
            {labels.llmLatency}: {llmLatency || '-'}
          </div>
        </div>
      )}

      {Boolean(sourcePlugin) && (
        <div className="property-group">
          <label>source_plugin</label>
          <div className="property-value">{String(sourcePlugin)}</div>
        </div>
      )}

      {derivedFrom !== undefined && derivedFrom !== null && (
        <div className="property-group">
          <label>derived_from</label>
          <div className="property-value">{String(derivedFrom)}</div>
        </div>
      )}

      <div className="property-group">
        <label>{labels.artifactId}</label>
        <div className="property-value">{artifact.id}</div>
      </div>

      <div className="property-group">
        <label>{labels.projectId}</label>
        <div className="property-value">{artifact.project_id}</div>
      </div>

      {Object.keys(metadataRest).length > 0 && (
        <div className="property-group">
          <label>{labels.extraMetadata}</label>
          <pre className="metadata-json">
            {JSON.stringify(metadataRest, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default InspectorMetadataTab;
