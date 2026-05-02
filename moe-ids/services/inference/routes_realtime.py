"""
POST /predict/realtime — placeholder for the Phase-5 Redis-Streams consumer.
GET  /predict/sample   — score a random row from the cleaned 6G CSV. Used by
                         the dashboard's /realtime page to simulate a live
                         feed without bringing up a real producer pipeline.
"""

from __future__ import annotations

import os
import random
import time
import uuid

import pandas as pd
from fastapi import APIRouter, HTTPException, status

from moe_ids.gate import EXPERT_NAMES
from moe_ids.schemas import SchemaError
from services.common.auth import AuthDep
from services.common.predictor import PredictorDep

router = APIRouter(tags=["inference"])

_SAMPLE_DF: pd.DataFrame | None = None


def _load_sample_df() -> pd.DataFrame:
    global _SAMPLE_DF
    if _SAMPLE_DF is not None:
        return _SAMPLE_DF
    path = os.environ.get("DATA_6G_PATH", "/app/data/AIoT_6G_CLEANED.csv")
    df = pd.read_csv(path)
    # Drop the label if present — the model never sees it at inference time
    if "Label" in df.columns:
        df = df.drop(columns=["Label"])
    _SAMPLE_DF = df
    return df


@router.post("/predict/realtime")
def predict_realtime() -> dict:
    return {"detail": "Realtime path is implemented in Phase 5 (Redis Streams consumer)."}


@router.get("/predict/sample")
def predict_sample(predictor: PredictorDep, _auth: AuthDep) -> dict:
    """
    Score a random row from the cleaned 6G dataset and return it as a single
    'flow' record + verdict. Lets the dashboard simulate a live feed.
    """
    try:
        df = _load_sample_df()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Sample dataset unavailable: {exc}",
        )

    if df.empty:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Sample dataset is empty.",
        )

    row_idx = random.randint(0, len(df) - 1)
    row = df.iloc[[row_idx]]

    try:
        result = predictor.predict(row)
    except SchemaError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Prediction error: {exc}",
        )

    pred = int(result.predictions[0])
    proba = float(result.probabilities[0])
    weights = result.gate_weights[0].tolist()
    dominant = EXPERT_NAMES[int(weights.index(max(weights)))] if weights else "—"

    # Pick a small subset of columns to surface as the "flow record"
    preview_cols = [c for c in row.columns if c.lower() in {
        "src_ip", "dst_ip", "src_port", "dst_port", "protocol",
        "flow_duration", "tot_fwd_pkts", "tot_bwd_pkts",
    }][:8]
    preview = (
        row[preview_cols].iloc[0].to_dict() if preview_cols else {}
    )

    return {
        "request_id": str(uuid.uuid4()),
        "ts_ms": int(time.time() * 1000),
        "row_index": row_idx,
        "verdict": pred,
        "probability": round(proba, 6),
        "dominant_expert": dominant,
        "gate_weights": [round(w, 4) for w in weights],
        "expert_order": EXPERT_NAMES,
        "model_version": result.model_version,
        "preview": {k: (None if pd.isna(v) else v) for k, v in preview.items()},
    }

def predict_realtime() -> dict:
    return {"detail": "Realtime path is implemented in Phase 5 (Redis Streams consumer)."}
