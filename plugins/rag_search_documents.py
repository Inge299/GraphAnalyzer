"""Plugin: find related documents in RAG for selected graph objects."""

from __future__ import annotations

import asyncio
from typing import Any, Dict, List, Optional, Tuple

from app.services.plugins_config_service import get_plugin_config
from app.services.rag_integration_service import RagIntegrationService
from plugins import PluginBase
from plugins.rag_graph_utils import (
    build_nodes_index,
    ensure_document_node,
    ensure_edge,
    node_id,
    node_label,
    normalize_document_key,
    relation_document_id,
    relation_document_source,
    relation_document_title,
    resolve_object_document_edge_type,
)


class RagSearchDocumentsPlugin(PluginBase):
    id = "rag_search_documents"
    name = "Поиск в документах"
    version = "0.5.1"
    description = "Находит документы для выделенных объектов и добавляет связи объект-документ"
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
            "default": 6,
            "min": 1,
            "max": 20,
        },
        {
            "name": "parallel",
            "label": "Параллельные запросы",
            "type": "number",
            "required": False,
            "default": 1,
            "min": 1,
            "max": 3,
        },
        {
            "name": "max_docs_per_object",
            "label": "Макс. документов на объект",
            "type": "number",
            "required": False,
            "default": 5,
            "min": 1,
            "max": 15,
        },
        {
            "name": "max_total_documents",
            "label": "Макс. документов за запуск",
            "type": "number",
            "required": False,
            "default": 60,
            "min": 10,
            "max": 250,
        },
        {
            "name": "selected_limit",
            "label": "Макс. выделенных объектов",
            "type": "number",
            "required": False,
            "default": 25,
            "min": 1,
            "max": 100,
        },
    ]

    output_strategy = {
        "mode": "update_current",
        "history_action": "plugin_execute",
    }

    def is_applicable_with_context(self, input_artifacts: List[Dict[str, Any]], context: Optional[Dict[str, Any]] = None) -> bool:
        ctx = context if isinstance(context, dict) else {}
        selected = [str(item) for item in (ctx.get("selected_nodes") or []) if str(item).strip()]
        return len(selected) > 0

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

    @staticmethod
    def _extract_documents(payload: Dict[str, Any]) -> List[Dict[str, Any]]:
        documents: List[Dict[str, Any]] = []

        for node in payload.get("nodes") or []:
            if str(node.get("type") or "") != "document":
                continue
            value = str(node.get("value") or "").strip()
            meta = node.get("meta") if isinstance(node.get("meta"), dict) else {}
            documents.append(
                {
                    "document_id": str(meta.get("document_id") or node.get("id") or "").strip(),
                    "document_title": value or str(meta.get("title") or "Документ").strip(),
                    "source": str(meta.get("file_path") or meta.get("source") or "").strip(),
                    "file_path": str(meta.get("file_path") or "").strip(),
                }
            )

        for edge in payload.get("edges") or []:
            for evidence in edge.get("evidence_documents") or []:
                if not isinstance(evidence, dict):
                    continue
                documents.append(
                    {
                        "document_id": str(evidence.get("document_id") or "").strip(),
                        "document_title": str(evidence.get("document_title") or "Документ").strip(),
                        "source": str(evidence.get("file_path") or evidence.get("source") or "").strip(),
                        "file_path": str(evidence.get("file_path") or "").strip(),
                    }
                )

        for hit in payload.get("hits") or []:
            if not isinstance(hit, dict):
                continue
            documents.append(
                {
                    "document_id": str(hit.get("document_id") or "").strip(),
                    "document_title": str(hit.get("document_title") or "Документ").strip(),
                    "source": str(hit.get("file_path") or "").strip(),
                    "file_path": str(hit.get("file_path") or "").strip(),
                }
            )

        dedup: Dict[str, Dict[str, Any]] = {}
        for doc in documents:
            doc_id = str(doc.get("document_id") or "").strip()
            source = str(doc.get("source") or doc.get("file_path") or "").strip()
            title = str(doc.get("document_title") or "").strip()
            key = normalize_document_key(document_id=doc_id, source=source, title=title).lower()
            if not key.strip("|"):
                continue
            if key not in dedup:
                dedup[key] = doc
                continue
            if not dedup[key].get("source") and source:
                dedup[key]["source"] = source

        return list(dedup.values())

    async def _query_for_node(
        self,
        rag: RagIntegrationService,
        source_node: Dict[str, Any],
        top_k: int,
        semaphore: asyncio.Semaphore,
        topic: Optional[str],
    ) -> Tuple[str, List[Dict[str, Any]], int, Optional[str]]:
        query_text = node_label(source_node)
        source_key = node_id(source_node)
        if not query_text:
            return source_key, [], 0, None

        payload: Dict[str, Any] = {
            "query": query_text,
            "top_k": top_k,
            "search_mode": "hybrid",
            "rewrite_query": True,
            "exact_entity_only": False,
            "include_trace": False,
        }
        if topic:
            payload["topic"] = topic

        async with semaphore:
            try:
                response = await rag.query(payload)
                if not isinstance(response, dict):
                    return source_key, [], 0, None

                documents = self._extract_documents(response)
                hits = int(response.get("hits_count") or len(response.get("hits") or []))
                if documents or not topic:
                    return source_key, documents, hits, None

                retry_payload = dict(payload)
                retry_payload.pop("topic", None)
                retry = await rag.query(retry_payload)
                if not isinstance(retry, dict):
                    return source_key, documents, hits, None

                retry_documents = self._extract_documents(retry)
                retry_hits = int(retry.get("hits_count") or len(retry.get("hits") or []))
                return source_key, retry_documents, retry_hits, None
            except Exception as exc:
                return source_key, [], 0, str(exc)

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
        selected_nodes = [node_index[nid] for nid in selected_ids if nid in node_index]
        selected_nodes = [node for node in selected_nodes if str(node.get("type") or "") != "document"]

        if not selected_nodes:
            metadata.update({
                "source_plugin": self.id,
                "rag_documents_status": "no_selected_objects",
            })
            return [{
                "type": "graph",
                "name": graph.get("name", "Graph"),
                "description": graph.get("description"),
                "data": {**data, "nodes": nodes, "edges": edges},
                "metadata": metadata,
            }]

        top_k = int(params.get("top_k") or 6)
        top_k = max(1, min(top_k, 20))
        parallel = int(params.get("parallel") or 1)
        parallel = max(1, min(parallel, 3))
        max_docs_per_object = int(params.get("max_docs_per_object") or 5)
        max_docs_per_object = max(1, min(max_docs_per_object, 15))
        max_total_documents = int(params.get("max_total_documents") or 60)
        max_total_documents = max(10, min(max_total_documents, 250))
        selected_limit = int(params.get("selected_limit") or 25)
        selected_limit = max(1, min(selected_limit, 100))

        selected_limited = len(selected_nodes) > selected_limit
        if selected_limited:
            selected_nodes = selected_nodes[:selected_limit]

        rag = RagIntegrationService(plugin_id=self.id)
        topic = self._resolve_topic()
        semaphore = asyncio.Semaphore(parallel)

        tasks = [self._query_for_node(rag, source_node, top_k, semaphore, topic) for source_node in selected_nodes]
        results = await asyncio.gather(*tasks)

        docs_by_source: Dict[str, List[Dict[str, Any]]] = {}
        total_hits = 0
        errors: List[str] = []
        for source_key, documents, hits, error in results:
            docs_by_source[source_key] = documents
            total_hits += hits
            if error:
                errors.append(error)

        added_docs = 0
        added_edges = 0
        total_docs_linked = 0
        docs_limited = False

        for source_node in selected_nodes:
            source_id = node_id(source_node)
            source_docs = docs_by_source.get(source_id) or []
            if max_docs_per_object > 0:
                source_docs = source_docs[:max_docs_per_object]

            for raw_doc in source_docs:
                if total_docs_linked >= max_total_documents:
                    docs_limited = True
                    break

                doc_id = relation_document_id(raw_doc)
                title = relation_document_title(raw_doc)
                source = relation_document_source(raw_doc)

                before_nodes = len(nodes)
                doc_node = ensure_document_node(
                    nodes,
                    document_id=doc_id,
                    title=title,
                    source=source,
                    excerpt="",
                )
                if len(nodes) > before_nodes:
                    added_docs += 1
                    node_index[node_id(doc_node)] = doc_node

                edge_type = resolve_object_document_edge_type(str(source_node.get("type") or "person"))
                before_edges = len(edges)
                ensure_edge(
                    edges,
                    from_id=node_id(source_node),
                    to_id=node_id(doc_node),
                    edge_type=edge_type,
                    attributes={"source": "rag", "query": node_label(source_node)},
                )
                if len(edges) > before_edges:
                    added_edges += 1

                total_docs_linked += 1

            if docs_limited:
                break

        status = "ok" if (added_docs > 0 or added_edges > 0 or total_hits > 0) else "no_results"
        metadata.update(
            {
                "source_plugin": self.id,
                "rag_documents_status": status,
                "rag_documents_selected": len(selected_nodes),
                "rag_documents_selected_limited": selected_limited,
                "rag_documents_selected_limit": selected_limit,
                "rag_documents_hits": total_hits,
                "rag_documents_added_nodes": added_docs,
                "rag_documents_added_edges": added_edges,
                "rag_documents_parallel": parallel,
                "rag_documents_topic": topic,
                "rag_documents_top_k": top_k,
                "rag_documents_max_docs_per_object": max_docs_per_object,
                "rag_documents_max_total_documents": max_total_documents,
                "rag_documents_total_docs_linked": total_docs_linked,
                "rag_documents_docs_limited": docs_limited,
            }
        )
        if errors and status != "ok":
            metadata["rag_documents_error"] = errors[0]

        return [{
            "type": "graph",
            "name": graph.get("name", "Graph"),
            "description": graph.get("description"),
            "data": {**data, "nodes": nodes, "edges": edges},
            "metadata": metadata,
        }]
