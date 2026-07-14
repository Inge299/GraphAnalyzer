import React from 'react';
import type { ApiArtifact } from '../../types/api';
import { GraphView } from '../views/GraphView';
import DocumentView from '../views/DocumentView';
import MapView from '../views/MapView';
import TableView from '../views/TableView';
import ChartView from '../views/ChartView';
import ConsoleView from '../views/ConsoleView';

type ArtifactContentViewProps = {
  activeArtifact: ApiArtifact | null;
  labels: Record<string, string>;
  graphViewProps: Omit<React.ComponentProps<typeof GraphView>, 'artifact'>;
};

export const ArtifactContentView: React.FC<ArtifactContentViewProps> = ({
  activeArtifact,
  labels,
  graphViewProps,
}) => {
  if (!activeArtifact) {
    return (
      <div className="no-selection">
        <h2>{labels.noSelectionTitle}</h2>
        <p>{labels.noSelectionHint}</p>
      </div>
    );
  }

  if (activeArtifact.type === 'graph') {
    return <GraphView artifact={activeArtifact} {...graphViewProps} />;
  }

  if (activeArtifact.type === 'document') {
    return <DocumentView artifact={activeArtifact} />;
  }

  if (activeArtifact.type === 'map') {
    return <MapView artifact={activeArtifact} _onUpdate={() => {}} />;
  }

  if (activeArtifact.type === 'table') {
    return <TableView artifact={activeArtifact} _onUpdate={() => {}} />;
  }

  if (activeArtifact.type === 'chart') {
    return <ChartView artifact={activeArtifact} _onUpdate={() => {}} />;
  }

  if (activeArtifact.type === 'console') {
    return <ConsoleView artifact={activeArtifact} />;
  }

  return <DocumentView artifact={activeArtifact} />;
};

export default ArtifactContentView;
