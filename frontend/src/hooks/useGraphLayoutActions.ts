import { useCallback } from 'react';
import type { MutableRefObject } from 'react';
import { layoutConfig } from '../config/layout';

type MoveItem = { nodeId: string; x: number; y: number };
type Position = { x: number; y: number };
type Blocker = { x: number; y: number; radius: number };
type LayoutEdge = { id: string; from: string; to: string; weight: number };

interface UseGraphLayoutActionsArgs {
  networkRef: MutableRefObject<any>;
  nodesDataSetRef: MutableRefObject<any>;
  edgesDataSetRef: MutableRefObject<any>;
  artifactDataRef: MutableRefObject<any>;
  onNodeMove: (nodeId: string, x: number, y: number, groupId?: string | null) => void;
  onNodesMove?: (moves: MoveItem[], groupId?: string | null) => void;
  setLabelsSuppressed: (value: boolean) => void;
  updateSelectionFromNetwork: () => void;
  getNodeId: (node: any) => string;
  estimateNodeFootprint: (node: any) => number;
}

const createLayoutGroupId = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : ((r & 0x3) | 0x8);
    return v.toString(16);
  });
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const capturePositions = (network: any, nodeIds: string[]) => {
  const result = new Map<string, Position>();
  nodeIds.forEach((id) => {
    const pos = network.getPosition(id);
    result.set(id, { x: Number(pos?.x || 0), y: Number(pos?.y || 0) });
  });
  return result;
};

const getMaxMovementDelta = (previous: Map<string, Position>, current: Map<string, Position>) => {
  let maxDelta = 0;
  for (const [id, currentPos] of current.entries()) {
    const prevPos = previous.get(id);
    if (!prevPos) continue;
    const delta = Math.hypot(currentPos.x - prevPos.x, currentPos.y - prevPos.y);
    if (delta > maxDelta) maxDelta = delta;
  }
  return maxDelta;
};

const resolveLayoutDistancePx = () => {
  const raw = Number(layoutConfig.layoutSpacing?.nodeDistancePx || 260);
  return Number.isFinite(raw) ? Math.max(120, raw) : 260;
};

const resolveLayoutSpacingMultiplier = (baseSpringLength: number) => {
  const targetDistance = resolveLayoutDistancePx();
  return Math.max(0.7, targetDistance / Math.max(1, baseSpringLength));
};

const edgeWeight = (edge: any) => {
  const attributes = edge?.attributes && typeof edge.attributes === 'object' ? edge.attributes : {};
  for (const key of ['weight_value', 'calls_count', 'facts_count', 'connections_count', 'events_count', 'contacts_count']) {
    const value = Number(attributes[key]);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return 1;
};

const collectLayoutEdges = (edges: any[]): LayoutEdge[] => edges
  .map((edge) => ({
    id: String(edge?.id || ''),
    from: String(edge?.from || edge?.source_node || ''),
    to: String(edge?.to || edge?.target_node || ''),
    weight: edgeWeight(edge),
  }))
  .filter((edge) => Boolean(edge.id && edge.from && edge.to && edge.from !== edge.to));

const updateWeightedSpringLengths = (
  edgesDataSet: any,
  edges: LayoutEdge[],
  movableIds: Set<string>,
  minimumDistance: number,
) => {
  if (!edgesDataSet || edges.length === 0) return;
  const maxWeight = Math.max(...edges.map((edge) => edge.weight), 1);
  const updates = edges
    .filter((edge) => movableIds.has(edge.from) || movableIds.has(edge.to))
    .map((edge) => {
      const ratio = maxWeight <= 1 ? 0 : Math.log(edge.weight) / Math.log(maxWeight);
      // The strongest link is as short as the configured minimum node distance.
      const length = Math.round(minimumDistance * (1 + 0.75 * (1 - ratio)));
      return { id: edge.id, length };
    });
  if (updates.length > 0) edgesDataSet.update(updates);
};

const orientation = (a: Position, b: Position, c: Position) =>
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

const segmentsIntersect = (a: Position, b: Position, c: Position, d: Position) => {
  const abC = orientation(a, b, c);
  const abD = orientation(a, b, d);
  const cdA = orientation(c, d, a);
  const cdB = orientation(c, d, b);
  return ((abC > 0 && abD < 0) || (abC < 0 && abD > 0))
    && ((cdA > 0 && cdB < 0) || (cdA < 0 && cdB > 0));
};

const reduceEdgeCrossings = (
  initialPositions: Map<string, Position>,
  edges: LayoutEdge[],
  movableIds: Set<string>,
  minimumDistance: number,
) => {
  const positions = new Map(initialPositions);
  // The cap keeps the quadratic crossing pass responsive on dense graphs.
  const candidates = edges
    .filter((edge) => positions.has(edge.from) && positions.has(edge.to) && (movableIds.has(edge.from) || movableIds.has(edge.to)))
    .sort((left, right) => right.weight - left.weight)
    .slice(0, 220);
  const nudgeSize = Math.max(6, Math.min(18, minimumDistance * 0.06));

  const nudge = (id: string, x: number, y: number) => {
    if (!movableIds.has(id)) return;
    const point = positions.get(id);
    if (!point) return;
    point.x += x;
    point.y += y;
  };

  for (let pass = 0; pass < 5; pass += 1) {
    let crossings = 0;
    for (let leftIndex = 0; leftIndex < candidates.length; leftIndex += 1) {
      const left = candidates[leftIndex];
      const a = positions.get(left.from)!;
      const b = positions.get(left.to)!;
      for (let rightIndex = leftIndex + 1; rightIndex < candidates.length; rightIndex += 1) {
        const right = candidates[rightIndex];
        if (left.from === right.from || left.from === right.to || left.to === right.from || left.to === right.to) continue;
        const c = positions.get(right.from)!;
        const d = positions.get(right.to)!;
        if (!segmentsIntersect(a, b, c, d)) continue;

        const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        const normalX = -(b.y - a.y) / length;
        const normalY = (b.x - a.x) / length;
        nudge(left.from, normalX * nudgeSize, normalY * nudgeSize);
        nudge(left.to, normalX * nudgeSize, normalY * nudgeSize);
        nudge(right.from, -normalX * nudgeSize, -normalY * nudgeSize);
        nudge(right.to, -normalX * nudgeSize, -normalY * nudgeSize);
        crossings += 1;
      }
    }
    if (crossings === 0) break;
  }
  return positions;
};
const resolveSettlingMaxDurationMs = (mode: 'auto' | 'balanced', nodeCount: number) => {
  const cfg = layoutConfig.layoutSettling;
  const base = Number(mode === 'balanced' ? cfg.balancedLayoutBaseDurationMs : cfg.autoLayoutBaseDurationMs);
  const perNode = Number(cfg.durationPerNodeMs || 14);
  const cap = Number(cfg.maxDurationMs || 18000);
  const requested = (Number.isFinite(base) ? base : 4000) + Math.max(0, nodeCount) * (Number.isFinite(perNode) ? perNode : 14);
  return Math.min(cap, requested);
};

const waitForLayoutSettled = async (
  network: any,
  targetIds: string[],
  maxDurationMs: number,
) => {
  const settleCfg = layoutConfig.layoutSettling;
  const sampleIntervalMs = Number(settleCfg.sampleIntervalMs || 120);
  const maxStableMovementPx = Number(settleCfg.maxStableMovementPx || 2.5);
  const requiredStableSamples = Number(settleCfg.requiredStableSamples || 4);
  const minimumSettlingDurationMs = Number(settleCfg.minimumSettlingDurationMs || 1800);

  let stableSamples = 0;
  let previous = capturePositions(network, targetIds);
  const startedAt = Date.now();

  while ((Date.now() - startedAt) < maxDurationMs) {
    await delay(sampleIntervalMs);
    const current = capturePositions(network, targetIds);
    const maxDelta = getMaxMovementDelta(previous, current);
    if (maxDelta <= maxStableMovementPx) {
      stableSamples += 1;
      if (stableSamples >= requiredStableSamples && (Date.now() - startedAt) >= minimumSettlingDurationMs) {
        return current;
      }
    } else {
      stableSamples = 0;
    }
    previous = current;
  }

  return capturePositions(network, targetIds);
};

const runAntiOverlap = (
  targetIds: string[],
  initialPositions: Map<string, Position>,
  radiusById: Map<string, number>,
  blockers: Blocker[],
  paddingOverride?: number,
  minimumDistanceOverride?: number
) => {
  const next = new Map<string, Position>();
  targetIds.forEach((id) => {
    const pos = initialPositions.get(id) || { x: 0, y: 0 };
    next.set(id, { x: pos.x, y: pos.y });
  });

  const padding = paddingOverride ?? (layoutConfig.hybrid.antiOverlapPaddingBase * layoutConfig.hybrid.spacingMultiplier);
  const minimumDistance = minimumDistanceOverride ?? resolveLayoutDistancePx();
  for (let iter = 0; iter < 90; iter += 1) {
    let totalShift = 0;

    for (let i = 0; i < targetIds.length; i += 1) {
      for (let j = i + 1; j < targetIds.length; j += 1) {
        const aId = targetIds[i];
        const bId = targetIds[j];
        const a = next.get(aId)!;
        const b = next.get(bId)!;
        const ra = radiusById.get(aId) || 30;
        const rb = radiusById.get(bId) || 30;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 0.0001;
        const desired = Math.max(ra + rb + padding, minimumDistance);
        if (dist >= desired) continue;

        const push = (desired - dist) / 2;
        const ux = dx / dist;
        const uy = dy / dist;
        a.x -= ux * push;
        a.y -= uy * push;
        b.x += ux * push;
        b.y += uy * push;
        totalShift += push * 2;
      }
    }

    for (const id of targetIds) {
      const point = next.get(id)!;
      const r = radiusById.get(id) || 30;
      for (const blocker of blockers) {
        const dx = point.x - blocker.x;
        const dy = point.y - blocker.y;
        const dist = Math.hypot(dx, dy) || 0.0001;
        const desired = Math.max(r + blocker.radius + padding, minimumDistance);
        if (dist >= desired) continue;

        const push = desired - dist;
        point.x += (dx / dist) * push;
        point.y += (dy / dist) * push;
        totalShift += push;
      }
    }

    if (totalShift < 0.35) break;
  }

  return next;
};

export const useGraphLayoutActions = ({
  networkRef,
  nodesDataSetRef,
  edgesDataSetRef,
  artifactDataRef,
  onNodeMove,
  onNodesMove,
  setLabelsSuppressed,
  updateSelectionFromNetwork,
  getNodeId,
  estimateNodeFootprint,
}: UseGraphLayoutActionsArgs) => {
  const handleBalancedLayoutClick = useCallback(async (forceAll = false, explicitIds?: string[]) => {
    if (!networkRef.current || !nodesDataSetRef.current) return;

    const data = artifactDataRef.current || {};
    const allNodes = data.nodes || [];
    if (!allNodes.length) return;

    const selectedIds = networkRef.current.getSelectedNodes().map((id: any) => String(id));
    const targetIds = (explicitIds && explicitIds.length)
      ? explicitIds
      : ((!forceAll && selectedIds.length)
          ? selectedIds
          : allNodes.map((node: any) => String(getNodeId(node))));

    // A plugin may add one node. Manual auto-layout keeps the single-node no-op.
    if (targetIds.length === 0 || (targetIds.length === 1 && !explicitIds?.length)) return;

    setLabelsSuppressed(true);
    try {
      const targetSet = new Set<string>(targetIds);
      const allIds = allNodes.map((node: any) => String(getNodeId(node)));
      const physicsFlags = allIds.map((id: string) => ({ id, physics: targetSet.has(id) }));
      nodesDataSetRef.current.update(physicsFlags);

      const cfg = layoutConfig.physicsEngine;
      const spacingMultiplier = resolveLayoutSpacingMultiplier(Number(cfg.springLength || 285));

      networkRef.current.setOptions({
        physics: {
          enabled: true,
          solver: cfg.solver,
          forceAtlas2Based: {
            gravitationalConstant: cfg.gravitationalConstant,
            centralGravity: cfg.centralGravity,
            springLength: Number(cfg.springLength || 285) * spacingMultiplier,
            springConstant: cfg.springConstant,
            damping: cfg.damping,
            avoidOverlap: cfg.avoidOverlap,
          },
          minVelocity: cfg.minVelocity,
          timestep: cfg.timestep,
          stabilization: {
            enabled: true,
            iterations: cfg.iterations,
            fit: false,
            updateInterval: 25,
          },
        },
      });

      networkRef.current.startSimulation();
      await waitForLayoutSettled(
        networkRef.current,
        targetIds,
        resolveSettlingMaxDurationMs('balanced', targetIds.length),
      );

      networkRef.current.stopSimulation();

      const moves: MoveItem[] = targetIds.map((id: string) => {
        const pos = networkRef.current!.getPosition(id);
        return { nodeId: id, x: Math.round(Number(pos.x || 0)), y: Math.round(Number(pos.y || 0)) };
      });

      nodesDataSetRef.current.update([
        ...allIds.map((id: string) => ({ id, physics: false })),
        ...moves.map((move) => ({ id: move.nodeId, x: move.x, y: move.y })),
      ]);

      networkRef.current.setOptions({ physics: { enabled: false } });

      const groupId = createLayoutGroupId();
      if (onNodesMove && moves.length > 1) {
        onNodesMove(moves, groupId);
      } else {
        moves.forEach((move) => onNodeMove(move.nodeId, move.x, move.y, groupId));
      }

      networkRef.current.selectNodes(targetIds, false);
      updateSelectionFromNetwork();
    } finally {
      setLabelsSuppressed(false);
    }
  }, [artifactDataRef, getNodeId, networkRef, nodesDataSetRef, onNodeMove, onNodesMove, setLabelsSuppressed, updateSelectionFromNetwork]);

  const handleAutoLayoutClick = useCallback(async (explicitIds?: string[]) => {
    if (!networkRef.current || !nodesDataSetRef.current) return;
    const data = artifactDataRef.current || {};
    const allNodes = data.nodes || [];
    if (!allNodes.length) return;

    const selectedIds = networkRef.current.getSelectedNodes().map((id: any) => String(id));
    const targetIds = (explicitIds && explicitIds.length)
      ? explicitIds
      : (selectedIds.length
          ? selectedIds
          : allNodes.map((node: any) => String(getNodeId(node))));

    // A plugin may add one node. Manual auto-layout keeps the single-node no-op.
    if (targetIds.length === 0 || (targetIds.length === 1 && !explicitIds?.length)) return;

    setLabelsSuppressed(true);
    try {
      const targetSet = new Set<string>(targetIds);
      const allIds = allNodes.map((node: any) => String(getNodeId(node)));
      const nodeById = new Map(allNodes.map((node: any) => [String(getNodeId(node)), node]));
      const minimumDistance = resolveLayoutDistancePx();
      const layoutEdges = collectLayoutEdges(Array.isArray(data.edges) ? data.edges : []);
      updateWeightedSpringLengths(edgesDataSetRef.current, layoutEdges, targetSet, minimumDistance);

      const blockers = targetIds.length < allNodes.length
        ? allNodes
            .filter((node: any) => !targetSet.has(String(getNodeId(node))))
            .map((node: any) => {
              const nodeId = String(getNodeId(node));
              const position = networkRef.current!.getPosition(nodeId);
              return {
                x: Number(position?.x ?? node.position_x ?? 0),
                y: Number(position?.y ?? node.position_y ?? 0),
                radius: estimateNodeFootprint(node),
              };
            })
        : [];
      const spacingMultiplier = resolveLayoutSpacingMultiplier(layoutConfig.hybrid.physics.springLengthBase);

      const physicsFlags = allIds.map((id: string) => ({ id, physics: targetSet.has(id) }));
      nodesDataSetRef.current.update(physicsFlags);

      networkRef.current.setOptions({
        physics: {
          enabled: true,
          solver: 'forceAtlas2Based',
          forceAtlas2Based: {
            gravitationalConstant: layoutConfig.hybrid.physics.gravitationalConstantBase * spacingMultiplier,
            centralGravity: layoutConfig.hybrid.physics.centralGravityBase / spacingMultiplier,
            springLength: layoutConfig.hybrid.physics.springLengthBase * spacingMultiplier,
            springConstant: layoutConfig.hybrid.physics.springConstant,
            avoidOverlap: layoutConfig.hybrid.physics.avoidOverlap,
          },
          minVelocity: layoutConfig.hybrid.physics.minVelocity,
          timestep: layoutConfig.hybrid.physics.timestep,
          stabilization: false,
        },
      });

      networkRef.current.startSimulation();
      await waitForLayoutSettled(
        networkRef.current,
        targetIds,
        resolveSettlingMaxDurationMs('auto', targetIds.length),
      );
      networkRef.current.stopSimulation();

      const forcePositions = new Map<string, Position>();
      targetIds.forEach((id: string) => {
        const pos = networkRef.current!.getPosition(id);
        forcePositions.set(id, { x: Number(pos.x || 0), y: Number(pos.y || 0) });
      });

      const radiusById = new Map<string, number>();
      targetIds.forEach((id: string) => {
        const node = nodeById.get(id);
        radiusById.set(id, estimateNodeFootprint(node));
      });

      const crossingAdjusted = reduceEdgeCrossings(
        capturePositions(networkRef.current, allIds),
        layoutEdges,
        targetSet,
        minimumDistance,
      );
      const adjustedTargetPositions = new Map<string, Position>();
      targetIds.forEach((id: string) => adjustedTargetPositions.set(id, crossingAdjusted.get(id) || forcePositions.get(id) || { x: 0, y: 0 }));

      const finalPositions = runAntiOverlap(
        targetIds,
        adjustedTargetPositions,
        radiusById,
        blockers,
        Math.max(12, minimumDistance * 0.08),
        minimumDistance,
      );
      const moves: MoveItem[] = targetIds.map((id: string) => {
        const pos = finalPositions.get(id) || forcePositions.get(id) || { x: 0, y: 0 };
        return { nodeId: id, x: Math.round(pos.x), y: Math.round(pos.y) };
      });

      nodesDataSetRef.current.update([
        ...allIds.map((id: string) => ({ id, physics: false })),
        ...moves.map((move) => ({ id: move.nodeId, x: move.x, y: move.y })),
      ]);

      networkRef.current.setOptions({ physics: { enabled: false } });

      const groupId = createLayoutGroupId();
      if (onNodesMove && moves.length > 1) {
        onNodesMove(moves, groupId);
      } else {
        moves.forEach((move) => onNodeMove(move.nodeId, move.x, move.y, groupId));
      }

      networkRef.current.selectNodes(targetIds, false);
      updateSelectionFromNetwork();
    } finally {
      setLabelsSuppressed(false);
    }
  }, [artifactDataRef, estimateNodeFootprint, getNodeId, networkRef, nodesDataSetRef, onNodeMove, onNodesMove, setLabelsSuppressed, updateSelectionFromNetwork]);

  return {
    handleAutoLayoutClick,
    handleBalancedLayoutClick,
  };
};

