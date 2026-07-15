import type {
  CSSProperties,
  Dispatch,
  MouseEvent,
  MutableRefObject,
  ReactNode,
  SetStateAction,
} from 'react';
import type { BottomTab } from '../../hooks/useGraphBottomPanelState';
import type { GraphPanelEdge, GraphPanelNode } from '../../hooks/graphTableTypes';
import type { ConsoleProcedureColumn } from '../../types/api';

export type GraphSortDirection = 'asc' | 'desc';

export type SortIndicatorRenderer = (
  active: boolean,
  dir: GraphSortDirection
) => ReactNode;

export type GraphTableRowRefs = MutableRefObject<Record<string, HTMLTableRowElement | null>>;

export interface AppGraphNodesTableProps {
  toggleNodeSort: (key: string) => void;
  renderSortIndicator: SortIndicatorRenderer;
  nodeSortKey: string;
  nodeSortDir: GraphSortDirection;
  nodeAttributeColumns: string[];
  formatAttributeHeader: (key: string) => string;
  visibleGraphNodesForPanel: GraphPanelNode[];
  selectedNodeIds: Set<string>;
  handleNodeRowClick: (
    event: MouseEvent<HTMLTableRowElement>,
    node: GraphPanelNode,
    rowIndex: number
  ) => void;
  nodeRowRefs: GraphTableRowRefs;
  emptyMessage?: string;
}

export interface AppGraphEdgesTableProps {
  toggleEdgeSort: (key: string) => void;
  renderSortIndicator: SortIndicatorRenderer;
  edgeSortKey: string;
  edgeSortDir: GraphSortDirection;
  edgeAttributeColumns: string[];
  formatAttributeHeader: (key: string) => string;
  visibleGraphEdgesForPanel: GraphPanelEdge[];
  selectedEdgeIds: Set<string>;
  handleEdgeRowClick: (
    event: MouseEvent<HTMLTableRowElement>,
    edge: GraphPanelEdge,
    rowIndex: number
  ) => void;
  edgeRowRefs: GraphTableRowRefs;
  getNormalizedEdgeAttributes: (edge: GraphPanelEdge) => Record<string, unknown>;
  nodeLabelById: Record<string, string>;
  emptyMessage?: string;
}

export interface AppGraphBottomPanelProps {
  projectId: number;
  artifactTitle: string;
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
  bottomPanelStyle: CSSProperties;
  onResizerMouseDown: (event: MouseEvent<HTMLDivElement>) => void;
  bottomTab: BottomTab;
  setBottomTab: Dispatch<SetStateAction<BottomTab>>;
  graphNodesForPanel: GraphPanelNode[];
  graphEdgesForPanel: GraphPanelEdge[];
  toggleNodeSort: (key: string) => void;
  toggleEdgeSort: (key: string) => void;
  renderSortIndicator: SortIndicatorRenderer;
  nodeSortKey: string;
  nodeSortDir: GraphSortDirection;
  edgeSortKey: string;
  edgeSortDir: GraphSortDirection;
  nodeAttributeColumns: string[];
  edgeAttributeColumns: string[];
  formatAttributeHeader: (key: string) => string;
  visibleGraphNodesForPanel: GraphPanelNode[];
  visibleGraphEdgesForPanel: GraphPanelEdge[];
  selectedNodeIds: Set<string>;
  selectedEdgeIds: Set<string>;
  handleNodeRowClick: (
    event: MouseEvent<HTMLTableRowElement>,
    node: GraphPanelNode,
    rowIndex: number
  ) => void;
  handleEdgeRowClick: (
    event: MouseEvent<HTMLTableRowElement>,
    edge: GraphPanelEdge,
    rowIndex: number
  ) => void;
  nodeRowRefs: GraphTableRowRefs;
  edgeRowRefs: GraphTableRowRefs;
  getNormalizedEdgeAttributes: (edge: GraphPanelEdge) => Record<string, unknown>;
  nodeLabelById: Record<string, string>;
  searchQuery: string;
  setSearchQuery: Dispatch<SetStateAction<string>>;
  nodeTypeOptions: string[];
  edgeTypeOptions: string[];
  activeTypeFilter: string;
  setNodeTypeFilter: Dispatch<SetStateAction<string>>;
  setEdgeTypeFilter: Dispatch<SetStateAction<string>>;
  nodeAttributeKeyOptions: string[];
  edgeAttributeKeyOptions: string[];
  activeAttributeKeyFilter: string;
  setNodeAttributeKeyFilter: Dispatch<SetStateAction<string>>;
  setEdgeAttributeKeyFilter: Dispatch<SetStateAction<string>>;
  attributeValueOptions: string[];
  activeAttributeValueFilter: string;
  setNodeAttributeValueFilter: Dispatch<SetStateAction<string>>;
  setEdgeAttributeValueFilter: Dispatch<SetStateAction<string>>;
  showOnlySelected: boolean;
  setShowOnlySelected: Dispatch<SetStateAction<boolean>>;
  resultTabs: GraphWorkbenchResultTab[];
}

export interface AppGraphBottomToolbarProps {
  artifactTitle: string;
  bottomTab: BottomTab;
  setBottomTab: Dispatch<SetStateAction<BottomTab>>;
  graphNodesCount: number;
  graphEdgesCount: number;
  resultsCount: number;
  filteredNodesCount: number;
  filteredEdgesCount: number;
  selectedNodesCount: number;
  selectedEdgesCount: number;
  hasActiveFilters: boolean;
  actions?: ReactNode;
}

export interface GraphWorkbenchResultColumn extends ConsoleProcedureColumn {
  key: string;
}

export interface GraphWorkbenchResultTab {
  sourceArtifactId: number;
  sourceArtifactName: string;
  sourceArtifactVersion: number;
  profileName: string;
  executedAt: string | null;
  sourceArtifactCreatedAt?: string | null;
  inputSummary?: string;
  inputObjectType?: string | null;
  inputObjectCount?: number | null;
  sourceSearchText?: string;
  tabId: string;
  tabName: string;
  rowCount: number;
  columns: GraphWorkbenchResultColumn[];
  rows: Record<string, unknown>[];
}
