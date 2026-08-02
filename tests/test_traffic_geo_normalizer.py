from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from app.import_plugins.traffic_geo_normalizer import iter_normalized_traffic_geo


class TrafficGeoNormalizerTests(unittest.TestCase):
    def test_streaming_normalizer_keeps_communications_and_device_history(self) -> None:
        headers = "abon1;abon2;time_start;time_end;duration_sec;imsi;imei\n"
        rows = "\n".join(
            f"79283100198;7900000000{index};2026-07-01 09:45:0{index};2026-07-01 09:46:0{index};60;250028772665482;86008205035995"
            for index in range(3)
        )
        with tempfile.TemporaryDirectory() as directory:
            (Path(directory) / "traffic.csv").write_text(headers + rows + "\n", encoding="utf-8")
            batches = list(iter_normalized_traffic_geo(Path(directory), batch_size=1))

        self.assertGreaterEqual(len(batches), 3)
        self.assertEqual(sum(len(batch.get("communications", [])) for batch in batches), 3)
        self.assertEqual(sum(len(batch.get("device_history", [])) for batch in batches), 1)


if __name__ == "__main__":
    unittest.main()
