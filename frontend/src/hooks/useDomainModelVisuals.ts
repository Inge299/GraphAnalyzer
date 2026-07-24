import { useEffect, useState } from 'react';
import { domainModelApi } from '../services/api';
import type { DomainModelConfig } from '../types/api';

type EdgeTypeVisual = { color: string; width: number; direction: string; dashed: boolean; label: string };
type NodeTypeVisual = { icon: string; color: string; iconScale: number; ringEnabled: boolean; ringWidth: number; label: string };

export const useDomainModelVisuals = () => {
  const [edgeTypeVisuals, setEdgeTypeVisuals] = useState<Record<string, EdgeTypeVisual>>({});
  const [nodeTypeVisuals, setNodeTypeVisuals] = useState<Record<string, NodeTypeVisual>>({});

  useEffect(() => {
    let cancelled = false;

    const loadDomainModel = async () => {
      try {
        const model = await domainModelApi.get() as DomainModelConfig;
        if (cancelled) return;

        const edgeMap: Record<string, EdgeTypeVisual> = {};
        (model?.edge_types || []).forEach((edge: any) => {
          const id = String(edge?.id || '').trim();
          if (!id) return;
          const visual = edge?.default_visual || {};
          edgeMap[id] = {
            color: String(visual.color || '#475569'),
            width: Number(visual.width ?? 2),
            direction: String(visual.direction || 'to'),
            dashed: Boolean(visual.dashed ?? false),
            label: String(edge?.label || id)
          };
        });

        const nodeMap: Record<string, NodeTypeVisual> = {};
        (model?.node_types || []).forEach((node: any) => {
          const id = String(node?.id || '').trim();
          if (!id) return;
          const visual = node?.default_visual || {};
          nodeMap[id] = {
            icon: String(node?.icon || id || ''),
            color: String(visual.color || '#3b82f6'),
            iconScale: Number(visual.iconScale ?? 2),
            ringEnabled: Boolean(visual.ringEnabled ?? true),
            ringWidth: Number(visual.ringWidth ?? 2),
            label: String(node?.label || id)
          };
        });

        setEdgeTypeVisuals(edgeMap);
        setNodeTypeVisuals(nodeMap);
      } catch {
        if (cancelled) return;
        setEdgeTypeVisuals({});
        setNodeTypeVisuals({});
      }
    };

    loadDomainModel();
    return () => { cancelled = true; };
  }, []);

  return { edgeTypeVisuals, nodeTypeVisuals };
};

export default useDomainModelVisuals;
