"""Downloadable report. The trace, printed."""
from __future__ import annotations

import io
from datetime import datetime

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle)

from .. import store

router = APIRouter()

TEAL = colors.HexColor("#0B7285")
OCHRE = colors.HexColor("#A9610A")
CARMINE = colors.HexColor("#B0264C")
INK = colors.HexColor("#12202E")
RULE = colors.HexColor("#DCE3EA")


@router.get("/report/{session_id}")
def report(session_id: str):
    rows = store.session_traces(session_id)
    if not rows:
        raise HTTPException(404, f"No analyses recorded for session {session_id}.")

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, title=f"SatQuery {session_id}",
                            leftMargin=20 * mm, rightMargin=20 * mm,
                            topMargin=18 * mm, bottomMargin=18 * mm)

    ss = getSampleStyleSheet()
    h1 = ParagraphStyle("h1", ss["Title"], fontSize=20, textColor=INK, alignment=0, spaceAfter=2)
    eyebrow = ParagraphStyle("eyebrow", ss["Normal"], fontName="Courier", fontSize=7.5,
                             textColor=colors.HexColor("#8496A8"), spaceAfter=8)
    h2 = ParagraphStyle("h2", ss["Heading2"], fontSize=12, textColor=INK, spaceBefore=14, spaceAfter=4)
    body = ParagraphStyle("body", ss["Normal"], fontSize=9.5, leading=14, textColor=INK)
    mono = ParagraphStyle("mono", ss["Normal"], fontName="Courier", fontSize=7.5, leading=10)

    story = [
        Paragraph("SatQuery — Analysis Report", h1),
        Paragraph(f"SESSION {session_id} &nbsp;·&nbsp; PS 26167 &nbsp;·&nbsp; TEAM QUANTARA "
                  f"&nbsp;·&nbsp; GENERATED {datetime.now():%Y-%m-%d %H:%M}", eyebrow),
    ]

    for n, row in enumerate(rows, 1):
        tr = row["trace"]
        flagged = bool(row["abstained"])
        tone = CARMINE if flagged else TEAL

        story += [
            Paragraph(f"{n}. {row['query']}", h2),
            Paragraph(
                f'<font face="Courier" size="7.5" color="#8496A8">INTERPRETED AS</font> '
                f'<font face="Courier" size="8">{tr.get("interpreted_task", "—")}</font>', body),
            Spacer(1, 6),
            Paragraph(row["answer"].replace("\n", "<br/>"), body),
            Spacer(1, 8),
        ]

        conf = Table([[
            Paragraph('<font face="Courier" size="7.5">COMPOSITE CONFIDENCE</font>', body),
            Paragraph(f'<font face="Courier" size="11" color="#{tone.hexval()[2:]}">'
                      f'<b>{row["confidence"] * 100:.0f}%</b></font>', body),
            Paragraph(f'<font face="Courier" size="7.5">'
                      f'{"ABSTAINED — INSUFFICIENT EVIDENCE" if flagged else "REPORTED"}</font>', body),
        ]], colWidths=[45 * mm, 25 * mm, 100 * mm])
        conf.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F5F8FA")),
            ("BOX", (0, 0), (-1, -1), 0.5, RULE),
            ("LEFTPADDING", (0, 0), (-1, -1), 6), ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        story += [conf, Spacer(1, 10),
                  Paragraph('<font face="Courier" size="7.5" color="#8496A8">'
                            'EXECUTION TRACE — IN ORDER OF EXECUTION</font>', body), Spacer(1, 4)]

        data = [["#", "TOOL", "STAGE", "DETAIL", "CONF", "BASIS", "ms"]]
        for c in tr.get("execution_sequence", []):
            data.append([
                str(c["step"]), f'{c["tool"]}@{c["version"]}', c["label"],
                Paragraph(c["detail"][:150], mono), f'{c["confidence"]:.2f}',
                Paragraph(c["confidence_basis"][:40], mono), str(c["runtime_ms"]),
            ])

        t = Table(data, colWidths=[7 * mm, 24 * mm, 24 * mm, 58 * mm, 12 * mm, 34 * mm, 11 * mm],
                  repeatRows=1)
        t.setStyle(TableStyle([
            ("FONTNAME", (0, 0), (-1, -1), "Courier"),
            ("FONTSIZE", (0, 0), (-1, -1), 7),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("BACKGROUND", (0, 0), (-1, 0), INK),
            ("LINEBELOW", (0, 1), (-1, -1), 0.4, RULE),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        story += [t, Spacer(1, 6)]

        v = tr.get("input_validation", {})
        if v.get("notes"):
            story += [Paragraph(
                '<font face="Courier" size="7" color="#8496A8">INPUT VALIDATION — '
                + " · ".join(str(x) for x in v["notes"][:5]) + "</font>", body), Spacer(1, 4)]

        if n < len(rows):
            story.append(Spacer(1, 8))
        if n % 2 == 0 and n < len(rows):
            story.append(PageBreak())

    story += [
        Spacer(1, 16),
        Paragraph('<font face="Courier" size="7" color="#8496A8">'
                  "Indices, cross-modal fusion and change detection are computed deterministically in "
                  "NumPy. The vision model narrates measured figures and answers open questions; it "
                  "does not estimate any quantity reported above. Coordinates are EPSG:4326, "
                  "reprojected from each scene's native CRS through its affine transform."
                  "</font>", body),
    ]

    doc.build(story)
    buf.seek(0)
    return StreamingResponse(
        buf, media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="satquery_{session_id}.pdf"'},
    )
