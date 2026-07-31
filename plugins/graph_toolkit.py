from __future__ import annotations

import math
import random
import re
from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

from plugins.graph_domain import get_node_visual_defaults, resolve_edge_label


def node_id(node: Dict[str, Any]) -> str:
    return str(node.get("id") or node.get("node_id") or "").strip()


def node_label(node: Dict[str, Any]) -> str:
    attributes = node.get("attributes") or {}
    visual = attributes.get("visual") or {}
    return str(
        node.get("label")
        or visual.get("label")
        or attributes.get("label")
        or attributes.get("name")
        or node_id(node)
        or ""
    ).strip()


def normalize_text(value: Any) -> str:
    return str(value or "").strip()


def normalize_phone(value: Any) -> str:
    digits = "".join(ch for ch in str(value or "") if ch.isdigit())
    if len(digits) == 11 and digits.startswith("8"):
        return "7" + digits[1:]
    if len(digits) == 10:
        return "7" + digits
    return digits or str(value or "").strip()


def is_phone_value(value: Any) -> bool:
    """Distinguish subscriber numbers from SIP/IMS service identifiers."""
    raw = str(value or "").strip()
    digits = "".join(ch for ch in raw if ch.isdigit())
    return bool(re.fullmatch(r"[0-9+().\s-]+", raw)) and 8 <= len(digits) <= 13
def parse_datetime(value: Any) -> Optional[datetime]:
    if isinstance(value, datetime):
        return value
    raw = str(value or "").strip().replace("T", " ")
    if not raw:
        return None
    for pattern in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d", "%d.%m.%Y %H:%M:%S", "%d.%m.%Y %H:%M"):
        try:
            return datetime.strptime(raw, pattern)
        except Exception:
            continue
    try:
        return datetime.fromisoformat(raw)
    except Exception:
        return None


def format_datetime(value: Any) -> str:
    dt = parse_datetime(value)
    if dt is None:
        return normalize_text(value)
    if dt.hour == 0 and dt.minute == 0 and dt.second == 0:
        return dt.strftime("%d.%m.%Y")
    return dt.strftime("%d.%m.%Y %H:%M")


def dedupe_preserve_order(items: Iterable[str]) -> List[str]:
    seen: set[str] = set()
    result: List[str] = []
    for item in items:
        value = str(item or "").strip()
        if not value or value in seen:
            continue
        seen.add(value)
        result.append(value)
    return result


class GraphPluginToolkit:
    def __init__(self) -> None:
        self._new_node_sequence = 0
        self._rng = random.Random()

    @staticmethod
    def node_xy(node: Optional[Dict[str, Any]]) -> Tuple[float, float]:
        if not isinstance(node, dict):
            return (0.0, 0.0)
        return (float(node.get("position_x") or 0.0), float(node.get("position_y") or 0.0))

    def pick_new_node_position(self, nodes: List[Dict[str, Any]], anchor_node: Optional[Dict[str, Any]] = None) -> Tuple[float, float]:
        ax, ay = self.node_xy(anchor_node)
        min_distance = 140.0
        radius_step = 90.0

        for attempt in range(48):
            ring = (self._new_node_sequence + attempt) // 10
            angle = self._rng.uniform(0.0, 2.0 * math.pi)
            radius = self._rng.uniform(130.0, 280.0) + ring * radius_step
            x = ax + radius * math.cos(angle)
            y = ay + radius * math.sin(angle)
            collision = False
            for existing in nodes:
                ex, ey = self.node_xy(existing)
                if math.hypot(x - ex, y - ey) < min_distance:
                    collision = True
                    break
            if not collision:
                self._new_node_sequence = self._new_node_sequence + attempt + 1
                return (round(x, 1), round(y, 1))
        self._new_node_sequence += 1
        return (ax + 240.0, ay)

    @staticmethod
    def next_node_id(nodes: List[Dict[str, Any]], prefix: str = "auto_node_") -> str:
        existing = {node_id(node) for node in nodes}
        index = 1
        while True:
            candidate = f"{prefix}{index}"
            if candidate not in existing:
                return candidate
            index += 1

    @staticmethod
    def next_edge_id(edges: List[Dict[str, Any]], prefix: str = "auto_edge_") -> str:
        existing = {str(edge.get("id") or "") for edge in edges}
        index = 1
        while True:
            candidate = f"{prefix}{index}"
            if candidate not in existing:
                return candidate
            index += 1

    @staticmethod
    def canonical_label(node_type: str, label: str) -> str:
        if node_type in {"msisdn", "person"}:
            return normalize_phone(label)
        return normalize_text(label)

    def find_or_create_node(
        self,
        nodes: List[Dict[str, Any]],
        node_type: str,
        label: str,
        anchor_node: Optional[Dict[str, Any]] = None,
        extra_attributes: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        canonical = self.canonical_label(node_type, label).lower()
        for node in nodes:
            if str(node.get("type") or "").strip().lower() != node_type.lower():
                continue
            if self.canonical_label(node_type, node_label(node)).lower() == canonical:
                if extra_attributes:
                    self.merge_node_attributes(node, extra_attributes)
                return node

        visual_defaults = get_node_visual_defaults(node_type)
        new_id = self.next_node_id(nodes)
        x, y = self.pick_new_node_position(nodes, anchor_node=anchor_node)
        attributes: Dict[str, Any] = {
            "label": label,
            "visual": {
                "label": label,
                "icon": visual_defaults["icon"],
                "color": visual_defaults["color"],
                "iconScale": visual_defaults["iconScale"],
                "ringEnabled": visual_defaults["ringEnabled"],
                "ringWidth": visual_defaults["ringWidth"],
                "fontColor": "#0f172a",
            },
        }
        if extra_attributes:
            attributes.update(extra_attributes)
        node = {
            "id": new_id,
            "type": node_type,
            "label": label,
            "position_x": x,
            "position_y": y,
            "attributes": attributes,
        }
        nodes.append(node)
        return node

    @staticmethod
    def merge_node_attributes(node: Dict[str, Any], extra_attributes: Dict[str, Any]) -> None:
        attributes = node.get("attributes")
        if not isinstance(attributes, dict):
            attributes = {}
            node["attributes"] = attributes
        visual = attributes.get("visual")
        if not isinstance(visual, dict):
            visual = {}
            attributes["visual"] = visual
        for key, value in extra_attributes.items():
            if key == "visual" and isinstance(value, dict):
                visual.update(value)
                continue
            if isinstance(value, list):
                existing = attributes.get(key)
                base = existing if isinstance(existing, list) else []
                attributes[key] = dedupe_preserve_order([*(str(item) for item in base), *(str(item) for item in value)])
                continue
            if isinstance(value, str):
                current = normalize_text(attributes.get(key))
                if current:
                    if current != value:
                        attributes[key] = "\n".join(dedupe_preserve_order([current, value]))
                else:
                    attributes[key] = value
                continue
            attributes[key] = value

    @staticmethod
    def find_existing_edge(edges: List[Dict[str, Any]], left_id: str, right_id: str, edge_type: str) -> Optional[Dict[str, Any]]:
        for edge in edges:
            if str(edge.get("type") or "") != edge_type:
                continue
            src = str(edge.get("from") or edge.get("source_node") or "")
            dst = str(edge.get("to") or edge.get("target_node") or "")
            if (src == left_id and dst == right_id) or (src == right_id and dst == left_id):
                return edge
        return None

    @staticmethod
    def build_edge_label(event_times: Sequence[str]) -> str:
        cleaned = [value for value in event_times if value]
        if not cleaned:
            return ""
        if len(cleaned) == 1:
            return cleaned[0]
        return f"???????: {len(cleaned)}\n?????????: {cleaned[-1]}"

    def build_edge(
        self,
        edges: List[Dict[str, Any]],
        from_id: str,
        to_id: str,
        edge_type: str,
        event_time: Optional[str],
        relation_label: str = "",
    ) -> Dict[str, Any]:
        new_id = self.next_edge_id(edges)
        event_times = [event_time] if event_time else []
        edge_label = self.build_edge_label(event_times)
        return {
            "id": new_id,
            "type": edge_type,
            "from": from_id,
            "to": to_id,
            "label": edge_label,
            "attributes": {
                "relation": resolve_edge_label(edge_type, relation_label),
                "event_time": event_times[-1] if event_times else "",
                "event_times": event_times,
                "events_count": len(event_times),
                "visual": {
                    "label": edge_label,
                    "direction": "both",
                },
            },
        }

    @staticmethod
    def build_edge_summary_label(events_count: int, first_event_at: str, last_event_at: str) -> str:
        if events_count <= 0:
            return ""
        if first_event_at and last_event_at and first_event_at != last_event_at:
            return f"Событий: {events_count}\n{first_event_at} - {last_event_at}"
        if last_event_at:
            return f"Событий: {events_count}\n{last_event_at}"
        return f"Событий: {events_count}"

    def apply_edge_summary(
        self,
        edge: Dict[str, Any],
        facts_count: int,
        first_event_at: Optional[str],
        last_event_at: Optional[str],
    ) -> None:
        """Replace transient event arrays with the compact aggregate returned by storage."""
        attributes = edge.get("attributes")
        if not isinstance(attributes, dict):
            attributes = {}
            edge["attributes"] = attributes
        visual = attributes.get("visual")
        if not isinstance(visual, dict):
            visual = {}
            attributes["visual"] = visual

        first = normalize_text(first_event_at)
        last = normalize_text(last_event_at) or first
        count = max(0, int(facts_count or 0))
        attributes.pop("event_times", None)
        attributes["events_count"] = count
        attributes["first_event_at"] = first
        attributes["last_event_at"] = last
        attributes["event_time"] = last
        edge_label = self.build_edge_summary_label(count, first, last)
        edge["label"] = edge_label
        visual["label"] = edge_label
        visual.setdefault("direction", "both")
    def merge_edge_event(self, edge: Dict[str, Any], event_time: Optional[str]) -> None:
        attributes = edge.get("attributes")
        if not isinstance(attributes, dict):
            attributes = {}
            edge["attributes"] = attributes
        visual = attributes.get("visual")
        if not isinstance(visual, dict):
            visual = {}
            attributes["visual"] = visual
        current_times = attributes.get("event_times") if isinstance(attributes.get("event_times"), list) else []
        next_times = dedupe_preserve_order([*(str(item) for item in current_times), str(event_time or "")])
        attributes["event_times"] = next_times
        attributes["events_count"] = len(next_times)
        attributes["event_time"] = next_times[-1] if next_times else ""
        edge_label = self.build_edge_label(next_times)
        edge["label"] = edge_label
        visual["label"] = edge_label
        visual["direction"] = "both"

    @staticmethod
    def selected_nodes(nodes: List[Dict[str, Any]], context: Optional[Dict[str, Any]]) -> List[Dict[str, Any]]:
        ctx = context if isinstance(context, dict) else {}
        raw_selected = ctx.get("selected_node_ids")
        if not isinstance(raw_selected, list) or not raw_selected:
            raw_selected = ctx.get("selected_nodes") or []

        selected_ids = set()
        for item in raw_selected:
            if isinstance(item, dict):
                value = str(item.get("id") or item.get("node_id") or "").strip()
            else:
                value = str(item).strip()
            if value:
                selected_ids.add(value)

        return [node for node in nodes if node_id(node) in selected_ids]
