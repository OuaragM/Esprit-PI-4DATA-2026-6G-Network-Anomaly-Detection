"""
POST /predict/realtime — placeholder for the Phase-5 Redis-Streams consumer.
GET  /predict/sample   — generates ONE synthetic flow via FlowGenerator and
                         scores it. Used by the dashboard's /realtime page
                         to simulate a live feed.

The generator (moe_ids.flow_generator.FlowGenerator) loads the cleaned 6G
dataset once and samples-and-perturbs from it according to a scenario knob
("benign" / "syn_flood" / "port_scan" / "ddos" / "exfiltration" / "mixed").
"""

from __future__ import annotations

import os
import time
import uuid

from fastapi import APIRouter, HTTPException, Query, status

from moe_ids.flow_generator import FlowGenerator
from moe_ids.gate import EXPERT_NAMES
from moe_ids.schemas import SchemaError
from services.common.auth import AuthDep
from services.common.predictor import PredictorDep

router = APIRouter(tags=["inference"])

_GENERATOR: FlowGenerator | None = None


def _get_generator() -> FlowGenerator:
    global _GENERATOR
    if _GENERATOR is not None:
        return _GENERATOR
    path_6g = os.environ.get("DATA_6G_PATH", "/app/data/AIoT_6G_CLEANED.csv")
    path_5g = os.environ.get("DATA_5G_PATH", "/app/data/Global_CLEANED.csv")
    seed = int(os.environ.get("FLOW_GENERATOR_SEED", "42"))
    _GENERATOR = FlowGenerator(path_6g, data_5g_path=path_5g, seed=seed)
    return _GENERATOR


@router.post("/predict/realtime")
def predict_realtime() -> dict:
    return {"detail": "Realtime path is implemented in Phase 5 (Redis Streams consumer)."}


@router.get("/predict/sample")
def predict_sample(
    predictor: PredictorDep,
    _auth: AuthDep,
    scenario: str = Query("mixed"),
    attack_rate: float = Query(0.15, ge=0.0, le=1.0),
) -> dict:
    """
    Generate one synthetic flow + score it.

    Query params:
      scenario     — benign | syn_flood | port_scan | ddos | exfiltration | mixed
      attack_rate  — only used when scenario=mixed (probability that the next
                     flow is an attack). Range [0, 1].
    """
    if scenario not in FlowGenerator.SCENARIOS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown scenario {scenario!r}. Allowed: {FlowGenerator.SCENARIOS}",
        )

    try:
        gen = _get_generator()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Flow generator unavailable: {exc}",
        )

    try:
        row, meta = gen.generate(scenario=scenario, attack_rate=attack_rate)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Flow generation failed: {exc}",
        )

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
    correct = (pred == meta["ground_truth"])

    return {
        "request_id": str(uuid.uuid4()),
        "ts_ms": int(time.time() * 1000),
        "verdict": pred,
        "probability": round(proba, 6),
        "dominant_expert": dominant,
        "gate_weights": [round(w, 4) for w in weights],
        "expert_order": EXPERT_NAMES,
        "model_version": result.model_version,
        # Synthesised non-feature metadata for the UI
        "flow": meta,
        "ground_truth": meta["ground_truth"],
        "correct": correct,
    }
