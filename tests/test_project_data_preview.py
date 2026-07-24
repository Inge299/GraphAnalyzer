from app.services.project_data_service import _preview_converted_csv


def test_preview_converted_csv_counts_rows_and_limits_sample(tmp_path):
    source = tmp_path / "preview.csv"
    source.write_text("id;name\n1;one\n2;two\n3;three\n", encoding="utf-8")

    result = _preview_converted_csv(source, limit=2)

    assert result["row_count"] == 3
    assert result["columns"] == ["id", "name"]
    assert result["sample_rows"] == [
        {"id": "1", "name": "one"},
        {"id": "2", "name": "two"},
    ]


def test_preview_converted_csv_handles_missing_file(tmp_path):
    result = _preview_converted_csv(tmp_path / "missing.csv")

    assert result == {"row_count": 0, "columns": [], "sample_rows": []}
