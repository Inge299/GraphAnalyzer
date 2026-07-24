"""Plugin: enrich current graph with abonent details for a selected period."""

from __future__ import annotations

import os
from datetime import date, datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError

from app.services.plugins_config_service import get_plugin_config
from plugins import PluginBase
from plugins.graph_toolkit import GraphPluginToolkit, dedupe_preserve_order, node_label, normalize_phone, normalize_text


def _as_date(value: Any) -> Optional[date]:
    if not isinstance(value, str):
        return None
    try:
        return date.fromisoformat(value)
    except Exception:
        return None


def _format_operator_country(operator_name: str, country: str) -> str:
    if operator_name and country:
        return f"{operator_name}, {country}"
    return operator_name or country


def _format_ownership_line(row_date: str, fio: str, address: str) -> str:
    tail = ", ".join([part for part in [fio, address] if part])
    if row_date and tail:
        return f"{row_date} - {tail}"
    if row_date:
        return row_date
    return tail


def _dedupe_preserve_order(items: List[str]) -> List[str]:
    return dedupe_preserve_order(items)


def _build_mssql_url(db_cfg: Dict[str, Any]) -> str:
    """Build SQLAlchemy URL from plugin config fields.

    Supported auth_type values:
    - "sql": username/password auth
    - "trusted": integrated/trusted connection

    Note: this uses SQLAlchemy style URL. Choose driver in config, for example:
      - mssql+pymssql
      - mssql+pyodbc
    """
    driver = str(db_cfg.get("driver") or "").strip() or "mssql+pymssql"
    host = str(db_cfg.get("host") or "").strip() or "localhost"
    port = int(db_cfg.get("port") or 1433)
    instance = str(db_cfg.get("instance") or "").strip()
    database = str(db_cfg.get("database") or "").strip() or "TestData"
    auth_type = str(db_cfg.get("auth_type") or "sql").strip().lower()

    server = host
    if instance:
        server = f"{host}\\{instance}"

    if auth_type == "trusted":
        return f"{driver}://@{server}:{port}/{database}?trusted_connection=yes"

    username = str(db_cfg.get("username") or "").strip()
    password = str(db_cfg.get("password") or "").strip()
    return f"{driver}://{username}:{password}@{server}:{port}/{database}"


class AbonentPeriodEnricherPlugin(PluginBase):
    id = "abonent_period_enricher"
    name = "Абонентский номер"
    version = "0.2.1"
    description = "Loads abonent records for a period and enriches/creates abonent node in current graph"
    menu_path = "Создать объект"
    input_types = ["graph"]
    output_types = ["graph"]
    applicable_to = ["graph"]
    params_schema = [
        {"key": "phone_number", "label": "Номер абонента", "type": "string", "required": True},
        {"key": "period_start", "label": "Дата начала", "type": "date", "required": True},
        {"key": "period_end", "label": "Дата окончания", "type": "date", "required": True},
    ]
    output_strategy = {
        "mode": "update_current",
        "history_action": "plugin_execute",
    }

    def __init__(self) -> None:
        self.graph = GraphPluginToolkit()

    async def execute(
        self,
        input_artifacts: List[Dict[str, Any]],
        params: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        if not input_artifacts:
            return []

        params = params or {}
        phone_number = normalize_phone(params.get("phone_number"))
        period_start = _as_date(params.get("period_start"))
        period_end = _as_date(params.get("period_end"))

        if not phone_number:
            raise ValueError("Param 'phone_number' is required")
        if period_start is None:
            raise ValueError("Param 'period_start' must be valid date YYYY-MM-DD")
        if period_end is None:
            raise ValueError("Param 'period_end' must be valid date YYYY-MM-DD")
        if period_end < period_start:
            raise ValueError("Param 'period_end' must be greater or equal to 'period_start'")

        graph = input_artifacts[0]
        data = graph.get("data", {}) or {}
        nodes = list(data.get("nodes", []) or [])
        edges = list(data.get("edges", []) or [])

        rows = self._load_rows(phone_number, period_start, period_end)
        operator_lines, ownership_lines = self._aggregate_rows(rows)

        target_node = self._find_person_node(nodes, phone_number)
        if target_node is None:
            target_node = self.graph.find_or_create_node(nodes, "msisdn", phone_number)

        self._merge_attributes(target_node, phone_number, operator_lines, ownership_lines)

        updated_data = dict(data)
        updated_data["nodes"] = nodes
        updated_data["edges"] = edges

        metadata = dict(graph.get("metadata") or {})
        metadata.update(
            {
                "source_plugin": self.id,
                "last_enriched_phone": phone_number,
                "last_period_start": period_start.isoformat(),
                "last_period_end": period_end.isoformat(),
            }
        )

        return [
            {
                "type": "graph",
                "name": graph.get("name", "Graph"),
                "description": graph.get("description"),
                "data": updated_data,
                "metadata": metadata,
            }
        ]

    def _resolve_plugin_sql_config(self) -> Dict[str, Any]:
        cfg = get_plugin_config(self.id)
        return cfg if isinstance(cfg, dict) else {}

    def _resolve_db_url(self) -> str:
        # Backward compatible env var override (highest priority).
        env_url = os.getenv("ABONENTS_DB_URL", "").strip()
        if env_url:
            return env_url

        cfg = self._resolve_plugin_sql_config()
        connection = cfg.get("connection") if isinstance(cfg.get("connection"), dict) else {}

        direct_url = str(connection.get("url") or "").strip()
        if direct_url:
            return direct_url

        db_cfg = connection.get("db") if isinstance(connection.get("db"), dict) else {}
        if db_cfg:
            return _build_mssql_url(db_cfg)

        return ""

    def _resolve_table_name(self) -> str:
        cfg = self._resolve_plugin_sql_config()
        query_cfg = cfg.get("query") if isinstance(cfg.get("query"), dict) else {}
        configured = str(query_cfg.get("table") or "").strip()
        if configured:
            return configured

        env_table = str(os.getenv("ABONENTS_TABLE", "")).strip()
        if env_table:
            return env_table

        return "[TestData].[dbo].[abonents_list]"

    def _load_rows(self, phone_number: str, period_start: date, period_end: date) -> List[Dict[str, str]]:
        db_url = self._resolve_db_url()
        if not db_url:
            return []

        table_name = self._resolve_table_name()
        before_sql = text(
            f"""
            SELECT TOP 1
              [Номер] AS phone_number,
              [Оператор] AS operator_name,
              [ФИО] AS fio,
              [Адрес] AS address_value,
              [Страна] AS country_name,
              [дата] AS event_date
            FROM {table_name}
            WHERE [Номер] = :phone_number
              AND [дата] < :period_start
            ORDER BY [дата] DESC
            """
        )
        period_sql = text(
            f"""
            SELECT
              [Номер] AS phone_number,
              [Оператор] AS operator_name,
              [ФИО] AS fio,
              [Адрес] AS address_value,
              [Страна] AS country_name,
              [дата] AS event_date
            FROM {table_name}
            WHERE [Номер] = :phone_number
              AND [дата] >= :period_start
              AND [дата] <= :period_end
            ORDER BY [дата] ASC
            """
        )


        engine = create_engine(db_url, future=True)
        rows: List[Dict[str, str]] = []
        try:
            with engine.connect() as connection:
                before_rows = connection.execute(
                    before_sql,
                    {
                        "phone_number": phone_number,
                        "period_start": period_start.isoformat(),
                    },
                ).mappings().all()
                period_rows = connection.execute(
                    period_sql,
                    {
                        "phone_number": phone_number,
                        "period_start": period_start.isoformat(),
                        "period_end": period_end.isoformat(),
                    },
                ).mappings().all()

            rows = [*before_rows, *period_rows]
        except SQLAlchemyError:
            return []
        finally:
            engine.dispose()

        normalized_rows: List[Dict[str, str]] = []
        for row in rows:
            event_date_raw = row.get("event_date")
            event_date = self._to_iso_date(event_date_raw)
            normalized_rows.append(
                {
                    "phone_number": normalize_phone(row.get("phone_number")),
                    "operator_name": _normalize_text(row.get("operator_name")),
                    "fio": _normalize_text(row.get("fio")),
                    "address_value": _normalize_text(row.get("address_value")),
                    "country_name": _normalize_text(row.get("country_name")),
                    "event_date": event_date,
                }
            )

        normalized_rows.sort(key=lambda item: item.get("event_date", ""))
        return normalized_rows

    @staticmethod
    def _to_iso_date(value: Any) -> str:
        if isinstance(value, datetime):
            return value.date().isoformat()
        if isinstance(value, date):
            return value.isoformat()
        if isinstance(value, str):
            stripped = value.strip()
            if not stripped:
                return ""
            try:
                return datetime.fromisoformat(stripped).date().isoformat()
            except Exception:
                return stripped
        return ""

    def _aggregate_rows(self, rows: List[Dict[str, str]]) -> tuple[List[str], List[str]]:
        operator_lines = _dedupe_preserve_order(
            [
                _format_operator_country(row.get("operator_name", ""), row.get("country_name", ""))
                for row in rows
            ]
        )

        ownership_lines = _dedupe_preserve_order(
            [
                _format_ownership_line(
                    row.get("event_date", ""),
                    row.get("fio", ""),
                    row.get("address_value", ""),
                )
                for row in rows
            ]
        )

        return operator_lines, ownership_lines

    @staticmethod
    def _find_person_node(nodes: List[Dict[str, Any]], phone_number: str) -> Optional[Dict[str, Any]]:
        normalized = phone_number.strip().lower()
        for node in nodes:
            node_type = str(node.get("type") or "").strip().lower()
            if node_type not in {"msisdn", "person", "abonent", "subscriber"}:
                continue
            current_label = str(node_label(node)).strip().lower()
            if current_label == normalized:
                return node
        return None

    @staticmethod
    def _merge_attributes(
        node: Dict[str, Any],
        phone_number: str,
        operator_lines: List[str],
        ownership_lines: List[str],
    ) -> None:
        attributes = node.get("attributes")
        if not isinstance(attributes, dict):
            attributes = {}
            node["attributes"] = attributes

        visual = attributes.get("visual")
        if not isinstance(visual, dict):
            visual = {}
            attributes["visual"] = visual

        node["label"] = phone_number
        attributes["label"] = phone_number
        visual["label"] = phone_number

        existing_operator = attributes.get("operator") if isinstance(attributes.get("operator"), list) else []
        existing_ownership = attributes.get("ownership") if isinstance(attributes.get("ownership"), list) else []

        attributes["operator"] = _dedupe_preserve_order([*existing_operator, *operator_lines])
        attributes["ownership"] = _dedupe_preserve_order([*existing_ownership, *ownership_lines])
