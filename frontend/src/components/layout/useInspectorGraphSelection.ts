import { useMemo } from 'react';
import type { ApiArtifact } from '../../types/api';
import type { SelectedElement } from '../../store/slices/uiSlice';
import { nodeAttributePreviewConfig } from '../../config/nodeAttributePreview';
import {
  attributeLabelAliases,
  attributeTypePriority,
  EDGE_SYSTEM_ATTRIBUTE_KEYS,
  edgeAttributeLabelAliases,
  type EdgeExtraAttributeState,
  type GraphSelectedElement,
  type GraphSelectionState,
  getCommonValue,
  NODE_SYSTEM_ATTRIBUTE_KEYS,
  type NodeExtraAttributeState,
  normalizeAttributeValue,
  normalizeDisplayLabel,
  type DomainNodeAttributeOption,
} from './inspectorPanelUtils';

export type InspectorSelectionDraft = {
  elementLabel: string;
  elementColor: string;
  elementIcon: string;
  elementIconScale: string;
  elementRingMode: 'unchanged' | 'on' | 'off';
  elementRingWidth: string;
  elementEdgeWidth: string;
  elementEdgeDirection: string;
  elementEdgeStyle: 'unchanged' | 'solid' | 'dashed';
  elementEdgeType: string;
  nodeExtraAttributes: NodeExtraAttributeState[];
  edgeExtraAttributes: EdgeExtraAttributeState[];
};

const EMPTY_SELECTION_DRAFT: InspectorSelectionDraft = {
  elementLabel: '',
  elementColor: '',
  elementIcon: '',
  elementIconScale: '',
  elementRingMode: 'unchanged',
  elementRingWidth: '',
  elementEdgeWidth: '',
  elementEdgeDirection: '',
  elementEdgeStyle: 'unchanged',
  elementEdgeType: '',
  nodeExtraAttributes: [],
  edgeExtraAttributes: [],
};

type UseInspectorGraphSelectionArgs = {
  selectedArtifact: ApiArtifact | null | undefined;
  selectedElements: SelectedElement[];
  getNodeTypeDefaultVisual: (nodeData: any) => Record<string, any>;
  getNodeTypeAttributeDefinitions: (nodeData: any) => DomainNodeAttributeOption[];
};

export const useInspectorGraphSelection = ({
  selectedArtifact,
  selectedElements,
  getNodeTypeDefaultVisual,
  getNodeTypeAttributeDefinitions,
}: UseInspectorGraphSelectionArgs) => {
  const graphSelection = useMemo<GraphSelectionState | null>(() => {
    if (!selectedArtifact || selectedArtifact.type !== 'graph') return null;

    const data = selectedArtifact.data || { nodes: [], edges: [] };
    const nodeById = new Map((data.nodes || []).map((node: any) => [String(node.id ?? node.node_id ?? node.uuid ?? node.key), node]));
    const edgeById = new Map((data.edges || []).map((edge: any) => [String(edge.id), edge]));

    const nodes = selectedElements
      .filter((item): item is SelectedElement => item.type === 'node')
      .map((item) => ({ ...item, data: nodeById.get(String(item.id)) ?? item.data }))
      .filter((item): item is GraphSelectedElement => Boolean(item.data));

    const edges = selectedElements
      .filter((item): item is SelectedElement => item.type === 'edge')
      .map((item) => ({ ...item, data: edgeById.get(String(item.id)) ?? item.data }))
      .filter((item): item is GraphSelectedElement => Boolean(item.data));

    const mode: GraphSelectionState['mode'] =
      nodes.length > 0 && edges.length > 0 ? 'mixed' : nodes.length > 0 ? 'nodes' : edges.length > 0 ? 'edges' : 'none';
    return { nodes, edges, mode, total: nodes.length + edges.length };
  }, [selectedArtifact, selectedElements]);

  const selectionDraft = useMemo<InspectorSelectionDraft>(() => {
    if (!graphSelection || graphSelection.mode === 'none' || graphSelection.mode === 'mixed') {
      return EMPTY_SELECTION_DRAFT;
    }

    if (graphSelection.mode === 'nodes') {
      const label = getCommonValue(graphSelection.nodes, (item) => item.data?.label || item.data?.attributes?.visual?.label || item.data?.attributes?.label);
      const color = getCommonValue(graphSelection.nodes, (item) => item.data?.attributes?.visual?.color || item.data?.attributes?.color);
      const icon = getCommonValue(graphSelection.nodes, (item) => item.data?.attributes?.visual?.icon || item.data?.attributes?.icon);
      const scale = getCommonValue(graphSelection.nodes, (item) => {
        const fallback = getNodeTypeDefaultVisual(item.data);
        return item.data?.attributes?.visual?.iconScale ?? item.data?.attributes?.iconScale ?? fallback.iconScale ?? 2;
      });
      const ringEnabled = getCommonValue(graphSelection.nodes, (item) => {
        const fallback = getNodeTypeDefaultVisual(item.data);
        return item.data?.attributes?.visual?.ringEnabled ?? item.data?.attributes?.ringEnabled ?? fallback.ringEnabled ?? true;
      });
      const ringWidth = getCommonValue(graphSelection.nodes, (item) => {
        const fallback = getNodeTypeDefaultVisual(item.data);
        return item.data?.attributes?.visual?.ringWidth ?? item.data?.attributes?.ringWidth ?? fallback.ringWidth ?? 2;
      });

      const knownAttributeMap = new Map<string, DomainNodeAttributeOption>();
      graphSelection.nodes.forEach((nodeItem) => {
        getNodeTypeAttributeDefinitions(nodeItem.data).forEach((attribute) => {
          if (!knownAttributeMap.has(attribute.key)) {
            knownAttributeMap.set(attribute.key, attribute);
          }
        });
      });

      const keySet = new Set<string>();
      graphSelection.nodes.forEach((nodeItem) => {
        const nodeAttributes = (nodeItem.data?.attributes || {}) as Record<string, any>;
        Object.keys(nodeAttributes).forEach((key) => {
          if (!NODE_SYSTEM_ATTRIBUTE_KEYS.has(key)) keySet.add(key);
        });
      });
      knownAttributeMap.forEach((_, key) => keySet.add(key));

      const fields: NodeExtraAttributeState[] = Array.from(keySet).map((key) => {
        const descriptor = knownAttributeMap.get(key);
        const rawValues = graphSelection.nodes.map((nodeItem) => {
          const nodeAttributes = (nodeItem.data?.attributes || {}) as Record<string, any>;
          return normalizeAttributeValue(nodeAttributes[key]);
        });
        const firstValue = rawValues[0] || '';
        const mixedValue = rawValues.some((value) => value !== firstValue);

        const visibleValues = graphSelection.nodes.map((nodeItem) => {
          const visibleAttributes = nodeItem.data?.attributes?.visual?.visibleAttributes;
          if (Array.isArray(visibleAttributes)) return visibleAttributes.includes(key);
          const previewField = (nodeAttributePreviewConfig as any)?.fields?.[key];
          if (typeof previewField?.visibleOnGraph === 'boolean') {
            return Boolean(previewField.visibleOnGraph);
          }
          return false;
        });
        const firstVisible = visibleValues[0];
        const mixedVisible = visibleValues.some((value) => value !== firstVisible);

        return {
          key,
          label: normalizeDisplayLabel(String(descriptor?.label || ''), attributeLabelAliases[key] || key),
          type: String(descriptor?.type || 'string').toLowerCase(),
          value: mixedValue ? '' : firstValue,
          mixed: mixedValue,
          visibleOnGraph: mixedVisible ? 'mixed' : firstVisible ? 'on' : 'off',
        };
      });

      fields.sort((left, right) => {
        const typePriorityLeft = attributeTypePriority[left.type] ?? 99;
        const typePriorityRight = attributeTypePriority[right.type] ?? 99;
        if (typePriorityLeft !== typePriorityRight) return typePriorityLeft - typePriorityRight;
        return left.label.localeCompare(right.label, 'ru');
      });

      const fieldsForPanel =
        graphSelection.nodes.length === 1
          ? fields.filter((field) => field.mixed || field.visibleOnGraph !== 'off' || String(field.value || '').trim().length > 0)
          : fields;

      return {
        elementLabel: label === undefined ? '' : String(label),
        elementColor: color === undefined ? '' : String(color),
        elementIcon: icon === undefined ? '' : String(icon),
        elementIconScale: scale === undefined ? '' : String(scale),
        elementRingMode: ringEnabled === undefined ? 'unchanged' : ringEnabled ? 'on' : 'off',
        elementRingWidth: ringWidth === undefined ? '' : String(ringWidth),
        elementEdgeWidth: '',
        elementEdgeDirection: '',
        elementEdgeStyle: 'unchanged',
        elementEdgeType: '',
        nodeExtraAttributes: fieldsForPanel,
        edgeExtraAttributes: [],
      };
    }

    const label = getCommonValue(graphSelection.edges, (item) => item.data?.label || item.data?.attributes?.visual?.label || item.data?.attributes?.label);
    const color = getCommonValue(graphSelection.edges, (item) => item.data?.attributes?.visual?.color || item.data?.attributes?.color);
    const width = getCommonValue(graphSelection.edges, (item) => item.data?.attributes?.visual?.width ?? item.data?.attributes?.width);
    const direction = getCommonValue(graphSelection.edges, (item) => item.data?.attributes?.visual?.direction || item.data?.attributes?.direction);
    const dashed = getCommonValue(graphSelection.edges, (item) => item.data?.attributes?.visual?.dashed ?? item.data?.attributes?.dashed);
    const edgeType = getCommonValue(graphSelection.edges, (item) => item.data?.type);

    const edgeKeySet = new Set<string>();
    graphSelection.edges.forEach((edgeItem) => {
      const edgeAttributes = (edgeItem.data?.attributes || {}) as Record<string, any>;
      Object.keys(edgeAttributes).forEach((key) => {
        if (!EDGE_SYSTEM_ATTRIBUTE_KEYS.has(key)) edgeKeySet.add(key);
      });
    });

    const edgeFields: EdgeExtraAttributeState[] = Array.from(edgeKeySet).map((key) => {
      const rawValues = graphSelection.edges.map((edgeItem) => {
        const edgeAttributes = (edgeItem.data?.attributes || {}) as Record<string, any>;
        return normalizeAttributeValue(edgeAttributes[key]);
      });
      const firstValue = rawValues[0] || '';
      const mixedValue = rawValues.some((value) => value !== firstValue);
      const fallbackLabel = edgeAttributeLabelAliases[key] || key;
      const sampleValue = ((graphSelection.edges[0]?.data?.attributes || {}) as Record<string, any>)[key];
      const inferredType = typeof sampleValue === 'number' ? 'number' : 'string';

      const visibleValues = graphSelection.edges.map((edgeItem) => {
        const visibleAttributes = edgeItem.data?.attributes?.visual?.visibleAttributes;
        if (Array.isArray(visibleAttributes)) return visibleAttributes.includes(key);
        return true;
      });
      const firstVisible = visibleValues[0];
      const mixedVisible = visibleValues.some((value) => value !== firstVisible);

      return {
        key,
        label: normalizeDisplayLabel(fallbackLabel, fallbackLabel),
        type: inferredType,
        value: mixedValue ? '' : firstValue,
        mixed: mixedValue,
        visibleOnGraph: mixedVisible ? 'mixed' : firstVisible ? 'on' : 'off',
      };
    });

    const visibleEdgeFields = edgeFields.filter((field) => !['period_start', 'period_end', 'calls_count'].includes(field.key));
    visibleEdgeFields.sort((left, right) => left.label.localeCompare(right.label, 'ru'));

    return {
      elementLabel: label === undefined ? '' : String(label),
      elementColor: color === undefined ? '' : String(color),
      elementIcon: '',
      elementIconScale: '',
      elementRingMode: 'unchanged',
      elementRingWidth: '',
      elementEdgeWidth: width === undefined ? '' : String(width),
      elementEdgeDirection: direction === undefined ? '' : String(direction),
      elementEdgeStyle: dashed === undefined ? 'unchanged' : dashed ? 'dashed' : 'solid',
      elementEdgeType: edgeType === undefined ? '' : String(edgeType),
      nodeExtraAttributes: [],
      edgeExtraAttributes: visibleEdgeFields,
    };
  }, [graphSelection, getNodeTypeAttributeDefinitions, getNodeTypeDefaultVisual]);

  return { graphSelection, selectionDraft };
};
