import { useCallback } from 'react';
import type { MutableRefObject } from 'react';
import { layoutConfig } from '../config/layout';

type MoveItem = { nodeId: string; x: number; y: number };
type Position = { x: number; y: number };
type Blocker = { x: number; y: number; radius: number };

interface UseGraphLayoutActionsArgs {
  networkRef: MutableRefObject<any>;
  nodesDataSetRef: MutableRefObject<any>;
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
  paddingOverride?: number
) => {
  const next = new Map<string, Position>();
  targetIds.forEach((id) => {
    const pos = initialPositions.get(id) || { x: 0, y: 0 };
    next.set(id, { x: pos.x, y: pos.y });
  });

  const padding = paddingOverride ?? (layoutConfig.hybrid.antiOverlapPaddingBase * layoutConfig.hybrid.spacingMultiplier);
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
        const desired = ra + rb + padding;
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
        const desired = r + blocker.radius + padding;
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

    if (targetIds.length <= 1) return;

    setLabelsSuppressed(true);
    try {
      const targetSet = new Set(targetIds);
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

  const handleAutoLayoutClick = useCallback(async () => {
    if (!networkRef.current || !nodesDataSetRef.current) return;
    const data = artifactDataRef.current || {};
    const allNodes = data.nodes || [];
    if (!allNodes.length) return;

    const selectedIds = networkRef.current.getSelectedNodes().map((id: any) => String(id));
    const targetIds = selectedIds.length
      ? selectedIds
      : allNodes.map((node: any) => String(getNodeId(node)));

    if (targetIds.length <= 1) return;

    setLabelsSuppressed(true);
    try {
      const targetSet = new Set(targetIds);
      const allIds = allNodes.map((node: any) => String(getNodeId(node)));
      const nodeById = new Map(allNodes.map((node: any) => [String(getNodeId(node)), node]));

      const blockers = selectedIds.length
        ? allNodes
            .filter((node: any) => !targetSet.has(String(getNodeId(node))))
            .map((node: any) => ({
              x: Number(node.position_x || 0),
              y: Number(node.position_y || 0),
              radius: estimateNodeFootprint(node),
            }))
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

      const finalPositions = runAntiOverlap(
        targetIds,
        forcePositions,
        radiusById,
        blockers,
        Math.max(12, resolveLayoutDistancePx() * 0.08),
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

