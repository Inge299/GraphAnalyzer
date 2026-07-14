import React from 'react';
import type { DomainEdgeTypeOption, EdgeExtraAttributeState, GraphSelectionState, NodeExtraAttributeState } from './inspectorPanelUtils';

type IconOption = {
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

type InspectorElementsTabProps = {
  labels: Record<string, string>;
  graphSelection: GraphSelectionState | null;
  elementLabel: string;
  setElementLabel: (value: string) => void;
  elementColor: string;
  setElementColor: (value: string) => void;
  elementIcon: string;
  setElementIcon: (value: string) => void;
  iconOptions: IconOption[];
  iconScaleOptions: string[];
  elementIconScale: string;
  setElementIconScale: (value: string) => void;
  elementRingMode: 'unchanged' | 'on' | 'off';
  setElementRingMode: (value: 'unchanged' | 'on' | 'off') => void;
  elementRingWidth: string;
  setElementRingWidth: (value: string) => void;
  nodeExtraAttributes: NodeExtraAttributeState[];
  setNodeExtraAttributes: React.Dispatch<React.SetStateAction<NodeExtraAttributeState[]>>;
  elementEdgeType: string;
  setElementEdgeType: (value: string) => void;
  edgeTypeDefinitions: DomainEdgeTypeOption[];
  elementEdgeWidth: string;
  setElementEdgeWidth: (value: string) => void;
  edgeDirectionOptions: string[];
  elementEdgeDirection: string;
  setElementEdgeDirection: (value: string) => void;
  elementEdgeStyle: 'unchanged' | 'solid' | 'dashed';
  setElementEdgeStyle: (value: 'unchanged' | 'solid' | 'dashed') => void;
  edgeExtraAttributes: EdgeExtraAttributeState[];
  setEdgeExtraAttributes: React.Dispatch<React.SetStateAction<EdgeExtraAttributeState[]>>;
  nodeColorPalette: string[];
  applyElementEdits: () => void;
  elementsSaving: boolean;
  EdgeTypeSelectComponent: React.ComponentType<EdgeTypeSelectProps>;
};

export const InspectorElementsTab: React.FC<InspectorElementsTabProps> = ({
  labels,
  graphSelection,
  elementLabel,
  setElementLabel,
  elementColor,
  setElementColor,
  elementIcon,
  setElementIcon,
  iconOptions,
  iconScaleOptions,
  elementIconScale,
  setElementIconScale,
  elementRingMode,
  setElementRingMode,
  elementRingWidth,
  setElementRingWidth,
  nodeExtraAttributes,
  setNodeExtraAttributes,
  elementEdgeType,
  setElementEdgeType,
  edgeTypeDefinitions,
  elementEdgeWidth,
  setElementEdgeWidth,
  edgeDirectionOptions,
  elementEdgeDirection,
  setElementEdgeDirection,
  elementEdgeStyle,
  setElementEdgeStyle,
  edgeExtraAttributes,
  setEdgeExtraAttributes,
  nodeColorPalette,
  applyElementEdits,
  elementsSaving,
  EdgeTypeSelectComponent,
}) => {
  return (
    <div className="properties-tab elements-tab">
      {!graphSelection || graphSelection.mode === 'none' ? (
        <div className="property-value">{labels.noSelection}</div>
      ) : graphSelection.mode === 'mixed' ? (
        <div className="property-value">{labels.mixedSelection}</div>
      ) : (
        <>
          <div className="property-group">
            <label>{labels.selectedCount}</label>
            <div className="property-value">{graphSelection.total}</div>
          </div>

          <div className="property-group">
            <label>{labels.elementLabel}</label>
            <input className="property-input" value={elementLabel} onChange={(e) => setElementLabel(e.target.value)} />
          </div>

          {graphSelection.mode === 'nodes' && (
            <>
              <div className="property-group">
                <label>{labels.elementColor}</label>
                <div className="property-inline">
                  <input
                    className="property-input"
                    type="color"
                    value={/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(elementColor) ? elementColor : '#3b82f6'}
                    onChange={(e) => setElementColor(e.target.value)}
                    style={{ width: 36, minWidth: 36, height: 30, padding: 2, borderRadius: 6 }}
                  />
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {nodeColorPalette.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setElementColor(color)}
                        style={{ width: 18, height: 18, borderRadius: 4, border: '1px solid #475569', background: color, cursor: 'pointer' }}
                        title={color}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <div className="property-group">
                <label>{labels.elementIcon}</label>
                <select className="property-input" value={elementIcon} onChange={(e) => setElementIcon(e.target.value)}>
                  <option value="">{labels.unchanged}</option>
                  {iconOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div className="property-group">
                <label>{labels.iconScale}</label>
                <select className="property-input" value={elementIconScale} onChange={(e) => setElementIconScale(e.target.value)}>
                  <option value="">{labels.unchanged}</option>
                  {iconScaleOptions.map((size) => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
              </div>
              <div className="property-group">
                <label>{labels.ringEnabled}</label>
                <select className="property-input" value={elementRingMode} onChange={(e) => setElementRingMode(e.target.value as 'unchanged' | 'on' | 'off')}>
                  <option value="unchanged">{labels.unchanged}</option>
                  <option value="on">{labels.on}</option>
                  <option value="off">{labels.off}</option>
                </select>
              </div>
              <div className="property-group">
                <label>{labels.ringWidth}</label>
                <input className="property-input" value={elementRingWidth} onChange={(e) => setElementRingWidth(e.target.value)} placeholder="2" />
              </div>

              {nodeExtraAttributes.length > 0 && (
                <div className="node-attributes-editor">
                  {nodeExtraAttributes.map((field) => (
                    <div key={field.key} className="node-attribute-row">
                      <label className="node-attribute-title">
                        <input
                          type="checkbox"
                          checked={field.visibleOnGraph === 'on'}
                          ref={(el) => {
                            if (el) el.indeterminate = field.visibleOnGraph === 'mixed';
                          }}
                          onChange={(event) => {
                            const visibleOnGraph = event.target.checked ? 'on' : 'off';
                            setNodeExtraAttributes((prev) => prev.map((item) => item.key === field.key ? { ...item, visibleOnGraph } : item));
                          }}
                        />
                        <span>{field.label}</span>
                      </label>
                      <textarea
                        className="property-input node-attribute-value"
                        value={field.value}
                        placeholder={field.mixed ? labels.unchanged : ''}
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          setNodeExtraAttributes((prev) => prev.map((item) => item.key === field.key ? { ...item, value: nextValue, mixed: false } : item));
                        }}
                        rows={Math.max(2, Math.min(6, String(field.value || '').split(/\r?\n/).length || 2))}
                      />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {graphSelection.mode === 'edges' && (
            <>
              <div className="property-group">
                <label>{labels.edgeType}</label>
                <EdgeTypeSelectComponent
                  value={elementEdgeType}
                  onChange={setElementEdgeType}
                  options={edgeTypeDefinitions}
                  placeholder={labels.unchanged}
                  allowEmpty={true}
                  emptyLabel={labels.unchanged}
                />
              </div>
              <div className="property-group">
                <label>{labels.edgeWidth}</label>
                <input className="property-input" value={elementEdgeWidth} onChange={(e) => setElementEdgeWidth(e.target.value)} placeholder="2" />
              </div>
              <div className="property-group">
                <label>{labels.edgeDirection}</label>
                <select className="property-input" value={elementEdgeDirection} onChange={(e) => setElementEdgeDirection(e.target.value)}>
                  <option value="">{labels.unchanged}</option>
                  {edgeDirectionOptions.map((direction) => (
                    <option key={direction} value={direction}>
                      {direction === 'from' ? '<-' : direction === 'to' ? '->' : '<->'}
                    </option>
                  ))}
                </select>
              </div>
              <div className="property-group">
                <label>{labels.edgeStyle}</label>
                <select className="property-input" value={elementEdgeStyle} onChange={(e) => setElementEdgeStyle(e.target.value as 'unchanged' | 'solid' | 'dashed')}>
                  <option value="unchanged">{labels.unchanged}</option>
                  <option value="solid">{labels.solid}</option>
                  <option value="dashed">{labels.dashed}</option>
                </select>
              </div>

              {edgeExtraAttributes.length > 0 && (
                <div className="node-attributes-editor">
                  {edgeExtraAttributes.map((field) => (
                    <div key={field.key} className="node-attribute-row">
                      <label className="node-attribute-title">
                        <input
                          type="checkbox"
                          checked={field.visibleOnGraph === 'on'}
                          ref={(el) => {
                            if (el) el.indeterminate = field.visibleOnGraph === 'mixed';
                          }}
                          onChange={(event) => {
                            const visibleOnGraph = event.target.checked ? 'on' : 'off';
                            setEdgeExtraAttributes((prev) => prev.map((item) => item.key === field.key ? { ...item, visibleOnGraph } : item));
                          }}
                        />
                        <span>{field.label}</span>
                      </label>
                      <textarea
                        className="property-input node-attribute-value"
                        value={field.value}
                        placeholder={field.mixed ? labels.unchanged : ''}
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          setEdgeExtraAttributes((prev) => prev.map((item) => item.key === field.key ? { ...item, value: nextValue, mixed: false } : item));
                        }}
                        rows={Math.max(2, Math.min(6, String(field.value || '').split(/\r?\n/).length || 2))}
                      />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          <div className="property-group apply-group">
            <button className="property-action" onClick={applyElementEdits} disabled={elementsSaving}>
              {elementsSaving ? labels.loading : labels.apply}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default InspectorElementsTab;
