# backend/routers/report_generator.py
# Professional PDF report — Times New Roman, 12pt body, 16pt headings
# No #, *, **, or markdown artefacts anywhere in output

import os
import re
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional

from fastapi import APIRouter
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

router = APIRouter()

REPORTS_DIR = Path(__file__).parent.parent / "reports"
REPORTS_DIR.mkdir(exist_ok=True)


# ── Request model ──────────────────────────────────────────────────────────────
class ReportRequest(BaseModel):
    target:       str
    scan_id:      str
    ai_analysis:  Optional[str] = ""
    tool_results: Optional[Dict[str, Any]] = {}
    date:         Optional[str] = ""


# ── Helpers ────────────────────────────────────────────────────────────────────
def _safe_name(target: str) -> str:
    return re.sub(r"[^a-z0-9_]", "_", target.lower()).strip("_")


def _clean(text: str) -> str:
    """
    Remove all markdown / special characters that should not appear in PDF.
    Strips: # headings, **, *, __, _, ~~, >, `, bullet dashes at line start.
    Collapses excessive blank lines.
    """
    if not text:
        return ""

    # Remove markdown heading markers (# ## ### etc.)
    text = re.sub(r"^#{1,6}\s*", "", text, flags=re.MULTILINE)

    # Remove bold / italic markers
    text = re.sub(r"\*{1,3}(.*?)\*{1,3}", r"\1", text)
    text = re.sub(r"_{1,2}(.*?)_{1,2}",   r"\1", text)

    # Remove strikethrough
    text = re.sub(r"~~(.*?)~~", r"\1", text)

    # Remove blockquote markers
    text = re.sub(r"^>\s*", "", text, flags=re.MULTILINE)

    # Remove inline code backticks (keep content)
    text = re.sub(r"`{1,3}(.*?)`{1,3}", r"\1", text, flags=re.DOTALL)

    # Remove bullet dash/asterisk/plus at line start
    text = re.sub(r"^[\-\*\+]\s+", "", text, flags=re.MULTILINE)

    # Remove numbered list markers like "1. " at line start
    text = re.sub(r"^\d+\.\s+", "", text, flags=re.MULTILINE)

    # Collapse 3+ blank lines into 2
    text = re.sub(r"\n{3,}", "\n\n", text)

    return text.strip()


def _xml_safe(text: str) -> str:
    """Escape XML special chars for ReportLab Paragraph."""
    return (text
            .replace("&",  "&amp;")
            .replace("<",  "&lt;")
            .replace(">",  "&gt;")
            .replace('"',  "&quot;"))


# ── PDF builder ────────────────────────────────────────────────────────────────
def _write_pdf(req: ReportRequest, out_path: Path) -> None:
    try:
        from reportlab.lib.colors import HexColor, white, black
        from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import ParagraphStyle
        from reportlab.lib.units import mm
        from reportlab.platypus import (
            HRFlowable, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
        )
        from reportlab.lib import colors

    except ImportError:
        # ReportLab not installed — write plain text fallback
        _write_plain_text(req, out_path)
        return

    # ── Colours ────────────────────────────────────────────────────────────
    CRIMSON   = HexColor("#8B0000")
    NAVY      = HexColor("#0a1628")
    DARK_GRAY = HexColor("#333333")
    MID_GRAY  = HexColor("#666666")
    LIGHT_BG  = HexColor("#f5f5f5")
    BORDER    = HexColor("#cccccc")

    # ── Styles — all Times New Roman ───────────────────────────────────────
    def style(name, **kw) -> ParagraphStyle:
        return ParagraphStyle(name, **kw)

    S_COVER_TITLE = style("CoverTitle",
        fontName="Times-Bold", fontSize=28, leading=34,
        textColor=white, alignment=TA_CENTER, spaceAfter=6)

    S_COVER_SUB = style("CoverSub",
        fontName="Times-Roman", fontSize=13, leading=18,
        textColor=HexColor("#dddddd"), alignment=TA_CENTER, spaceAfter=4)

    S_COVER_META = style("CoverMeta",
        fontName="Times-Roman", fontSize=11, leading=16,
        textColor=HexColor("#bbbbbb"), alignment=TA_CENTER)

    S_SECTION = style("Section",
        fontName="Times-Bold", fontSize=16, leading=20,
        textColor=CRIMSON, spaceBefore=18, spaceAfter=6)

    S_SUBSECTION = style("Subsection",
        fontName="Times-Bold", fontSize=13, leading=17,
        textColor=NAVY, spaceBefore=10, spaceAfter=4)

    S_BODY = style("Body",
        fontName="Times-Roman", fontSize=12, leading=18,
        textColor=DARK_GRAY, alignment=TA_JUSTIFY, spaceAfter=4)

    S_LABEL = style("Label",
        fontName="Times-Bold", fontSize=12, leading=16,
        textColor=DARK_GRAY, spaceAfter=2)

    S_META = style("Meta",
        fontName="Times-Roman", fontSize=11, leading=15,
        textColor=MID_GRAY, spaceAfter=2)

    S_CODE = style("Code",
        fontName="Courier", fontSize=9, leading=12,
        textColor=DARK_GRAY, backColor=LIGHT_BG,
        leftIndent=6, rightIndent=6, spaceBefore=4, spaceAfter=4)

    S_STATUS_OK  = style("StatusOk",
        fontName="Times-Bold", fontSize=12, leading=16,
        textColor=HexColor("#1a7a1a"), spaceAfter=2)

    S_STATUS_BAD = style("StatusBad",
        fontName="Times-Bold", fontSize=12, leading=16,
        textColor=HexColor("#cc0000"), spaceAfter=2)

    S_FOOTER = style("Footer",
        fontName="Times-Roman", fontSize=9, leading=12,
        textColor=MID_GRAY, alignment=TA_CENTER)

    # ── Page template with header/footer ───────────────────────────────────
    date_str = req.date or datetime.now().strftime("%d %B %Y, %H:%M UTC")

    def on_page(canvas, doc):
        canvas.saveState()
        W, H = A4

        # Top rule
        canvas.setStrokeColor(CRIMSON)
        canvas.setLineWidth(1.5)
        canvas.line(20*mm, H - 14*mm, W - 20*mm, H - 14*mm)

        # Header text (skip cover page)
        if doc.page > 1:
            canvas.setFont("Times-Roman", 9)
            canvas.setFillColor(MID_GRAY)
            canvas.drawString(20*mm, H - 11*mm, "CONFIDENTIAL — Web Scan Report")
            canvas.drawRightString(W - 20*mm, H - 11*mm, f"Target: {req.target}")

        # Bottom rule
        canvas.setStrokeColor(CRIMSON)
        canvas.line(20*mm, 14*mm, W - 20*mm, 14*mm)

        # Page number (skip cover)
        if doc.page > 1:
            canvas.setFont("Times-Roman", 9)
            canvas.setFillColor(MID_GRAY)
            canvas.drawCentredString(W / 2, 9*mm, f"Page {doc.page}")

        canvas.restoreState()

    doc = SimpleDocTemplate(
        str(out_path),
        pagesize=A4,
        rightMargin=20*mm, leftMargin=20*mm,
        topMargin=22*mm,   bottomMargin=20*mm,
    )

    story = []

    # ══════════════════════════════════════════════════════════════════════
    # COVER PAGE
    # ══════════════════════════════════════════════════════════════════════
    # Dark navy cover block using a 1-cell table
    cover_content = [
        Spacer(1, 18*mm),
        Paragraph("PENETRATION TEST REPORT", S_COVER_TITLE),
        Spacer(1, 4*mm),
        Paragraph("Automated AI Security Assessment", S_COVER_SUB),
        Spacer(1, 10*mm),
        Paragraph(f"Target: {req.target}", S_COVER_META),
        Paragraph(f"Scan ID: {req.scan_id}", S_COVER_META),
        Paragraph(f"Date: {date_str}", S_COVER_META),
        Spacer(1, 18*mm),
        Paragraph("CONFIDENTIAL", style("Conf",
            fontName="Times-Bold", fontSize=11, leading=14,
            textColor=HexColor("#ff9999"), alignment=TA_CENTER)),
    ]

    cover_table = Table([[cover_content]], colWidths=[170*mm])
    cover_table.setStyle(TableStyle([
        ("BACKGROUND",  (0, 0), (-1, -1), NAVY),
        ("TOPPADDING",  (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING",(0,0), (-1, -1), 10),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING",(0, 0), (-1, -1), 12),
        ("BOX",         (0, 0), (-1, -1), 2, CRIMSON),
    ]))
    story.append(cover_table)
    story.append(Spacer(1, 10*mm))

    # Prepared by block
    story.append(Paragraph("Prepared by: OffSec LLM — Automated AI Red Team Platform", S_META))
    story.append(Paragraph("University of Agriculture, Faisalabad — Department of Computer Science", S_META))
    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════
    # SECTION 1 — EXECUTIVE SUMMARY
    # ══════════════════════════════════════════════════════════════════════
    story.append(Paragraph("1. Executive Summary", S_SECTION))
    story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER, spaceAfter=6))

    vuln_count = sum(
        1 for d in req.tool_results.values()
        if isinstance(d, dict) and d.get("vulnerable")
    ) if req.tool_results else 0

    tools_used = list(req.tool_results.keys()) if req.tool_results else []

    summary = (
        f"An automated penetration test was conducted against the target system "
        f"'{req.target}' on {date_str}. The assessment was performed using the "
        f"OffSec LLM AI-powered red team platform, which orchestrated multiple "
        f"industry-standard security tools including Nmap, OWASP ZAP, Nuclei, and SQLMap. "
    )
    if vuln_count:
        summary += (
            f"The scan identified {vuln_count} vulnerable component(s) across "
            f"{len(tools_used)} tool(s). Immediate remediation is recommended for "
            f"critical and high-severity findings."
        )
    else:
        summary += (
            f"No critical vulnerabilities were identified during this assessment. "
            f"The system demonstrated acceptable security posture at the time of testing."
        )
    story.append(Paragraph(summary, S_BODY))
    story.append(Spacer(1, 4*mm))

    # Meta table
    meta_data = [
        ["Field", "Value"],
        ["Target",     req.target],
        ["Scan ID",    req.scan_id],
        ["Date",       date_str],
        ["Tools Used", ", ".join(tools_used) if tools_used else "N/A"],
        ["Findings",   f"{vuln_count} vulnerable component(s) identified"],
    ]
    meta_table = Table(meta_data, colWidths=[50*mm, 120*mm])
    meta_table.setStyle(TableStyle([
        ("BACKGROUND",   (0, 0), (-1, 0), NAVY),
        ("TEXTCOLOR",    (0, 0), (-1, 0), white),
        ("FONTNAME",     (0, 0), (-1, 0), "Times-Bold"),
        ("FONTSIZE",     (0, 0), (-1, 0), 11),
        ("FONTNAME",     (0, 1), (-1, -1), "Times-Roman"),
        ("FONTSIZE",     (0, 1), (-1, -1), 11),
        ("BACKGROUND",   (0, 1), (0, -1), LIGHT_BG),
        ("FONTNAME",     (0, 1), (0, -1), "Times-Bold"),
        ("ROWBACKGROUNDS",(0, 1), (-1, -1), [white, HexColor("#f9f9f9")]),
        ("GRID",         (0, 0), (-1, -1), 0.5, BORDER),
        ("TOPPADDING",   (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 5),
        ("LEFTPADDING",  (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 6*mm))

    # ══════════════════════════════════════════════════════════════════════
    # SECTION 2 — TOOL RESULTS
    # ══════════════════════════════════════════════════════════════════════
    if req.tool_results:
        story.append(Paragraph("2. Tool Results", S_SECTION))
        story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER, spaceAfter=6))

        for idx, (tool_name, data) in enumerate(req.tool_results.items(), 1):
            output     = data.get("output", "No output")     if isinstance(data, dict) else str(data)
            vulnerable = data.get("vulnerable", False)       if isinstance(data, dict) else False
            summary_t  = data.get("summary", "")             if isinstance(data, dict) else ""

            story.append(Paragraph(f"2.{idx}  {tool_name.upper()}", S_SUBSECTION))

            # Status badge
            status_text = "VULNERABLE — Remediation Required" if vulnerable else "No Critical Issues Detected"
            status_style = S_STATUS_BAD if vulnerable else S_STATUS_OK
            story.append(Paragraph(f"Status: {status_text}", status_style))

            if summary_t:
                story.append(Paragraph(_xml_safe(_clean(summary_t)), S_BODY))

            # Truncated output in monospace
            clean_out = _clean(output)[:2000]
            if clean_out:
                story.append(Paragraph("Raw Output:", S_LABEL))
                for line in clean_out.split("\n"):
                    safe_line = _xml_safe(line) if line.strip() else ""
                    if safe_line:
                        story.append(Paragraph(safe_line, S_CODE))
                    else:
                        story.append(Spacer(1, 2))

            story.append(Spacer(1, 4*mm))

    # ══════════════════════════════════════════════════════════════════════
    # SECTION 3 — AI SECURITY ANALYSIS
    # ══════════════════════════════════════════════════════════════════════
    if req.ai_analysis:
        story.append(Paragraph("3. AI Security Analysis", S_SECTION))
        story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER, spaceAfter=6))

        cleaned_analysis = _clean(req.ai_analysis)
        for para in cleaned_analysis.split("\n\n"):
            para = para.strip()
            if not para:
                continue
            # Treat short ALL-CAPS lines (≤60 chars) as sub-headings
            if para.isupper() and len(para) <= 60:
                story.append(Paragraph(para, S_SUBSECTION))
            else:
                for line in para.split("\n"):
                    line = line.strip()
                    if line:
                        story.append(Paragraph(_xml_safe(line), S_BODY))
                story.append(Spacer(1, 3))

    # ══════════════════════════════════════════════════════════════════════
    # SECTION 4 — RECOMMENDATIONS
    # ══════════════════════════════════════════════════════════════════════
    story.append(Paragraph("4. Recommendations", S_SECTION))
    story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER, spaceAfter=6))

    recommendations = [
        ("Patch Management",
         "Ensure all identified vulnerable software components are updated to their "
         "latest stable versions. Apply vendor-supplied security patches promptly."),
        ("Network Hardening",
         "Close unnecessary open ports and restrict access to sensitive services "
         "using firewall rules and network segmentation."),
        ("Web Application Security",
         "Implement input validation, output encoding, and parameterised queries to "
         "mitigate injection vulnerabilities identified during the assessment."),
        ("Regular Assessment",
         "Schedule periodic penetration tests (at minimum quarterly) to identify "
         "newly introduced vulnerabilities and verify remediation effectiveness."),
        ("Security Monitoring",
         "Deploy intrusion detection systems and centralised log management to "
         "detect and respond to potential threats in real time."),
    ]

    for i, (title, desc) in enumerate(recommendations, 1):
        story.append(Paragraph(f"{i}.  {title}", S_LABEL))
        story.append(Paragraph(desc, S_BODY))
        story.append(Spacer(1, 2))

    story.append(Spacer(1, 6*mm))

    # ══════════════════════════════════════════════════════════════════════
    # SECTION 5 — DISCLAIMER
    # ══════════════════════════════════════════════════════════════════════
    story.append(Paragraph("5. Disclaimer", S_SECTION))
    story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER, spaceAfter=6))
    story.append(Paragraph(
        "This report was generated automatically by the OffSec LLM platform for "
        "authorised security assessment purposes only. The findings reflect the "
        "state of the target system at the time of the scan and may not represent "
        "a comprehensive audit. This document is strictly confidential and intended "
        "solely for the authorised recipient. Unauthorised disclosure, reproduction, "
        "or use of this report is prohibited.",
        S_BODY
    ))

    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)


# ── Plain text fallback (no ReportLab) ────────────────────────────────────────
def _write_plain_text(req: ReportRequest, out_path: Path) -> None:
    date_str = req.date or datetime.now().strftime("%Y-%m-%d %H:%M UTC")
    sep  = "=" * 70
    thin = "-" * 70
    lines = [
        sep,
        "  PENETRATION TEST REPORT",
        sep,
        f"  Target  : {req.target}",
        f"  Scan ID : {req.scan_id}",
        f"  Date    : {date_str}",
        sep, "",
    ]
    if req.tool_results:
        lines += ["TOOL RESULTS", thin]
        for tool, data in req.tool_results.items():
            out  = data.get("output", "")    if isinstance(data, dict) else str(data)
            vuln = data.get("vulnerable", False) if isinstance(data, dict) else False
            lines += [f"\n[{tool.upper()}]  {'VULNERABLE' if vuln else 'Clean'}", thin,
                      _clean(out)[:2000], ""]
    if req.ai_analysis:
        lines += ["", "AI SECURITY ANALYSIS", thin, _clean(req.ai_analysis), ""]
    lines += [sep, "  END OF REPORT", sep]
    out_path.with_suffix(".txt").write_text("\n".join(lines), encoding="utf-8")


# ── Endpoints ──────────────────────────────────────────────────────────────────
@router.post("/generate")
async def generate_report(req: ReportRequest):
    try:
        slug      = _safe_name(req.target)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename  = f"scan_report_{slug}_{timestamp}.pdf"
        out_path  = REPORTS_DIR / filename

        _write_pdf(req, out_path)

        return {
            "success":  True,
            "filename": filename,
            "pdf_url":  f"/api/report/download/{filename}",
            "target":   req.target,
        }

    except Exception as exc:
        return JSONResponse(status_code=500, content={"success": False, "error": str(exc)})


@router.get("/download/{filename}")
async def download_report(filename: str):
    if not re.match(r"^[a-zA-Z0-9_\-\.]+$", filename):
        return JSONResponse(status_code=400, content={"error": "Invalid filename"})

    path = REPORTS_DIR / filename
    if not path.exists():
        return JSONResponse(status_code=404, content={"error": "Report not found"})

    media = "application/pdf" if filename.endswith(".pdf") else "text/plain"
    return FileResponse(str(path), media_type=media, filename=filename)


@router.get("/list")
async def list_reports():
    files = sorted(REPORTS_DIR.glob("*.pdf"), key=lambda p: p.stat().st_mtime, reverse=True)
    return {
        "reports": [
            {"filename": f.name,
             "url": f"/api/report/download/{f.name}",
             "size_kb": round(f.stat().st_size / 1024, 1)}
            for f in files
        ]
    }