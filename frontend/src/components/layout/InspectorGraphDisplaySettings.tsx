import React, { useEffect, useState } from 'react';
import {
  applyGraphDisplaySettings,
  getDefaultGraphDisplaySettings,
  readStoredGraphDisplaySettings,
  type GraphDisplaySettings,
} from '../../config/graphDisplaySettings';

type InspectorGraphDisplaySettingsProps = {
  labels: {
    graphDisplaySettings: string;
    tableFontSize: string;
    nodeLabelsZoom: string;
    edgeLabelsZoom: string;
    autoLayoutDistance: string;
    resetDefaults: string;
  };
};

const formatScale = (value: number) => String(Number(value.toFixed(2)));

export const InspectorGraphDisplaySettings: React.FC<InspectorGraphDisplaySettingsProps> = ({ labels }) => {
  const [settings, setSettings] = useState<GraphDisplaySettings>(() => readStoredGraphDisplaySettings());

  useEffect(() => {
    setSettings(readStoredGraphDisplaySettings());
  }, []);

  const updateSettings = (patch: Partial<GraphDisplaySettings>) => {
    setSettings((prev) => {
      const next = applyGraphDisplaySettings({ ...prev, ...patch });
      return next;
    });
  };

  const handleReset = () => {
    const defaults = getDefaultGraphDisplaySettings();
    const next = applyGraphDisplaySettings(defaults);
    setSettings(next);
  };

  return (
    <details className="inspector-section">
      <summary>{labels.graphDisplaySettings}</summary>
      <div className="inspector-section-body">
        <div className="property-group property-row-inline">
          <label>{labels.tableFontSize}</label>
          <input
            className="property-input settings-number-input"
            type="number"
            min={10}
            max={24}
            step={1}
            value={settings.bottomTableFontSizePx}
            onChange={(event) => updateSettings({ bottomTableFontSizePx: Number(event.target.value || 13) })}
          />
        </div>

        <div className="property-group property-row-inline">
          <label>{labels.nodeLabelsZoom}</label>
          <input
            className="property-input settings-number-input"
            type="number"
            min={0.05}
            max={3}
            step={0.05}
            value={formatScale(settings.nodeLabelMinScale)}
            onChange={(event) => updateSettings({ nodeLabelMinScale: Number(event.target.value || 0.55) })}
          />
        </div>

        <div className="property-group property-row-inline">
          <label>{labels.edgeLabelsZoom}</label>
          <input
            className="property-input settings-number-input"
            type="number"
            min={0.05}
            max={3}
            step={0.05}
            value={formatScale(settings.edgeLabelMinScale)}
            onChange={(event) => updateSettings({ edgeLabelMinScale: Number(event.target.value || 0.9) })}
          />
        </div>

        <div className="property-group property-row-inline">
          <label>{labels.autoLayoutDistance}</label>
          <input
            className="property-input settings-number-input"
            type="number"
            min={80}
            max={1000}
            step={10}
            value={settings.nodeDistancePx}
            onChange={(event) => updateSettings({ nodeDistancePx: Number(event.target.value || 260) })}
          />
        </div>

        <div className="property-group">
          <div className="property-inline">
            <button type="button" className="property-action secondary" onClick={handleReset}>
              {labels.resetDefaults}
            </button>
          </div>
        </div>
      </div>
    </details>
  );
};

export default InspectorGraphDisplaySettings;
