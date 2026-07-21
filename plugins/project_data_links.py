"""Plugins: build graph links from project data fact tables."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from sqlalchemy import bindparam, text

from app.database import AsyncSessionLocal
from plugins import PluginBase
from plugins.graph_toolkit import (
    GraphPluginToolkit,
    dedupe_preserve_order,
    format_datetime,
    node_id,
    node_label,
    normalize_phone,
    normalize_text,
)


PERSON_TYPES = {"person", "abonent", "subscriber", "msisdn"}


class _ProjectDataLinkPluginBase(PluginBase):
    input_types = ["graph"]
    output_types = ["graph"]
    applicable_to = ["graph"]
    output_strategy = {
        "mode": "update_current",
        "history_action": "plugin_execute",
    }
    plugin_scope = "context"
    menu_path = "Связи"

    def __init__(self) -> None:
        self.graph = GraphPluginToolkit()

    @staticmethod
    def _wrap_graph(
        graph: Dict[str, Any],
        data: Dict[str, Any],
        nodes: List[Dict[str, Any]],
        edges: List[Dict[str, Any]],
        metadata_extra: Dict[str, Any],
    ) -> Dict[str, Any]:
        return {
            "type": "graph",
            "name": graph.get("name", "Graph"),
            "description": graph.get("description"),
            "data": {**data, "nodes": nodes, "edges": edges},
            "metadata": {**(graph.get("metadata") or {}), **metadata_extra},
        }

    @staticmethod
    def _project_id(graph: Dict[str, Any], params_dict: Dict[str, Any]) -> int:
        return int(graph.get("project_id") or params_dict.get("project_id") or 0)

    @staticmethod
    def _selected_nodes(
        graph: Dict[str, Any],
        params_dict: Dict[str, Any],
        nodes: List[Dict[str, Any]],
        toolkit: GraphPluginToolkit,
    ) -> List[Dict[str, Any]]:
        context = params_dict.get("_context") if isinstance(params_dict.get("_context"), dict) else {}
        return toolkit.selected_nodes(nodes, context)

    @staticmethod
    def _selected_msisdns(selected_nodes: List[Dict[str, Any]]) -> List[str]:
        return dedupe_preserve_order(
            normalize_phone(node_label(node))
            for node in selected_nodes
            if str(node.get("type") or "").strip().lower() in PERSON_TYPES
        )


class UserMsisdnLinksPlugin(_ProjectDataLinkPluginBase):
    id = "project_user_msisdn_links"
    name = "Пользователь <-> MSISDN"
    version = "0.1.0"
    description = "Строит связи между идентификатором пользователя и номером телефона из данных проекта"

    def is_applicable_with_context(self, input_artifacts: List[Dict[str, Any]], context: Optional[Dict[str, Any]] = None) -> bool:
        if not input_artifacts:
            return False
        graph = input_artifacts[0] if isinstance(input_artifacts[0], dict) else {}
        data = graph.get("data") if isinstance(graph.get("data"), dict) else {}
        selected_nodes = self.graph.selected_nodes(list(data.get("nodes") or []), context)
        return any(str(node.get("type") or "").strip().lower() in PERSON_TYPES.union({"user_id"}) for node in selected_nodes)

    async def execute(self, input_artifacts: List[Dict[str, Any]], params: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        graph = input_artifacts[0]
        data = dict(graph.get("data") or {})
        nodes = list(data.get("nodes") or [])
        edges = list(data.get("edges") or [])
        params_dict = params if isinstance(params, dict) else {}
        selected_nodes = self._selected_nodes(graph, params_dict, nodes, self.graph)

        selected_msisdns = self._selected_msisdns(selected_nodes)
        selected_user_ids = dedupe_preserve_order(
            normalize_text(node_label(node))
            for node in selected_nodes
            if str(node.get("type") or "").strip().lower() == "user_id"
        )

        rows = await self._load_rows(self._project_id(graph, params_dict), selected_msisdns, selected_user_ids)
        if not rows:
            return [self._wrap_graph(graph, data, nodes, edges, {"source_plugin": self.id, "rows_count": 0})]

        for row in rows:
            user_id_value = normalize_text(row.get("user_id"))
            msisdn = normalize_phone(row.get("user_msisdn"))
            if not user_id_value or not msisdn:
                continue
            anchor = next(
                (
                    node
                    for node in selected_nodes
                    if normalize_phone(node_label(node)) == msisdn or normalize_text(node_label(node)) == user_id_value
                ),
                None,
            )
            user_node = self.graph.find_or_create_node(nodes, "user_id", user_id_value, anchor_node=anchor)
            msisdn_node = self.graph.find_or_create_node(nodes, "person", msisdn, anchor_node=user_node)
            event_time = format_datetime(row.get("event_time"))
            edge = self.graph.find_existing_edge(edges, node_id(user_node), node_id(msisdn_node), "user_msisdn_link")
            if edge is None:
                edges.append(self.graph.build_edge(edges, node_id(user_node), node_id(msisdn_node), "user_msisdn_link", event_time, self.name))
            else:
                self.graph.merge_edge_event(edge, event_time)

        return [self._wrap_graph(graph, data, nodes, edges, {"source_plugin": self.id, "rows_count": len(rows)})]

    async def _load_rows(self, project_id: int, msisdns: List[str], user_ids: List[str]) -> List[Dict[str, Any]]:
        if project_id <= 0 or (not msisdns and not user_ids):
            return []
        clauses: List[str] = []
        params: Dict[str, Any] = {"project_id": project_id}
        if msisdns:
            clauses.append("user_msisdn IN :msisdns")
            params["msisdns"] = msisdns
        if user_ids:
            clauses.append("user_id IN :user_ids")
            params["user_ids"] = user_ids
        sql = text(
            f"""
            SELECT event_time, user_id, user_msisdn
            FROM project_user_msisdn_facts
            WHERE project_id = :project_id
              AND ({' OR '.join(clauses)})
            ORDER BY event_time ASC
            """
        )
        if msisdns:
            sql = sql.bindparams(bindparam("msisdns", expanding=True))
        if user_ids:
            sql = sql.bindparams(bindparam("user_ids", expanding=True))
        async with AsyncSessionLocal() as session:
            result = await session.execute(sql, params)
            return [dict(row) for row in result.mappings().all()]


class IpMsisdnLinksPlugin(_ProjectDataLinkPluginBase):
    id = "project_ip_msisdn_links"
    name = "IP <-> MSISDN"
    version = "0.1.0"
    description = "Строит связи между IP и номером телефона из данных проекта"

    def is_applicable_with_context(self, input_artifacts: List[Dict[str, Any]], context: Optional[Dict[str, Any]] = None) -> bool:
        if not input_artifacts:
            return False
        graph = input_artifacts[0] if isinstance(input_artifacts[0], dict) else {}
        data = graph.get("data") if isinstance(graph.get("data"), dict) else {}
        selected_nodes = self.graph.selected_nodes(list(data.get("nodes") or []), context)
        return any(str(node.get("type") or "").strip().lower() in PERSON_TYPES.union({"ip"}) for node in selected_nodes)

    async def execute(self, input_artifacts: List[Dict[str, Any]], params: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        graph = input_artifacts[0]
        data = dict(graph.get("data") or {})
        nodes = list(data.get("nodes") or [])
        edges = list(data.get("edges") or [])
        params_dict = params if isinstance(params, dict) else {}
        selected_nodes = self._selected_nodes(graph, params_dict, nodes, self.graph)

        selected_msisdns = self._selected_msisdns(selected_nodes)
        selected_ips = dedupe_preserve_order(
            normalize_text(node_label(node))
            for node in selected_nodes
            if str(node.get("type") or "").strip().lower() == "ip"
        )

        rows = await self._load_rows(self._project_id(graph, params_dict), selected_msisdns, selected_ips)
        if not rows:
            return [self._wrap_graph(graph, data, nodes, edges, {"source_plugin": self.id, "rows_count": 0})]

        for row in rows:
            ip_address = normalize_text(row.get("ip_address"))
            msisdn = normalize_phone(row.get("user_msisdn"))
            if not ip_address or not msisdn:
                continue
            anchor = next(
                (
                    node
                    for node in selected_nodes
                    if normalize_phone(node_label(node)) == msisdn or normalize_text(node_label(node)) == ip_address
                ),
                None,
            )
            ip_node = self.graph.find_or_create_node(nodes, "ip", ip_address, anchor_node=anchor)
            msisdn_node = self.graph.find_or_create_node(nodes, "person", msisdn, anchor_node=ip_node)
            event_time = format_datetime(row.get("event_time"))
            edge = self.graph.find_existing_edge(edges, node_id(ip_node), node_id(msisdn_node), "ip_msisdn_link")
            if edge is None:
                edges.append(self.graph.build_edge(edges, node_id(ip_node), node_id(msisdn_node), "ip_msisdn_link", event_time, self.name))
            else:
                self.graph.merge_edge_event(edge, event_time)

        return [self._wrap_graph(graph, data, nodes, edges, {"source_plugin": self.id, "rows_count": len(rows)})]

    async def _load_rows(self, project_id: int, msisdns: List[str], ips: List[str]) -> List[Dict[str, Any]]:
        if project_id <= 0 or (not msisdns and not ips):
            return []
        clauses: List[str] = []
        params: Dict[str, Any] = {"project_id": project_id}
        if msisdns:
            clauses.append("user_msisdn IN :msisdns")
            params["msisdns"] = msisdns
        if ips:
            clauses.append("ip_address IN :ips")
            params["ips"] = ips
        sql = text(
            f"""
            SELECT event_time, ip_address, user_msisdn
            FROM project_ip_msisdn_facts
            WHERE project_id = :project_id
              AND ({' OR '.join(clauses)})
            ORDER BY event_time ASC
            """
        )
        if msisdns:
            sql = sql.bindparams(bindparam("msisdns", expanding=True))
        if ips:
            sql = sql.bindparams(bindparam("ips", expanding=True))
        async with AsyncSessionLocal() as session:
            result = await session.execute(sql, params)
            return [dict(row) for row in result.mappings().all()]


class MsisdnDeviceLinksPlugin(_ProjectDataLinkPluginBase):
    id = "project_msisdn_device_links"
    name = "MSISDN <-> Устройство"
    version = "0.1.0"
    description = "Строит связи между номером телефона и профилем устройства из данных проекта"

    def is_applicable_with_context(self, input_artifacts: List[Dict[str, Any]], context: Optional[Dict[str, Any]] = None) -> bool:
        if not input_artifacts:
            return False
        graph = input_artifacts[0] if isinstance(input_artifacts[0], dict) else {}
        data = graph.get("data") if isinstance(graph.get("data"), dict) else {}
        selected_nodes = self.graph.selected_nodes(list(data.get("nodes") or []), context)
        return any(str(node.get("type") or "").strip().lower() in PERSON_TYPES.union({"device_profile"}) for node in selected_nodes)

    async def execute(self, input_artifacts: List[Dict[str, Any]], params: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        graph = input_artifacts[0]
        data = dict(graph.get("data") or {})
        nodes = list(data.get("nodes") or [])
        edges = list(data.get("edges") or [])
        params_dict = params if isinstance(params, dict) else {}
        selected_nodes = self._selected_nodes(graph, params_dict, nodes, self.graph)

        selected_msisdns = self._selected_msisdns(selected_nodes)
        selected_devices = dedupe_preserve_order(
            normalize_text(node_label(node))
            for node in selected_nodes
            if str(node.get("type") or "").strip().lower() == "device_profile"
        )

        rows = await self._load_rows(self._project_id(graph, params_dict), selected_msisdns, selected_devices)
        if not rows:
            return [self._wrap_graph(graph, data, nodes, edges, {"source_plugin": self.id, "rows_count": 0})]

        for row in rows:
            device_info = normalize_text(row.get("device_info"))
            msisdn = normalize_phone(row.get("user_msisdn"))
            if not device_info or not msisdn:
                continue
            anchor = next(
                (
                    node
                    for node in selected_nodes
                    if normalize_phone(node_label(node)) == msisdn or normalize_text(node_label(node)) == device_info
                ),
                None,
            )
            msisdn_node = self.graph.find_or_create_node(nodes, "person", msisdn, anchor_node=anchor)
            device_node = self.graph.find_or_create_node(nodes, "device_profile", device_info, anchor_node=msisdn_node)
            event_time = format_datetime(row.get("event_time"))
            edge = self.graph.find_existing_edge(edges, node_id(msisdn_node), node_id(device_node), "msisdn_device_link")
            if edge is None:
                edges.append(self.graph.build_edge(edges, node_id(msisdn_node), node_id(device_node), "msisdn_device_link", event_time, self.name))
            else:
                self.graph.merge_edge_event(edge, event_time)

        return [self._wrap_graph(graph, data, nodes, edges, {"source_plugin": self.id, "rows_count": len(rows)})]

    async def _load_rows(self, project_id: int, msisdns: List[str], devices: List[str]) -> List[Dict[str, Any]]:
        if project_id <= 0 or (not msisdns and not devices):
            return []
        clauses: List[str] = []
        params: Dict[str, Any] = {"project_id": project_id}
        if msisdns:
            clauses.append("user_msisdn IN :msisdns")
            params["msisdns"] = msisdns
        if devices:
            clauses.append("device_info IN :devices")
            params["devices"] = devices
        sql = text(
            f"""
            SELECT event_time, user_msisdn, device_info
            FROM project_msisdn_device_facts
            WHERE project_id = :project_id
              AND ({' OR '.join(clauses)})
            ORDER BY event_time ASC
            """
        )
        if msisdns:
            sql = sql.bindparams(bindparam("msisdns", expanding=True))
        if devices:
            sql = sql.bindparams(bindparam("devices", expanding=True))
        async with AsyncSessionLocal() as session:
            result = await session.execute(sql, params)
            return [dict(row) for row in result.mappings().all()]


class MsisdnRecordedAsLinksPlugin(_ProjectDataLinkPluginBase):
    id = "project_msisdn_text_links"
    name = "Записан как..."
    version = "0.2.0"
    description = "Связывает номер из имени файла с агрегированным списком текстовых записей о том, как он назван"

    def is_applicable_with_context(self, input_artifacts: List[Dict[str, Any]], context: Optional[Dict[str, Any]] = None) -> bool:
        if not input_artifacts:
            return False
        graph = input_artifacts[0] if isinstance(input_artifacts[0], dict) else {}
        data = graph.get("data") if isinstance(graph.get("data"), dict) else {}
        selected_nodes = self.graph.selected_nodes(list(data.get("nodes") or []), context)
        return any(str(node.get("type") or "").strip().lower() in PERSON_TYPES.union({"text_bundle"}) for node in selected_nodes)

    async def execute(self, input_artifacts: List[Dict[str, Any]], params: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        graph = input_artifacts[0]
        data = dict(graph.get("data") or {})
        nodes = list(data.get("nodes") or [])
        edges = list(data.get("edges") or [])
        params_dict = params if isinstance(params, dict) else {}
        selected_nodes = self._selected_nodes(graph, params_dict, nodes, self.graph)

        selected_msisdns = self._selected_msisdns(selected_nodes)
        selected_bundles = dedupe_preserve_order(
            normalize_phone(node_label(node).replace("Как записан ", ""))
            for node in selected_nodes
            if str(node.get("type") or "").strip().lower() == "text_bundle"
        )

        rows = await self._load_rows(self._project_id(graph, params_dict), selected_msisdns, selected_bundles)
        if not rows:
            return [self._wrap_graph(graph, data, nodes, edges, {"source_plugin": self.id, "rows_count": 0})]

        grouped: Dict[str, List[Dict[str, Any]]] = {}
        for row in rows:
            file_msisdn = normalize_phone(row.get("file_msisdn"))
            if file_msisdn:
                grouped.setdefault(file_msisdn, []).append(row)

        for file_msisdn, group_rows in grouped.items():
            owner_node = self.graph.find_or_create_node(nodes, "person", file_msisdn)
            lines = dedupe_preserve_order(
                f"{normalize_phone(row.get('user_msisdn'))} {normalize_text(row.get('message_text'))}".strip()
                for row in group_rows
                if normalize_phone(row.get("user_msisdn")) and normalize_text(row.get("message_text"))
            )
            if not lines:
                continue
            text_node = self.graph.find_or_create_node(
                nodes,
                "text_bundle",
                f"Как записан {file_msisdn}",
                anchor_node=owner_node,
                extra_attributes={
                    "file_msisdn": file_msisdn,
                    "text": "\n".join(lines),
                    "rows_count": len(lines),
                },
            )
            edge = self.graph.find_existing_edge(edges, node_id(owner_node), node_id(text_node), "msisdn_text_link")
            event_times = [format_datetime(row.get("event_time")) for row in group_rows if format_datetime(row.get("event_time"))]
            if edge is None:
                edges.append(self.graph.build_edge(edges, node_id(owner_node), node_id(text_node), "msisdn_text_link", event_times[-1] if event_times else "", "записан как"))
                edge = edges[-1]
                if isinstance(edge.get("attributes"), dict):
                    edge["attributes"].setdefault("visual", {})
                    edge["attributes"]["visual"]["direction"] = "to"
                    edge["attributes"]["direction"] = "to"
            for event_time in event_times[:-1] if edge and event_times else event_times:
                self.graph.merge_edge_event(edge, event_time)

        return [self._wrap_graph(graph, data, nodes, edges, {"source_plugin": self.id, "rows_count": len(rows)})]

    async def _load_rows(self, project_id: int, msisdns: List[str], bundle_msisdns: List[str]) -> List[Dict[str, Any]]:
        if project_id <= 0 or (not msisdns and not bundle_msisdns):
            return []
        clauses: List[str] = []
        params: Dict[str, Any] = {"project_id": project_id}
        if msisdns:
            clauses.append("file_msisdn IN :msisdns")
            params["msisdns"] = msisdns
        if bundle_msisdns:
            clauses.append("file_msisdn IN :bundle_msisdns")
            params["bundle_msisdns"] = bundle_msisdns
        sql = text(
            f"""
            SELECT event_time, user_msisdn, file_msisdn, message_text
            FROM project_msisdn_text_facts
            WHERE project_id = :project_id
              AND ({' OR '.join(clauses)})
            ORDER BY event_time ASC
            """
        )
        if msisdns:
            sql = sql.bindparams(bindparam("msisdns", expanding=True))
        if bundle_msisdns:
            sql = sql.bindparams(bindparam("bundle_msisdns", expanding=True))
        async with AsyncSessionLocal() as session:
            result = await session.execute(sql, params)
            return [dict(row) for row in result.mappings().all()]


class AddressBookLinksPlugin(_ProjectDataLinkPluginBase):
    id = "project_address_book_links"
    name = "Адресная книга"
    version = "0.1.0"
    description = "Связывает номер из адресной книги с номером владельца файла"

    def is_applicable_with_context(self, input_artifacts: List[Dict[str, Any]], context: Optional[Dict[str, Any]] = None) -> bool:
        if not input_artifacts:
            return False
        graph = input_artifacts[0] if isinstance(input_artifacts[0], dict) else {}
        data = graph.get("data") if isinstance(graph.get("data"), dict) else {}
        selected_nodes = self.graph.selected_nodes(list(data.get("nodes") or []), context)
        return any(str(node.get("type") or "").strip().lower() in PERSON_TYPES for node in selected_nodes)

    async def execute(self, input_artifacts: List[Dict[str, Any]], params: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        graph = input_artifacts[0]
        data = dict(graph.get("data") or {})
        nodes = list(data.get("nodes") or [])
        edges = list(data.get("edges") or [])
        params_dict = params if isinstance(params, dict) else {}
        selected_nodes = self._selected_nodes(graph, params_dict, nodes, self.graph)
        selected_msisdns = self._selected_msisdns(selected_nodes)

        rows = await self._load_rows(self._project_id(graph, params_dict), selected_msisdns)
        if not rows:
            return [self._wrap_graph(graph, data, nodes, edges, {"source_plugin": self.id, "rows_count": 0})]

        for row in rows:
            owner_msisdn = normalize_phone(row.get("file_msisdn"))
            contact_msisdn = normalize_phone(row.get("user_msisdn"))
            if not owner_msisdn or not contact_msisdn:
                continue
            owner_node = self.graph.find_or_create_node(nodes, "person", owner_msisdn)
            contact_node = self.graph.find_or_create_node(nodes, "person", contact_msisdn, anchor_node=owner_node)
            event_time = format_datetime(row.get("event_time"))
            edge = self.graph.find_existing_edge(edges, node_id(contact_node), node_id(owner_node), "address_book_link")
            if edge is None:
                edges.append(self.graph.build_edge(edges, node_id(contact_node), node_id(owner_node), "address_book_link", event_time, "в адресной книге"))
                edge = edges[-1]
                if isinstance(edge.get("attributes"), dict):
                    edge["attributes"].setdefault("visual", {})
                    edge["attributes"]["visual"]["direction"] = "to"
                    edge["attributes"]["direction"] = "to"
            else:
                self.graph.merge_edge_event(edge, event_time)

        return [self._wrap_graph(graph, data, nodes, edges, {"source_plugin": self.id, "rows_count": len(rows)})]

    async def _load_rows(self, project_id: int, msisdns: List[str]) -> List[Dict[str, Any]]:
        if project_id <= 0 or not msisdns:
            return []
        sql = text(
            """
            SELECT event_time, user_msisdn, file_msisdn, message_text
            FROM project_msisdn_text_facts
            WHERE project_id = :project_id
              AND file_msisdn IN :msisdns
            ORDER BY event_time ASC
            """
        ).bindparams(bindparam("msisdns", expanding=True))
        async with AsyncSessionLocal() as session:
            result = await session.execute(sql, {"project_id": project_id, "msisdns": msisdns})
            return [dict(row) for row in result.mappings().all()]
