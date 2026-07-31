from app.config import settings
from app.services.cell_tower_reference_provider import get_cell_tower_reference_provider_status


def test_cell_tower_provider_requires_dsn(monkeypatch):
    monkeypatch.setattr(settings, "CELL_TOWER_REFERENCE_DSN", "")
    monkeypatch.setattr(settings, "CELL_TOWER_REFERENCE_TABLE", "cell_tower_reference")

    status = get_cell_tower_reference_provider_status()

    assert status.enabled is False
    assert "DSN" in status.detail


def test_cell_tower_provider_accepts_safe_external_table(monkeypatch):
    monkeypatch.setattr(settings, "CELL_TOWER_REFERENCE_DSN", "postgresql://reference-host/cells")
    monkeypatch.setattr(settings, "CELL_TOWER_REFERENCE_TABLE", "reference.cell_tower_reference")

    status = get_cell_tower_reference_provider_status()

    assert status.enabled is True
    assert status.provider_id == "external_postgres_cell_towers"