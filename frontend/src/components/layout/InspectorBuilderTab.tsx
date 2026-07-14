import React from 'react';
import type { DomainEdgeTypeOption, DomainNodeTypeOption } from './inspectorPanelUtils';

type GraphNodeOption = {
  value: string;
  label: string;
};

type EdgeTypeSelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: DomainEdgeTypeOption[];
  placeholder: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
};

type InspectorBuilderTabProps = {
  labels: Record<string, string>;
  builderNodeLabel: string;
  setBuilderNodeLabel: (value: string) => void;
  builderNodeType: string;
  setBuilderNodeType: (value: string) => void;
  nodeTypeDefinitions: DomainNodeTypeOption[];
  builderSaving: boolean;
  handleCreateNode: () => void;
  builderEdgeType: string;
  setBuilderEdgeType: (value: string) => void;
  edgeTypeDefinitions: DomainEdgeTypeOption[];
  handleCreateEdge: () => void;
  graphNodeOptions: GraphNodeOption[];
  nodeCreationSpec?: { typeId: string; label: string } | null;
  edgeCreationType?: string | null;
  EdgeTypeSelectComponent: React.ComponentType<EdgeTypeSelectProps>;
};

export const InspectorBuilderTab: React.FC<InspectorBuilderTabProps> = ({
  labels,
  builderNodeLabel,
  setBuilderNodeLabel,
  builderNodeType,
  setBuilderNodeType,
  nodeTypeDefinitions,
  builderSaving,
  handleCreateNode,
  builderEdgeType,
  setBuilderEdgeType,
  edgeTypeDefinitions,
  handleCreateEdge,
  graphNodeOptions,
  nodeCreationSpec = null,
  edgeCreationType = null,
  EdgeTypeSelectComponent,
}) => {
  return (
    <div className="properties-tab elements-tab builder-tab">
      <div className="property-group">
        <label>{labels.nodeLabel}</label>
        <input
          className="property-input"
          value={builderNodeLabel}
          onChange={(e) => setBuilderNodeLabel(e.target.value)}
          placeholder="New entity"
        />
      </div>
      <div className="property-group">
        <label>{labels.nodeType}</label>
        <select className="property-input" value={builderNodeType} onChange={(e) => setBuilderNodeType(e.target.value)}>
          {nodeTypeDefinitions.map((item) => (
            <option key={item.id} value={item.id}>{item.label}</option>
          ))}
        </select>
      </div>
      <div className="property-group">
        <button className="property-action" onClick={handleCreateNode} disabled={builderSaving || !builderNodeLabel.trim()}>
          {builderSaving ? labels.loading : labels.createNode}
        </button>
      </div>

      <div className="property-group">
        <label>{labels.edgeType}</label>
        <EdgeTypeSelectComponent
          value={builderEdgeType}
          onChange={setBuilderEdgeType}
          options={edgeTypeDefinitions}
          placeholder={labels.edgeType}
        />
      </div>
      <div className="property-group">
        <button className="property-action" onClick={handleCreateEdge} disabled={builderSaving || graphNodeOptions.length < 2 || !builderEdgeType}>
          {builderSaving ? labels.loading : labels.createEdgeOnGraph}
        </button>
      </div>

      {nodeCreationSpec && (
        <div className="property-value">{labels.nodeCreationActive}</div>
      )}
      {edgeCreationType && (
        <div className="property-value">{labels.edgeCreationActive}</div>
      )}
      {graphNodeOptions.length < 2 && (
        <div className="property-value">{labels.chooseNodeFirst}</div>
      )}
    </div>
  );
};

export default InspectorBuilderTab;
