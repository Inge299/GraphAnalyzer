import type { ApiArtifact } from '../types/api';
import type { SelectedElement } from '../store/slices/uiSlice';

export interface GraphPanelNode {
  id?: string | number;
  node_id?: string | number;
  type?: string;
  label?: string;
  attributes?: Record<string, unknown>;
}

export interface GraphPanelEdge {
  id?: string | number;
  from?: string | number;
  to?: string | number;
  source_node?: string | number;
  target_node?: string | number;
  type?: string;
  label?: string;
  attributes?: Record<string, unknown>;
}

export type GraphPanelArtifact = ApiArtifact | null | undefined;

export const getGraphNodeId = (node: GraphPanelNode): string =>
  String(node?.id ?? node?.node_id ?? '');

export const getGraphEdgeId = (edge: GraphPanelEdge): string =>
  String(edge?.id ?? '');

export const isNodeSelectedElement = (item: SelectedElement): boolean =>
  item?.type === 'node';

export const isEdgeSelectedElement = (item: SelectedElement): boolean =>
  item?.type === 'edge';
