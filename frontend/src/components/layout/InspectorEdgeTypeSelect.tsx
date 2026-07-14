import React, { useEffect, useRef, useState } from 'react';
import { getEdgeTypeColor, type DomainEdgeTypeOption } from './inspectorPanelUtils';

export type InspectorEdgeTypeSelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: DomainEdgeTypeOption[];
  placeholder: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
};

export const InspectorEdgeTypeSelect: React.FC<InspectorEdgeTypeSelectProps> = ({
  value,
  onChange,
  options,
  placeholder,
  allowEmpty = false,
  emptyLabel = 'Без изменений',
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const selected = options.find((item) => item.id === value) || null;

  useEffect(() => {
    const onDocumentClick = (event: MouseEvent) => {
      if (!containerRef.current) return;
      if (event.target instanceof Node && containerRef.current.contains(event.target)) return;
      setOpen(false);
    };

    document.addEventListener('mousedown', onDocumentClick);
    return () => document.removeEventListener('mousedown', onDocumentClick);
  }, []);

  const handleChoose = (next: string) => {
    onChange(next);
    setOpen(false);
  };

  return (
    <div className="edge-type-select" ref={containerRef}>
      <button
        type="button"
        className="edge-type-select-trigger"
        onClick={() => setOpen((prev) => !prev)}
      >
        {selected ? (
          <>
            <span className="edge-type-select-line" style={{ ['--edge-color' as any]: getEdgeTypeColor(selected) }} />
            <span className="edge-type-select-label">{selected.label}</span>
          </>
        ) : (
          <span className="edge-type-select-label edge-type-select-placeholder">{placeholder}</span>
        )}
        <span className="edge-type-select-caret">v</span>
      </button>

      {open && (
        <div className="edge-type-select-menu">
          {allowEmpty && (
            <button type="button" className="edge-type-select-item" onClick={() => handleChoose('')}>
              <span className="edge-type-select-label edge-type-select-placeholder">{emptyLabel}</span>
            </button>
          )}
          {options.map((item) => (
            <button
              key={item.id}
              type="button"
              className={'edge-type-select-item ' + (item.id === value ? 'active' : '')}
              onClick={() => handleChoose(item.id)}
            >
              <span className="edge-type-select-line" style={{ ['--edge-color' as any]: getEdgeTypeColor(item) }} />
              <span className="edge-type-select-label">{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default InspectorEdgeTypeSelect;
