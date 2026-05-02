"""
Gateway → report-svc proxy for PDF / CSV report generation.
JWT-validated (any role); stateless renderer downstream.
"""
from __future__ import annotations

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.config import settings
from app.middleware.auth import CurrentUser, get_current_user

router = APIRouter(prefix="/api/report", tags=["report"])


async def _forward(method: str, path: str, request: Request, user: CurrentUser) -> Response:
    url = f"{settings.REPORT_SERVICE_URL}{path}"
    headers = {
        k: v for k, v in request.headers.items()
        if k.lower() not in {"host", "content-length"}
    }
    headers["X-User-Id"] = user.id
    headers["X-User-Role"] = user.role
    body = await request.body()
    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            resp = await client.request(
                method, url,
                content=body,
                headers=headers,
                params=request.query_params,
            )
        except httpx.RequestError as exc:
            raise HTTPException(status_code=502, detail=f"Report service unreachable: {exc}")

    # Forward Content-Disposition so the browser names the download correctly
    out_headers: dict[str, str] = {}
    if "content-disposition" in resp.headers:
        out_headers["Content-Disposition"] = resp.headers["content-disposition"]

    return Response(
        content=resp.content,
        status_code=resp.status_code,
        media_type=resp.headers.get("content-type"),
        headers=out_headers,
    )


@router.post("/pdf")
async def report_pdf(request: Request, user: CurrentUser = Depends(get_current_user)):
    """Render a prediction as a PDF. Any authenticated role."""
    return await _forward("POST", "/report/pdf", request, user)
