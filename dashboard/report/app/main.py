"""
report-svc — generates a PDF scan report from a BatchPrediction payload.

Designed as a stateless renderer: the frontend POSTs the prediction it already
has cached locally (localStorage) and gets a PDF back. No DB lookup; no MinIO
round-trip. If/when prediction history moves server-side, this service can be
extended to look up by request_id instead of receiving the full payload.
"""
from __future__ import annotations

import io
from datetime import datetime, timezone
from typing import Any

from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle, PageBreak,
)

app = FastAPI(title="report-svc", version="0.2.0")


# ── Schemas ──────────────────────────────────────────────────────────────


class BatchSummary(BaseModel):
    n_attack_predicted: int
    n_benign_predicted: int
    mean_probability: float
    attack_rate: float


class BatchPrediction(BaseModel):
    request_id: str
    model_version: str
    schema: str
    n_rows: int
    predictions: list[int]
    probabilities: list[float]
    gate_weights: list[list[float]]
    expert_order: list[str]
    summary: BatchSummary


class ReportRequest(BaseModel):
    prediction: BatchPrediction
    filename: str | None = None         # original CSV filename (cosmetic)
    user_email: str | None = None
    generated_at_ms: int | None = None  # client clock — fall back to server


# ── Routes ──────────────────────────────────────────────────────────────


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "report-svc"}


@app.post("/report/pdf")
async def report_pdf(
    req: ReportRequest,
    x_user_id: str | None = Header(default=None),
    x_user_role: str | None = Header(default=None),
) -> Response:
    """Render `req.prediction` as a multi-page A4 PDF and return it inline."""
    try:
        pdf_bytes = _build_pdf(req, x_user_id, x_user_role)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"PDF render failed: {exc}")

    fname = f"scan-{req.prediction.request_id[:8]}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


# ── Renderer ────────────────────────────────────────────────────────────


def _build_pdf(
    req: ReportRequest,
    user_id: str | None,
    user_role: str | None,
) -> bytes:
    pred = req.prediction
    summary = pred.summary
    generated_at = (
        datetime.fromtimestamp(req.generated_at_ms / 1000, tz=timezone.utc)
        if req.generated_at_ms
        else datetime.now(tz=timezone.utc)
    )

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=18 * mm, rightMargin=18 * mm,
        topMargin=18 * mm,  bottomMargin=18 * mm,
        title=f"MoE IDS Scan Report — {pred.request_id[:8]}",
        author=req.user_email or user_id or "MoE IDS",
    )

    styles = getSampleStyleSheet()
    h1 = styles["Heading1"]
    h2 = styles["Heading2"]
    body = styles["BodyText"]
    mono = ParagraphStyle("mono", parent=body, fontName="Courier", fontSize=8)
    muted = ParagraphStyle("muted", parent=body, fontSize=9, textColor=colors.HexColor("#6b6f76"))

    story: list[Any] = []

    # ── Header ────────────────────────────────────────────────────────────
    story.append(Paragraph("MoE IDS — Scan report", h1))
    story.append(Paragraph(
        f"Request <b>{pred.request_id}</b><br/>"
        f"Generated {generated_at.strftime('%Y-%m-%d %H:%M:%S UTC')}",
        muted,
    ))
    story.append(Spacer(1, 8))

    # ── Run metadata table ────────────────────────────────────────────────
    meta_rows = [
        ["Filename", req.filename or "—"],
        ["By", req.user_email or user_id or "—"],
        ["Role", user_role or "—"],
        ["Schema", pred.schema],
        ["Model version", pred.model_version],
        ["Rows scored", str(pred.n_rows)],
    ]
    meta = Table(meta_rows, colWidths=[40 * mm, None])
    meta.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#6b6f76")),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("LINEBELOW", (0, 0), (-1, -2), 0.4, colors.HexColor("#e3e5e8")),
    ]))
    story.append(meta)
    story.append(Spacer(1, 14))

    # ── Verdict summary ──────────────────────────────────────────────────
    story.append(Paragraph("Verdict summary", h2))
    summary_rows = [
        ["Metric", "Value"],
        ["Attacks predicted",   str(summary.n_attack_predicted)],
        ["Benign predicted",    str(summary.n_benign_predicted)],
        ["Mean probability",    f"{summary.mean_probability:.4f}"],
        ["Attack rate",         f"{summary.attack_rate * 100:.2f}%"],
    ]
    summary_tbl = Table(summary_rows, colWidths=[60 * mm, 40 * mm])
    summary_tbl.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f3f4f6")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#1f2937")),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 6),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#e3e5e8")),
        ("ALIGN", (1, 1), (1, -1), "RIGHT"),
    ]))
    story.append(summary_tbl)
    story.append(Spacer(1, 14))

    # ── Per-row predictions table ────────────────────────────────────────
    story.append(Paragraph("Per-row predictions", h2))
    story.append(Paragraph(
        f"Showing all {pred.n_rows} rows. Dominant expert highlighted in bold.",
        muted,
    ))
    story.append(Spacer(1, 4))

    header = ["#", "Verdict", "Prob.", "Dom. expert", *pred.expert_order]
    rows: list[list[Any]] = [header]
    for i, (verdict, prob, weights) in enumerate(zip(
        pred.predictions, pred.probabilities, pred.gate_weights,
    )):
        dom = weights.index(max(weights)) if weights else -1
        dom_name = pred.expert_order[dom] if 0 <= dom < len(pred.expert_order) else "—"
        weight_cells = [
            (
                Paragraph(f"<b>{w:.3f}</b>", mono) if k == dom
                else Paragraph(f"{w:.3f}", mono)
            )
            for k, w in enumerate(weights)
        ]
        rows.append([
            str(i).zfill(4),
            "attack" if verdict == 1 else "benign",
            f"{prob:.4f}",
            dom_name,
            *weight_cells,
        ])

    n_expert_cols = len(pred.expert_order)
    col_widths = [12 * mm, 16 * mm, 16 * mm, 22 * mm] + [(120 - 22) * mm / max(n_expert_cols, 1)] * n_expert_cols
    pred_tbl = Table(rows, colWidths=col_widths, repeatRows=1)
    style = TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("FONTNAME", (0, 1), (-1, -1), "Courier"),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f3f4f6")),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 8),
        ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#e3e5e8")),
        ("ALIGN", (2, 1), (-1, -1), "RIGHT"),
        ("ALIGN", (0, 1), (0, -1), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ])
    # Attack rows tinted
    for i, verdict in enumerate(pred.predictions, start=1):
        if verdict == 1:
            style.add("BACKGROUND", (1, i), (1, i), colors.HexColor("#fee2e2"))
            style.add("TEXTCOLOR",  (1, i), (1, i), colors.HexColor("#b91c1c"))
        else:
            style.add("TEXTCOLOR",  (1, i), (1, i), colors.HexColor("#16a34a"))
    pred_tbl.setStyle(style)
    story.append(pred_tbl)

    # ── Footer ───────────────────────────────────────────────────────────
    story.append(PageBreak())
    story.append(Paragraph("Methodology", h2))
    story.append(Paragraph(
        "This report was generated by <b>report-svc</b> from the cached "
        "prediction returned by <b>moe-inference-svc</b>. The MoE model is "
        "an ensemble of 3 XGBoost slice experts (eMBB / mMTC / URLLC) and "
        "2 protocol autoencoders (TCP / UDP), combined by a learned gate "
        "network that emits per-row weights. Attack probability is the "
        "weighted sum of expert scores, thresholded at the calibrated "
        "F1-optimal cut.", body,
    ))
    story.append(Spacer(1, 8))
    story.append(Paragraph(
        f"For audit purposes the full request id is "
        f"<font face='Courier'>{pred.request_id}</font>.",
        muted,
    ))

    doc.build(story)
    return buf.getvalue()
