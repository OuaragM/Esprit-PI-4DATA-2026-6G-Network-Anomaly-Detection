"""
Synthetic flow generator for the dashboard's /realtime page.

Strategy: route benign flows to the 6G dataset (one-class baseline) and route
attack flows to the 5G dataset (which has real, labelled attacks). The MoE
predictor auto-detects schema per row, so a mixed feed of CIC (6G) and Argus
(5G) rows is fine — each row is routed to the right projection.

Why not perturb benign rows for attacks?
  We tried that earlier (raw-column multipliers mirroring inject_unified
  anomalies) and the perturbation collapsed after log-transform + scaling,
  producing rows the model correctly classified as benign. Real labelled
  attack rows hit the model's calibrated decision boundary cleanly.

Falls back to perturbed-benign attacks only if the 5G dataset is unavailable.
"""
from __future__ import annotations

import re
import uuid
from pathlib import Path
from threading import Lock
from typing import Iterable

import numpy as np
import pandas as pd

# Heuristic raw-column patterns (case-insensitive, regex). Used only when the
# fallback "perturb benign" path is taken.
_COLUMN_PATTERNS = {
    "syn":       [r"\bsyn\b", r"\bsyn_flag", r"\bs_flag"],
    "rst":       [r"\brst\b", r"\brst_flag", r"\br_flag"],
    "duration":  [r"\bdur(ation)?\b", r"\bflow_duration"],
    "pkt_rate":  [r"\bpkts?_?(/|per)?_?s\b", r"\bflow_pkts", r"\brate\b", r"\bsrcrate"],
    "byte_rate": [r"\bbyts?_?(/|per)?_?s\b", r"\bflow_byts", r"\bload\b", r"\bsrcload"],
    "fwd_pkts":  [r"\bfwd_pkts", r"\btot_fwd_pkts", r"\bsrcpkts"],
    "bwd_size":  [r"\bbwd_pkt_len_mean", r"\bbwd_mean", r"\bdstmeanpktsz"],
}


def _find_columns(columns: Iterable[str], patterns: list[str]) -> list[str]:
    out: list[str] = []
    for pat in patterns:
        rgx = re.compile(pat, re.IGNORECASE)
        for col in columns:
            if rgx.search(col) and col not in out:
                out.append(col)
    return out


def _fake_ipv4(rng: np.random.Generator, internal: bool) -> str:
    if internal:
        return f"10.{rng.integers(0, 255)}.{rng.integers(0, 255)}.{rng.integers(1, 254)}"
    first = int(rng.integers(11, 224))
    while first in (127, 169, 172, 192):
        first = int(rng.integers(11, 224))
    return f"{first}.{rng.integers(0, 255)}.{rng.integers(0, 255)}.{rng.integers(1, 254)}"


_COMMON_PORTS = (22, 25, 53, 80, 110, 143, 443, 465, 587, 993, 995, 3306, 5432, 8080, 8443)


def _fake_port(rng: np.random.Generator, scenario: str) -> int:
    if scenario == "port_scan":
        return int(rng.integers(1, 65536))
    if scenario in ("ddos", "syn_flood"):
        return int(rng.choice([80, 443, 8080, 8443]))
    if scenario == "exfiltration":
        return int(rng.choice([4444, 8888, 9999, 31337]))
    return int(rng.choice(_COMMON_PORTS))


# Fallback raw-perturbation profile (only used when 5G attacks are unavailable)
_PERTURBATIONS: dict[str, list[tuple[str, float]]] = {
    "syn_flood":    [("syn", 8.0), ("pkt_rate", 8.0), ("duration", 0.1)],
    "port_scan":    [("rst", 6.0), ("duration", 0.2), ("pkt_rate", 3.0)],
    "ddos":         [("byte_rate", 10.0), ("pkt_rate", 10.0), ("fwd_pkts", 6.0)],
    "exfiltration": [("bwd_size", 5.0), ("byte_rate", 4.0)],
}


def _load_split(csv_path: str | Path, label_col: str = "Label") -> tuple[pd.DataFrame, pd.DataFrame]:
    """Load a CSV, return (benign, attack) frames split by Label column.
    Tolerates differently-named label columns and missing labels."""
    df = pd.read_csv(csv_path)
    if len(df) == 0:
        raise ValueError(f"FlowGenerator: dataset at {csv_path} is empty")
    if label_col not in df.columns:
        for candidate in ("Label", "label", "Class", "class", "y"):
            if candidate in df.columns:
                label_col = candidate
                break
    if label_col in df.columns:
        benign = df[df[label_col] == 0].drop(columns=[label_col]).reset_index(drop=True)
        attack = df[df[label_col] == 1].drop(columns=[label_col]).reset_index(drop=True)
    else:
        benign = df.copy()
        attack = df.iloc[0:0].copy()
    return benign, attack


class FlowGenerator:
    """Sample-based generator. One instance per process; thread-safe."""

    SCENARIOS = ("benign", "syn_flood", "port_scan", "ddos", "exfiltration", "mixed")

    def __init__(
        self,
        data_6g_path: str | Path,
        data_5g_path: str | Path | None = None,
        seed: int = 42,
    ):
        self._lock = Lock()
        self._rng = np.random.default_rng(seed)

        # 6G — benign source of truth (the cleaned 6G dataset is one-class)
        benign_6g, _attack_6g = _load_split(data_6g_path)
        if len(benign_6g) == 0:
            # 6G with all attacks would be unusual, but fall back to full frame
            benign_6g = pd.read_csv(data_6g_path)
        self._benign = benign_6g

        # 5G — attack pool (real, labelled)
        self._attack: pd.DataFrame
        if data_5g_path is not None:
            try:
                _benign_5g, attack_5g = _load_split(data_5g_path)
                self._attack = attack_5g
            except Exception:
                self._attack = pd.DataFrame()
        else:
            self._attack = pd.DataFrame()

        # Pre-compute column matches on the benign frame for the fallback path
        self._matched: dict[str, list[str]] = {
            key: _find_columns(self._benign.columns, pats)
            for key, pats in _COLUMN_PATTERNS.items()
        }

    # ── helpers ──────────────────────────────────────────────────────────

    def _seed(self) -> int:
        return int(self._rng.integers(0, 2**31 - 1))

    def _sample_benign(self) -> pd.DataFrame:
        if len(self._benign) == 0:
            raise RuntimeError("FlowGenerator: no benign rows available to sample")
        return self._benign.sample(1, random_state=self._seed()).reset_index(drop=True)

    def _sample_real_attack(self) -> pd.DataFrame | None:
        if len(self._attack) == 0:
            return None
        return self._attack.sample(1, random_state=self._seed()).reset_index(drop=True)

    def _jitter(self, row: pd.DataFrame, sigma: float = 0.02) -> pd.DataFrame:
        """Multiplicative gaussian jitter on numeric, non-binary columns."""
        for col in row.select_dtypes(include=[np.number]).columns:
            try:
                # Don't jitter binary flags
                pool = self._benign if col in self._benign.columns else self._attack
                if col in pool.columns:
                    vals = pool[col].dropna().unique()
                    if set(vals).issubset({0, 1, 0.0, 1.0}):
                        continue
            except Exception:
                pass
            v = row[col].iloc[0]
            row[col] = v * (1.0 + self._rng.normal(0.0, sigma))
        return row

    def _perturb_raw(self, row: pd.DataFrame, scenario: str) -> pd.DataFrame:
        """Fallback: raw-column multipliers when no real-attack pool exists."""
        for key, mul in _PERTURBATIONS.get(scenario, []):
            for col in self._matched.get(key, []):
                if col in row.columns:
                    row[col] = row[col] * mul
        return row

    # ── public API ───────────────────────────────────────────────────────

    def generate(
        self,
        scenario: str = "mixed",
        attack_rate: float = 0.15,
    ) -> tuple[pd.DataFrame, dict]:
        if scenario not in self.SCENARIOS:
            scenario = "mixed"
        attack_rate = max(0.0, min(1.0, float(attack_rate)))

        with self._lock:
            resolved: str
            is_attack: bool

            if scenario == "benign":
                row = self._sample_benign()
                resolved = "benign"
                is_attack = False

            elif scenario == "mixed":
                if self._rng.random() < attack_rate:
                    resolved = str(self._rng.choice(
                        ["syn_flood", "port_scan", "ddos", "exfiltration"]
                    ))
                    real = self._sample_real_attack()
                    if real is not None:
                        row = real
                    else:
                        row = self._perturb_raw(self._sample_benign(), resolved)
                    is_attack = True
                else:
                    row = self._sample_benign()
                    resolved = "benign"
                    is_attack = False

            else:
                # Specific named attack scenario — prefer real attack rows
                resolved = scenario
                real = self._sample_real_attack()
                if real is not None:
                    row = real
                else:
                    row = self._perturb_raw(self._sample_benign(), scenario)
                is_attack = True

            row = self._jitter(row)

            meta = {
                "flow_id": uuid.uuid4().hex[:8],
                "src_ip": _fake_ipv4(self._rng, internal=True),
                "dst_ip": _fake_ipv4(self._rng, internal=not is_attack and self._rng.random() < 0.5),
                "src_port": int(self._rng.integers(1024, 65535)),
                "dst_port": _fake_port(self._rng, resolved),
                "scenario": resolved,
                "ground_truth": 1 if is_attack else 0,
                # Useful for debugging the source of each flow
                "source": "5g_real_attack" if (is_attack and len(self._attack) > 0)
                          else "6g_benign" if not is_attack
                          else "perturbed_benign",
            }
            return row, meta
