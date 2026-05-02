"""
GET /predictions/recent — list the last N batch predictions from the
prediction_log Postgres table that routes_batch.py writes to.

Read-only summary view (does NOT include the full predictions/probabilities
arrays). The frontend keeps the full payload in localStorage for /results/[id];
this endpoint only powers the cross-device /history list.
"""
from __future__ import annotations

from fastapi import APIRouter, Query

from moe_ids.config import settings
from services.common.auth import AuthDep
from services.common.db import list_predictions

router = APIRouter(tags=["history"])


@router.get("/predictions/recent")
def predictions_recent(
    _auth: AuthDep,
    limit: int = Query(50, ge=1, le=500),
) -> dict:
    rows = list_predictions(settings.monitoring_db_url or None, limit=limit)
    items = [
        {
            "request_id": r["request_id"],
            "ts_ms": int(r["ts"].timestamp() * 1000) if r.get("ts") else None,
            "model_version": r.get("model_version"),
            "schema": r.get("schema"),
            "n_rows": r.get("n_rows"),
            "n_attack": r.get("n_attack"),
            "n_benign": r.get("n_benign"),
            "mean_probability": r.get("mean_probability"),
            "attack_rate": r.get("attack_rate"),
        }
        for r in rows
    ]
    return {"count": len(items), "items": items}
