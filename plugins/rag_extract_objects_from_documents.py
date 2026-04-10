"""Plugin: extract related objects in RAG for selected document nodes."""

from __future__ import annotations

import re
from collections import deque
from typing import Any, Dict, List, Optional, Set, Tuple

from app.services.plugins_config_service import get_plugin_config
from app.services.rag_integration_service import RagIntegrationService
from plugins import PluginBase
from plugins.rag_graph_utils import (
    build_nodes_index,
    ensure_edge,
    ensure_object_node,
    node_id,
    node_label,
    normalize_document_key,
    resolve_object_document_edge_type,
)


class RagExtractObjectsFromDocumentsPlugin(PluginBase):
    id = "rag_extract_objects"
    name = "Извлечь объекты из документов"
    version = "1.1.0"
    description = "Извлекает объекты из выделенных документов (строго по документу)"
    menu_path = "Функции RAG"
    input_types = ["graph"]
    output_types = ["graph"]
    applicable_to = ["graph"]

    inputs = {
        "artifact_types": ["graph"],
        "selection": {
            "nodes": "required",
            "edges": "optional",
            "rows": "optional",
            "text": "optional",
            "geo": "optional",
        },
    }

    params_schema = [
        {
            "name": "top_k",
            "label": "Лимит результатов",
            "type": "number",
            "required": False,
            "default": 8,
            "min": 1,
            "max": 200,
        },
        {
            "name": "max_objects_per_document",
            "label": "Макс. объектов на документ",
            "type": "number",
            "required": False,
            "default": 40,
            "min": 1,
            "max": 500,
        },
    ]

    output_strategy = {
        "mode": "update_current",
        "history_action": "plugin_execute",
    }

    def _resolve_topic(self) -> Optional[str]:
        cfg = get_plugin_config(self.id)
        rag_cfg = cfg.get("rag") if isinstance(cfg, dict) else {}
        if not isinstance(rag_cfg, dict):
            return None

        topic = str(rag_cfg.get("topic") or "").strip()
        if topic:
            return topic

        source_types = rag_cfg.get("source_types")
        if isinstance(source_types, list) and source_types:
            first = str(source_types[0] or "").strip()
            if first:
                return first
        return None

    def is_applicable_with_context(self, input_artifacts: List[Dict[str, Any]], context: Optional[Dict[str, Any]] = None) -> bool:
        if not input_artifacts:
            return False

        graph = input_artifacts[0] if isinstance(input_artifacts[0], dict) else {}
        data = graph.get("data") if isinstance(graph.get("data"), dict) else {}
        nodes = list(data.get("nodes") or [])
        node_index = build_nodes_index(nodes)

        ctx = context if isinstance(context, dict) else {}
        selected = [str(item) for item in (ctx.get("selected_nodes") or []) if str(item).strip()]
        for selected_node_id in selected:
            node = node_index.get(selected_node_id)
            if node and str(node.get("type") or "") == "document":
                return True
        return False

    @staticmethod
    def _node_map(response: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
        result: Dict[str, Dict[str, Any]] = {}
        for item in response.get("nodes") or []:
            if not isinstance(item, dict):
                continue
            result[str(item.get("id") or "")] = item
        return result

    @staticmethod
    def _edge_list(response: Dict[str, Any]) -> List[Dict[str, Any]]:
        return [edge for edge in (response.get("edges") or []) if isinstance(edge, dict)]

    @staticmethod
    def _normalize_doc_identity(document_id: str, source: str, label: str) -> Tuple[str, str, str, str]:
        did = str(document_id or "").strip().lower()
        src = str(source or "").strip().lower()
        lbl = str(label or "").strip().lower()
        dkey = normalize_document_key(document_id=did, source=src, title=lbl).lower()
        return did, src, lbl, dkey

    @staticmethod
    def _doc_node_ids_for_selected(
        response_nodes: Dict[str, Dict[str, Any]],
        selected_document_id: str,
        selected_document_source: str,
        selected_document_label: str,
    ) -> Set[str]:
        selected_id, selected_source, selected_label, selected_key = RagExtractObjectsFromDocumentsPlugin._normalize_doc_identity(
            selected_document_id,
            selected_document_source,
            selected_document_label,
        )

        result: Set[str] = set()
        for node_key, node in response_nodes.items():
            if str(node.get("type") or "") != "document":
                continue

            value = str(node.get("value") or "").strip().lower()
            meta = node.get("meta") if isinstance(node.get("meta"), dict) else {}
            node_doc_id = str(meta.get("document_id") or node.get("id") or "").strip().lower()
            node_source = str(meta.get("file_path") or meta.get("source") or "").strip().lower()
            node_key_norm = normalize_document_key(document_id=node_doc_id, source=node_source, title=value).lower()

            if selected_key and node_key_norm and selected_key == node_key_norm:
                result.add(node_key)
                continue
            if selected_source and node_source and selected_source == node_source:
                result.add(node_key)
                continue
            if selected_id and node_doc_id and selected_id == node_doc_id:
                result.add(node_key)
                continue
            if (not selected_source) and (not selected_id) and selected_label and selected_label == value:
                result.add(node_key)

        return result

    @staticmethod
    def _edge_matches_selected_doc(
        edge: Dict[str, Any],
        doc_node_ids: Set[str],
        selected_document_id: str,
        selected_document_source: str,
        selected_document_label: str,
    ) -> bool:
        source_id = str(edge.get("source") or edge.get("from") or "")
        target_id = str(edge.get("target") or edge.get("to") or "")
        if source_id in doc_node_ids or target_id in doc_node_ids:
            return True

        selected_id, selected_source, selected_label, selected_key = RagExtractObjectsFromDocumentsPlugin._normalize_doc_identity(
            selected_document_id,
            selected_document_source,
            selected_document_label,
        )

        for evidence in edge.get("evidence_documents") or []:
            if not isinstance(evidence, dict):
                continue

            e_id = str(evidence.get("document_id") or "").strip().lower()
            e_source = str(evidence.get("file_path") or evidence.get("source") or "").strip().lower()
            e_title = str(evidence.get("document_title") or evidence.get("title") or "").strip().lower()
            e_key = normalize_document_key(document_id=e_id, source=e_source, title=e_title).lower()

            if selected_key and e_key and selected_key == e_key:
                return True
            if selected_source and e_source and selected_source == e_source:
                return True
            if selected_id and e_id and selected_id == e_id:
                return True
            if (not selected_source) and (not selected_id) and selected_label and selected_label == e_title:
                return True

        return False

    @staticmethod
    def _allowed_object_type(raw_type: str, value: str) -> str:
        t = str(raw_type or "").strip().lower()
        v = str(value or "").strip()

        mapping = {
            "phone": "phone",
            "msisdn": "phone",
            "abonent": "phone",
            "subscriber": "phone",
            "email": "email",
            "mail": "email",
            "ip": "ip",
            "ip_address": "ip",
            "passport": "passport",
            "inn": "inn",
            "snils": "snils",
            "imei": "imei",
            "iccid": "iccid",
            "person": "person",
            "fio": "person",
            "name": "person",
            "address": "address",
            "location": "address",
            "social": "social_id",
            "social_id": "social_id",
            "account": "social_id",
            "vehicle": "vehicle",
            "car": "vehicle",
        }
        if t in mapping:
            return mapping[t]

        digits = re.sub(r"\D+", "", v)
        if "@" in v and "." in v:
            return "email"
        if re.match(r"^\d{1,3}(?:\.\d{1,3}){3}$", v):
            return "ip"
        if len(digits) in (10, 11):
            return "phone"
        if len(digits) == 12:
            return "passport"
        if len(digits) in (10, 12):
            return "inn"
        if len(digits) == 11:
            return "snils"

        return "person"

    @staticmethod
    def _normalize_value(object_type: str, value: str) -> str:
        v = str(value or "").strip()
        t = str(object_type or "").strip().lower()

        if t == "phone":
            digits = re.sub(r"\D+", "", v)
            if len(digits) == 11 and digits.startswith("8"):
                digits = "7" + digits[1:]
            if len(digits) == 10:
                digits = "7" + digits
            return digits

        if t in {"inn", "snils", "imei", "iccid"}:
            return re.sub(r"\D+", "", v)

        if t == "email":
            return v.lower()

        if t == "social_id":
            handle = v.lower()
            if handle and not handle.startswith("@"):
                handle = "@" + handle
            return handle

        return re.sub(r"\s+", " ", v)

    @staticmethod
    def _is_valid_value(object_type: str, value: str) -> bool:
        v = str(value or "").strip()
        if not v:
            return False
        if len(v) < 2 or len(v) > 120:
            return False

        if re.match(r"^\d{4}-\d{2}-\d{2}$", v):
            return False

        lowered = v.lower()
        if lowered in {"http", "https", "www"}:
            return False

        t = str(object_type or "").strip().lower()
        if t == "phone":
            return bool(re.match(r"^7\d{10}$", v))
        if t == "email":
            return bool(re.match(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$", v))
        if t == "ip":
            if not re.match(r"^\d{1,3}(?:\.\d{1,3}){3}$", v):
                return False
            try:
                return all(0 <= int(part) <= 255 for part in v.split("."))
            except Exception:
                return False
        if t == "passport":
            return len(v) == 12
        if t == "inn":
            return len(v) in (10, 12)
        if t == "snils":
            return len(v) == 11
        if t == "imei":
            return len(v) in (14, 15, 16)
        if t == "iccid":
            return 18 <= len(v) <= 22
        if t == "social_id":
            return bool(re.match(r"^@[a-z0-9_.\-]{3,32}$", v))
        if t == "person":
            if any(ch.isdigit() for ch in v):
                return False
            if not re.match(r"^[A-Za-zА-Яа-яЁё.\- ]+$", v):
                return False
            parts = [part for part in v.split(" ") if part]
            return 2 <= len(parts) <= 5
        if t == "address":
            return len(v) >= 6

        return True

    @staticmethod
    def _build_object_attrs(object_type: str, object_value: str) -> Dict[str, Any]:
        attrs: Dict[str, Any] = {}
        visual: Dict[str, Any] = {}

        # UX правило от пользователя:
        # - ФИО (person) -> иконка persona
        # - номер телефона (phone) -> иконка abonent
        if object_type == "person":
            attrs["name"] = object_value
            visual["icon"] = "persona"
        elif object_type == "phone":
            attrs["number"] = object_value
            visual["icon"] = "abonent"
        elif object_type == "email":
            attrs["email"] = object_value
        elif object_type == "ip":
            attrs["ip"] = object_value
        elif object_type == "address":
            attrs["address"] = object_value
        elif object_type == "passport":
            attrs["number"] = object_value
        elif object_type == "inn":
            attrs["inn"] = object_value
        elif object_type == "snils":
            attrs["snils"] = object_value
        elif object_type == "imei":
            attrs["imei"] = object_value
        elif object_type == "iccid":
            attrs["iccid"] = object_value
        elif object_type == "social_id":
            attrs["account"] = object_value
        elif object_type == "vehicle":
            attrs["plate"] = object_value

        if visual:
            attrs["visual"] = visual
        return attrs

    @staticmethod
    def _extract_objects_for_selected_document(
        response: Dict[str, Any],
        selected_document_id: str,
        selected_document_source: str,
        selected_document_label: str,
    ) -> Dict[str, Dict[str, Any]]:
        nodes = RagExtractObjectsFromDocumentsPlugin._node_map(response)
        if not nodes:
            return {}

        doc_node_ids = RagExtractObjectsFromDocumentsPlugin._doc_node_ids_for_selected(
            response_nodes=nodes,
            selected_document_id=selected_document_id,
            selected_document_source=selected_document_source,
            selected_document_label=selected_document_label,
        )

        edges = RagExtractObjectsFromDocumentsPlugin._edge_list(response)

        relevant_edges: List[Dict[str, Any]] = []
        for edge in edges:
            if RagExtractObjectsFromDocumentsPlugin._edge_matches_selected_doc(
                edge=edge,
                doc_node_ids=doc_node_ids,
                selected_document_id=selected_document_id,
                selected_document_source=selected_document_source,
                selected_document_label=selected_document_label,
            ):
                relevant_edges.append(edge)

        adjacency: Dict[str, Set[str]] = {}
        for edge in relevant_edges:
            sid = str(edge.get("source") or edge.get("from") or "")
            tid = str(edge.get("target") or edge.get("to") or "")
            if not sid or not tid:
                continue
            adjacency.setdefault(sid, set()).add(tid)
            adjacency.setdefault(tid, set()).add(sid)

        visited: Set[str] = set()
        queue: deque[Tuple[str, int]] = deque()

        for doc_node_id in doc_node_ids:
            visited.add(doc_node_id)
            queue.append((doc_node_id, 0))

        if not queue and relevant_edges:
            for edge in relevant_edges:
                sid = str(edge.get("source") or edge.get("from") or "")
                tid = str(edge.get("target") or edge.get("to") or "")
                if sid:
                    visited.add(sid)
                    queue.append((sid, 0))
                if tid:
                    visited.add(tid)
                    queue.append((tid, 0))

        while queue:
            current_id, distance = queue.popleft()
            if distance >= 2:
                continue
            for neighbor in adjacency.get(current_id, set()):
                if neighbor in visited:
                    continue
                visited.add(neighbor)
                queue.append((neighbor, distance + 1))

        object_map: Dict[str, Dict[str, Any]] = {}
        for node_key in visited:
            node = nodes.get(node_key)
            if not isinstance(node, dict):
                continue
            if str(node.get("type") or "") != "object":
                continue

            value = str(node.get("value") or "").strip()
            if not value:
                continue

            meta = node.get("meta") if isinstance(node.get("meta"), dict) else {}
            object_type = RagExtractObjectsFromDocumentsPlugin._allowed_object_type(meta.get("entity_type") or meta.get("type"), value)
            normalized_value = RagExtractObjectsFromDocumentsPlugin._normalize_value(object_type, value)
            if not RagExtractObjectsFromDocumentsPlugin._is_valid_value(object_type, normalized_value):
                continue

            if normalized_value not in object_map:
                object_map[normalized_value] = {
                    "value": normalized_value,
                    "type": object_type,
                }

        return object_map

    async def execute(
        self,
        input_artifacts: List[Dict[str, Any]],
        params: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        if not input_artifacts:
            return []

        params = params or {}
        context = params.get("_context") if isinstance(params.get("_context"), dict) else {}
        selected_ids = [str(item) for item in (context.get("selected_nodes") or [])]

        graph = input_artifacts[0]
        data = dict(graph.get("data") or {})
        nodes = list(data.get("nodes") or [])
        edges = list(data.get("edges") or [])
        metadata = dict(graph.get("metadata") or {})

        node_index = build_nodes_index(nodes)
        selected_docs = [node_index[nid] for nid in selected_ids if nid in node_index]
        selected_docs = [node for node in selected_docs if str(node.get("type") or "") == "document"]

        if not selected_docs:
            metadata.update(
                {
                    "source_plugin": self.id,
                    "rag_extract_status": "no_selected_documents",
                }
            )
            return [
                {
                    "type": "graph",
                    "name": graph.get("name", "Graph"),
                    "description": graph.get("description"),
                    "data": {**data, "nodes": nodes, "edges": edges},
                    "metadata": metadata,
                }
            ]

        rag = RagIntegrationService(plugin_id=self.id)
        top_k = int(params.get("top_k") or 8)
        top_k = max(1, min(top_k, 200))
        max_objects_per_document = int(params.get("max_objects_per_document") or 40)
        max_objects_per_document = max(1, min(max_objects_per_document, 500))
        topic = self._resolve_topic()

        added_nodes = 0
        added_edges = 0
        total_hits = 0
        docs_with_objects = 0
        last_error = None

        for doc_node in selected_docs:
            attrs = doc_node.get("attributes") if isinstance(doc_node.get("attributes"), dict) else {}
            selected_doc_id = str(attrs.get("document_id") or "").strip()
            selected_doc_source = str(attrs.get("source") or "").strip()
            selected_doc_label = node_label(doc_node)
            current_doc_id = node_id(doc_node)

            seed_queries: List[str] = []
            for graph_edge in edges:
                if not isinstance(graph_edge, dict):
                    continue
                from_id = str(graph_edge.get("from") or graph_edge.get("source_node") or "")
                to_id = str(graph_edge.get("to") or graph_edge.get("target_node") or "")
                if from_id != current_doc_id and to_id != current_doc_id:
                    continue
                other_id = to_id if from_id == current_doc_id else from_id
                other_node = node_index.get(other_id)
                if not other_node:
                    continue
                if str(other_node.get("type") or "") == "document":
                    continue
                other_label = node_label(other_node)
                if other_label:
                    seed_queries.append(other_label)

            if not seed_queries:
                fallback_query = selected_doc_source or selected_doc_id or selected_doc_label
                if fallback_query:
                    seed_queries.append(fallback_query)

            if not seed_queries:
                continue

            dedup_seed: List[str] = []
            seen_seed: Set[str] = set()
            for item in seed_queries:
                key = item.strip().lower()
                if not key or key in seen_seed:
                    continue
                seen_seed.add(key)
                dedup_seed.append(item.strip())
            seed_queries = dedup_seed[:12]

            responses: List[Dict[str, Any]] = []
            for seed_query in seed_queries:
                digits_only = ''.join(ch for ch in seed_query if ch.isdigit())
                is_exact_numeric = len(digits_only) >= 10 and len(digits_only) == len(seed_query)

                payload: Dict[str, Any] = {
                    "query": seed_query,
                    "top_k": top_k,
                    "search_mode": "strict" if is_exact_numeric else "hybrid",
                    "rewrite_query": False if is_exact_numeric else True,
                    "exact_entity_only": True if is_exact_numeric else False,
                    "include_trace": False,
                }
                if topic:
                    payload["topic"] = topic

                try:
                    first = await rag.query(payload)
                    if isinstance(first, dict):
                        responses.append(first)
                except Exception as exc:
                    last_error = str(exc)

                if topic:
                    try:
                        retry_payload = dict(payload)
                        retry_payload.pop("topic", None)
                        retry = await rag.query(retry_payload)
                        if isinstance(retry, dict):
                            responses.append(retry)
                    except Exception as exc:
                        last_error = str(exc)

            found_objects: Dict[str, Dict[str, Any]] = {}
            for response in responses:
                total_hits += int(response.get("hits_count") or len(response.get("hits") or []))
                extracted = self._extract_objects_for_selected_document(
                    response=response,
                    selected_document_id=selected_doc_id,
                    selected_document_source=selected_doc_source,
                    selected_document_label=selected_doc_label,
                )
                for object_value, object_data in extracted.items():
                    if object_value not in found_objects:
                        found_objects[object_value] = object_data

            if not found_objects:
                continue

            docs_with_objects += 1
            for object_value in sorted(found_objects.keys())[:max_objects_per_document]:
                object_data = found_objects[object_value]
                object_type = str(object_data.get("type") or "person")

                before_nodes = len(nodes)
                object_node = ensure_object_node(
                    nodes,
                    object_type=object_type,
                    label=object_value,
                    attrs=self._build_object_attrs(object_type, object_value),
                )
                if len(nodes) > before_nodes:
                    added_nodes += 1
                    node_index[node_id(object_node)] = object_node

                edge_type = resolve_object_document_edge_type(str(object_node.get("type") or "person"))
                before_edges = len(edges)
                ensure_edge(
                    edges,
                    from_id=node_id(object_node),
                    to_id=node_id(doc_node),
                    edge_type=edge_type,
                    attributes={
                        "source": "rag",
                        "query": selected_doc_source or selected_doc_id or selected_doc_label,
                    },
                )
                if len(edges) > before_edges:
                    added_edges += 1

        status = "ok" if (added_nodes > 0 or added_edges > 0) else "no_results"
        metadata.update(
            {
                "source_plugin": self.id,
                "rag_extract_status": status,
                "rag_extract_selected_documents": len(selected_docs),
                "rag_extract_documents_with_objects": docs_with_objects,
                "rag_extract_hits": total_hits,
                "rag_extract_added_nodes": added_nodes,
                "rag_extract_added_edges": added_edges,
                "rag_extract_topic": topic,
                "rag_extract_max_objects_per_document": max_objects_per_document,
            }
        )
        if last_error and status != "ok":
            metadata["rag_extract_error"] = last_error

        return [
            {
                "type": "graph",
                "name": graph.get("name", "Graph"),
                "description": graph.get("description"),
                "data": {**data, "nodes": nodes, "edges": edges},
                "metadata": metadata,
            }
        ]

