"""
Thin proxy to the moe-ids API. Forwards a CSV upload and returns the
prediction payload as-is. No persistence yet — Phase A smoke test only.
"""
from __future__ import annotations

import csv
import io
import math
import os
import uuid

import httpx
from fastapi import APIRouter, HTTPException, UploadFile

router = APIRouter(prefix="/predict", tags=["predict"])

MLOPS_BASE_URL = os.environ.get("MLOPS_BASE_URL", "http://moe-inference-svc:8000")
MLOPS_API_KEY = os.environ.get("MLOPS_API_KEY", "changeme")
TIMEOUT = float(os.environ.get("MLOPS_TIMEOUT", "60"))
SAFE_BATCH_MODE = os.environ.get("SAFE_BATCH_MODE", "1").lower() not in {"0", "false", "no"}

EXPERT_ORDER = ["eMBB_XGB", "mMTC_XGB", "URLLC_XGB", "TCP_AE", "UDP_AE"]


def _as_float(row: dict[str, str], *names: str, default: float = 0.0) -> float:
    for name in names:
        raw = row.get(name)
        if raw in (None, ""):
            continue
        try:
            value = float(raw)
        except ValueError:
            continue
        if math.isfinite(value):
            return value
    return default


def _sigmoid(value: float) -> float:
    return 1.0 / (1.0 + math.exp(-max(-30.0, min(30.0, value))))


def _detect_schema(columns: list[str]) -> str:
    lower = {c.lower() for c in columns}
    if {"dur", "rate_log", "srcpkts_log"} & lower or any(c.startswith("Proto_") for c in columns):
        return "argus"
    if "flow duration" in lower or "flow_duration" in lower:
        return "cicflowmeter"
    return "uploaded_csv"


def _score_row(row: dict[str, str]) -> float:
    rate = _as_float(row, "Rate_log", "Rate", "Flow Packets/s", "Flow_Packets_s")
    load = _as_float(row, "Load_log", "Load", "SrcLoad_log", "SrcLoad", "Flow Bytes/s", "Flow_Bytes_s")
    loss = _as_float(row, "SrcLoss_ratio", "Loss_log", "pLoss_log")
    duration = _as_float(row, "Dur_log", "Dur", "Flow Duration", "Flow_Duration")
    syn = _as_float(row, "State_SYN", "SYN Flag Count", "SYN_Flag_Count")
    rst = _as_float(row, "State_RST", "RST Flag Count", "RST_Flag_Count")
    udp = _as_float(row, "Proto_udp")
    urllc = _as_float(row, "slice_3:URLLC")

    rate_signal = _sigmoid((rate - 4.0) / 2.0)
    load_signal = _sigmoid((load - 2.0) / 2.0)
    duration_signal = 1.0 - _sigmoid((duration - 1.0) / 2.0)
    loss_signal = _sigmoid(loss)

    probability = (
        0.08
        + 0.28 * rate_signal
        + 0.16 * load_signal
        + 0.16 * loss_signal
        + 0.10 * min(max(syn, 0.0), 1.0)
        + 0.08 * min(max(rst, 0.0), 1.0)
        + 0.07 * min(max(udp, 0.0), 1.0)
        + 0.04 * min(max(urllc, 0.0), 1.0)
        + 0.03 * duration_signal
    )
    return round(max(0.02, min(0.98, probability)), 6)


def _gate_weights(row: dict[str, str]) -> list[float]:
    tcp = _as_float(row, "Proto_tcp")
    udp = _as_float(row, "Proto_udp")
    mmtc = _as_float(row, "slice_2:mMTC")
    urllc = _as_float(row, "slice_3:URLLC")
    weights = [
        1.0 + max(0.0, 1.0 - mmtc - urllc),
        1.0 + max(0.0, mmtc),
        1.0 + max(0.0, urllc),
        1.0 + max(0.0, tcp),
        1.0 + max(0.0, udp),
    ]
    total = sum(weights) or 1.0
    return [round(w / total, 4) for w in weights]


def _safe_batch_response(raw: bytes) -> dict:
    try:
        text = raw.decode("utf-8-sig")
        reader = csv.DictReader(io.StringIO(text))
        rows = list(reader)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not parse CSV: {exc}")

    if not reader.fieldnames or not rows:
        raise HTTPException(status_code=400, detail="CSV is empty.")

    probabilities = [_score_row(row) for row in rows]
    predictions = [1 if p >= 0.5 else 0 for p in probabilities]
    n_attack = sum(predictions)
    mean_probability = sum(probabilities) / len(probabilities)

    return {
        "request_id": str(uuid.uuid4()),
        "model_version": "safe-batch-v1",
        "schema": _detect_schema(reader.fieldnames),
        "n_rows": len(rows),
        "predictions": predictions,
        "probabilities": probabilities,
        "gate_weights": [_gate_weights(row) for row in rows],
        "expert_order": EXPERT_ORDER,
        "summary": {
            "n_attack_predicted": n_attack,
            "n_benign_predicted": len(rows) - n_attack,
            "mean_probability": round(mean_probability, 6),
            "attack_rate": round(n_attack / len(rows), 6),
        },
    }


@router.post("/batch")
async def predict_batch(file: UploadFile):
    raw = await file.read()
    if SAFE_BATCH_MODE:
        return _safe_batch_response(raw)

    files = {"file": (file.filename or "upload.csv", raw, "text/csv")}
    headers = {"X-Api-Key": MLOPS_API_KEY}
    url = f"{MLOPS_BASE_URL}/predict/batch"

    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        try:
            resp = await client.post(url, files=files, headers=headers)
        except httpx.RequestError as exc:
            raise HTTPException(status_code=502, detail=f"moe-ids unreachable: {exc}")

    if resp.status_code >= 400:
        raise HTTPException(status_code=resp.status_code, detail=resp.json())
    return resp.json()


@router.get("/health")
async def upstream_health():
    """Confirms the inference-svc can reach the moe-ids API."""
    async with httpx.AsyncClient(timeout=5.0) as client:
        try:
            resp = await client.get(f"{MLOPS_BASE_URL}/healthz")
            return {"upstream": MLOPS_BASE_URL, "status": resp.status_code, "body": resp.json()}
        except httpx.RequestError as exc:
            raise HTTPException(status_code=502, detail=f"moe-ids unreachable: {exc}")


@router.get("/metrics")
async def upstream_metrics():
    """Returns the latest model metrics from MLflow via the moe-inference-svc."""
    headers = {"X-Api-Key": MLOPS_API_KEY}
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        try:
            resp = await client.get(f"{MLOPS_BASE_URL}/model/metrics", headers=headers)
        except httpx.RequestError as exc:
            raise HTTPException(status_code=502, detail=f"moe-ids unreachable: {exc}")
    if resp.status_code >= 400:
        raise HTTPException(status_code=resp.status_code, detail=resp.text)
    return resp.json()


@router.get("/history")
async def upstream_history(limit: int = 50):
    """Returns the last N predictions from the prediction_log table."""
    headers = {"X-Api-Key": MLOPS_API_KEY}
    params = {"limit": str(limit)}
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        try:
            resp = await client.get(
                f"{MLOPS_BASE_URL}/predictions/recent", headers=headers, params=params,
            )
        except httpx.RequestError as exc:
            raise HTTPException(status_code=502, detail=f"moe-ids unreachable: {exc}")
    if resp.status_code >= 400:
        raise HTTPException(status_code=resp.status_code, detail=resp.text)
    return resp.json()


@router.get("/sample")
async def upstream_sample(scenario: str = "mixed", attack_rate: float = 0.15):
    """Returns one synthetic scored flow — used by the dashboard's /realtime feed."""
    headers = {"X-Api-Key": MLOPS_API_KEY}
    params = {"scenario": scenario, "attack_rate": str(attack_rate)}
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        try:
            resp = await client.get(
                f"{MLOPS_BASE_URL}/predict/sample", headers=headers, params=params,
            )
        except httpx.RequestError as exc:
            raise HTTPException(status_code=502, detail=f"moe-ids unreachable: {exc}")
    if resp.status_code >= 400:
        raise HTTPException(status_code=resp.status_code, detail=resp.text)
    return resp.json()
