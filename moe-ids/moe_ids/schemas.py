from __future__ import annotations

from typing import Literal

import pandas as pd


class SchemaError(ValueError):
    pass


# Signature columns used to fingerprint each schema.
# Matching rule: at least 80% of these must be present.
ARGUS_SIGNATURE_COLUMNS: list[str] = [
    "Dur",
    "TotPkts_log",
    "SrcPkts_log",
    "Load_log",
    "Rate_log",
    "Proto_tcp",
    "Proto_udp",
    "State_FIN",
]

# Raw Argus/CICIDS-like exports used in some datasets (e.g. Global.csv).
# We keep a separate signature so we can accept those files without forcing
# users to pre-transform columns before upload.
ARGUS_RAW_SIGNATURE_COLUMNS: list[str] = [
    "Dur",
    "Proto",
    "sTos",
    "dTos",
    "sDSb",
    "dDSb",
    "sTtl",
    "dTtl",
    "Seq",
]

CIC_SIGNATURE_COLUMNS: list[str] = [
    "Flow Duration",
    "Total Fwd Packets",
    "Flow Bytes/s",
    "Fwd Packet Length Mean",
    "Bwd Packet Length Mean",
    "Flow Packets/s",
    "SYN Flag Count",
]


def _normalize_columns(df: pd.DataFrame) -> set[str]:
    """Normalize column names for robust schema matching.

    We strip whitespace and lower-case names so CSV exports with minor naming
    differences still map to the right schema.
    """
    return {
        str(c).strip().lower()
        for c in df.columns
        if str(c).strip() and not str(c).lower().startswith("unnamed:")
    }


def _hit_rate(normalized_cols: set[str], signature: list[str]) -> float:
    target = {c.strip().lower() for c in signature}
    return sum(c in normalized_cols for c in target) / max(len(target), 1)


def detect_schema(df: pd.DataFrame) -> Literal["argus", "cic", "unknown"]:
    """Return 'argus', 'cic', or 'unknown' based on robust column overlap.

    Rules:
    - Argus preprocessed signature: >= 80%
    - Argus raw-export signature: >= 70%
    - CIC signature: >= 80%
    """
    cols = _normalize_columns(df)

    argus_processed_hit = _hit_rate(cols, ARGUS_SIGNATURE_COLUMNS)
    argus_raw_hit = _hit_rate(cols, ARGUS_RAW_SIGNATURE_COLUMNS)
    argus_hit = max(argus_processed_hit, argus_raw_hit)
    cic_hit = _hit_rate(cols, CIC_SIGNATURE_COLUMNS)

    if (argus_processed_hit >= 0.80 or argus_raw_hit >= 0.70) and argus_hit >= cic_hit:
        return "argus"
    if cic_hit >= 0.80:
        return "cic"
    return "unknown"


def validate_input(df: pd.DataFrame, schema: Literal["argus", "cic"]) -> None:
    """Raise SchemaError listing missing required columns for the detected schema."""
    required = ARGUS_SIGNATURE_COLUMNS if schema == "argus" else CIC_SIGNATURE_COLUMNS
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise SchemaError(
            f"Schema '{schema}' detected but {len(missing)} required column(s) are missing: "
            + ", ".join(missing)
        )
