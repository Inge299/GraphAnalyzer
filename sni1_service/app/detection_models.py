from __future__ import annotations

from dataclasses import dataclass, field

VPN_CLEAN = "CLEAN"
VPN_SUSPICIOUS = "VPN_SUSPICIOUS"
VPN_LIKELY = "VPN_LIKELY"
VPN_DETECTED = "VPN_DETECTED"

HARD_SCORE = 100
VPN_LIKELY_THRESHOLD = 60
VPN_SUSPICIOUS_THRESHOLD = 20


@dataclass
class DetectionResult:
    method: str
    score: int
    evidence: str
    confidence: float | None = None
    hard: bool = False
    meta: dict = field(default_factory=dict)


@dataclass
class DetectionDecision:
    verdict: str
    total_score: int
    confidence: float
    methods_triggered: list[str]
    evidence: list[str]
    suppression_applied: list[str]
