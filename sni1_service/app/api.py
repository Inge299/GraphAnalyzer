from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from .analytics import analyze_input, warm_references_cache
from .utils import get_logger, get_settings, log_event


class AnalyzeRequest(BaseModel):
    input_path: str
    device_id: str | None = None
    top_n: int | None = Field(default=None, gt=0)
    gap_minutes: int | None = Field(default=None, gt=0)
    document_title: str | None = None
    console_title: str | None = None
    refs_dir: str | None = None


class AnalyzeResponse(BaseModel):
    document_markdown: str
    tables: dict[str, list[dict]]
    meta: dict


def create_app() -> FastAPI:
    app = FastAPI(title="sni_traffic_report API")
    logger = get_logger(__name__)

    @app.on_event("startup")
    def _warmup_refs() -> None:
        settings = get_settings()
        if not settings.refs_dir:
            return
        ok = warm_references_cache(settings.refs_dir)
        log_event(logger, "startup.refs_warmup", ok=ok, refs_dir=settings.refs_dir)

    @app.post("/analyze", response_model=AnalyzeResponse)
    def analyze(payload: AnalyzeRequest) -> AnalyzeResponse:
        path = Path(payload.input_path)
        if not path.exists():
            raise HTTPException(status_code=404, detail="Input file not found")

        try:
            result = analyze_input(
                input_path=payload.input_path,
                device_id=payload.device_id,
                top_n=payload.top_n,
                gap_minutes=payload.gap_minutes,
                document_title=payload.document_title,
                console_title=payload.console_title,
                refs_dir=payload.refs_dir,
            )
            return AnalyzeResponse(
                document_markdown=result.document_markdown,
                tables=result.tables,
                meta=result.meta,
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except FileNotFoundError as exc:
            raise HTTPException(status_code=404, detail="Input file not found") from exc
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=500, detail="Internal analysis error") from exc

    return app
