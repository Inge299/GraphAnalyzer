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

      networkRef.current.setOptions({
        physics: {
          enabled: true,
          solver: cfg.solver,
          forceAtlas2Based: {
            gravitationalConstant: cfg.gravitationalConstant,
            centralGravity: cfg.centralGravity,
            springLength: cfg.springLength,
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

      await new Promise<void>((resolve) => {
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          try {
            networkRef.current?.off?.('stabilizationIterationsDone', onDone as any);
          } catch {
            // no-op
          }
          resolve();
        };
        const onDone = () => finish();

        networkRef.current?.on('stabilizationIterationsDone', onDone as any);
        networkRef.current?.startSimulation();
        setTimeout(finish, cfg.maxDurationMs);
      });

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

      const physicsFlags = allIds.map((id: string) => ({ id, physics: targetSet.has(id) }));
      nodesDataSetRef.current.update(physicsFlags);

      networkRef.current.setOptions({
        physics: {
          enabled: true,
          solver: 'forceAtlas2Based',
          forceAtlas2Based: {
            gravitationalConstant: layoutConfig.hybrid.physics.gravitationalConstantBase * layoutConfig.hybrid.spacingMultiplier,
            centralGravity: layoutConfig.hybrid.physics.centralGravityBase / layoutConfig.hybrid.spacingMultiplier,
            springLength: layoutConfig.hybrid.physics.springLengthBase * layoutConfig.hybrid.spacingMultiplier,
            springConstant: layoutConfig.hybrid.physics.springConstant,
            avoidOverlap: layoutConfig.hybrid.physics.avoidOverlap,
          },
          minVelocity: layoutConfig.hybrid.physics.minVelocity,
          timestep: layoutConfig.hybrid.physics.timestep,
          stabilization: false,
        },
      });

      networkRef.current.startSimulation();
      await new Promise((resolve) => setTimeout(resolve, layoutConfig.hybrid.forceDurationMs));
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

      const finalPositions = runAntiOverlap(targetIds, forcePositions, radiusById, blockers);

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

