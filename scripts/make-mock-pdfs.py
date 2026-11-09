"""
Generate the mock PDFs used by the dashboard's mock mode.

    python3 scripts/make-mock-pdfs.py

Writes public/mock.pdf (fallback) and public/mock/<file>.pdf, one per mock document.
Every page carries a "SAMPLE TEXT" header: these are NOT official documents. They exist only
so the UI (page jump + quote highlight) can be built before the real backend is live.
The quotes used in src/lib/mock.ts appear verbatim in these pages, and several of them
deliberately wrap across lines to exercise the multi-line highlight.
"""

from pathlib import Path

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer

OUT = Path(__file__).resolve().parent.parent / "public"
(OUT / "mock").mkdir(parents=True, exist_ok=True)

BODY = ParagraphStyle("body", fontName="Times-Roman", fontSize=12, leading=17, spaceAfter=9)
HEAD = ParagraphStyle("head", fontName="Times-Bold", fontSize=13, leading=18, spaceAfter=6, alignment=1)
SUB = ParagraphStyle("sub", fontName="Times-Bold", fontSize=12, leading=17, spaceBefore=6, spaceAfter=6)


def stamp(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.setFillGray(0.45)
    canvas.drawString(20 * mm, 287 * mm, "SAMPLE TEXT FOR NIYAM SAHAYAK UI DEVELOPMENT. NOT AN OFFICIAL DOCUMENT.")
    canvas.drawRightString(190 * mm, 10 * mm, f"Page {doc.page}")
    canvas.restoreState()


def build(name, pages):
    story = []
    for i, page in enumerate(pages):
        for kind, text in page:
            style = {"h": HEAD, "s": SUB, "p": BODY}[kind]
            story.append(Paragraph(text, style))
        if i < len(pages) - 1:
            story.append(PageBreak())
    doc = SimpleDocTemplate(str(OUT / name), pagesize=A4, leftMargin=25 * mm, rightMargin=25 * mm,
                            topMargin=25 * mm, bottomMargin=20 * mm, title=name)
    doc.build(story, onFirstPage=stamp, onLaterPages=stamp)


GOV = [("h", "GOVERNMENT OF ASSAM"), ("h", "FINANCE DEPARTMENT")]

DOCS = {
    "ASSAC_Leave_Rules.pdf": [
        [
            ("h", "LEAVE RULES (SAMPLE TEXT)"),
            ("s", "Chapter I: Preliminary"),
            ("p", "1. These rules govern the grant of leave to government servants to whom they apply. "
                  "They shall be read together with the general conditions of service applicable to the post."),
            ("p", "2. In these rules, unless the context otherwise requires, \"leave\" means any kind of leave "
                  "described in Chapter II, and \"sanctioning authority\" means the authority competent to grant it."),
            ("p", "3. Leave is earned by duty only. A period spent on foreign service counts as duty for the "
                  "purpose of these rules if contribution towards leave salary is paid."),
        ],
        [
            ("s", "Chapter II: General Conditions"),
            ("p", "4. Leave cannot be claimed as of right. When the exigencies of the public service so require, "
                  "discretion to refuse or revoke leave of any description is reserved to the authority empowered to grant it."),
            ("p", "5. The authority granting leave may not alter the kind of leave applied for, except at the "
                  "written request of the government servant concerned."),
            ("p", "6. A government servant on leave shall not take up any service or employment elsewhere "
                  "without obtaining the previous sanction of the competent authority."),
        ],
        [
            ("s", "Chapter III: Kinds of Leave"),
            ("p", "7. Earned leave. The earned leave admissible to a government servant shall be 30 days in a "
                  "calendar year, credited in advance in two instalments of 15 days each on the first day of "
                  "January and July of every year."),
            ("p", "8. Half pay leave. The half pay leave admissible to a government servant in respect of each "
                  "completed year of service shall be 20 days, and may be granted on medical certificate or on "
                  "private affairs."),
            ("p", "9. Commuted leave not exceeding half the amount of half pay leave due may be granted on "
                  "medical certificate, subject to the conditions laid down in rule 10."),
        ],
        [
            ("s", "Chapter IV: Other Leave"),
            ("p", "10. Extraordinary leave may be granted to a government servant when no other leave is "
                  "admissible, or when other leave is admissible but the government servant applies in writing "
                  "for extraordinary leave."),
            ("p", "11. Casual leave is not recognised as leave and is not subject to these rules. A government "
                  "servant on casual leave is not treated as absent from duty."),
            ("p", "12. Leave applications shall ordinarily be submitted at least seven days before the date "
                  "from which leave is required, except in emergencies."),
        ],
    ],
    "DA_Order_46_to_50_wef_2024.pdf": [
        GOV + [
            ("h", "ORDER (SAMPLE TEXT)"),
            ("p", "Subject: Revision of the rate of Dearness Allowance to State Government employees."),
            ("p", "1. In continuation of the earlier order on the subject, the Governor of Assam is pleased to "
                  "decide that the rate of Dearness Allowance payable to State Government employees shall be "
                  "enhanced from 46 percent to 50 percent with effect from 1.1.2024 on the basic pay drawn in the "
                  "revised pay structure."),
            ("p", "2. The arrear on account of the enhanced rate shall be paid in cash in the manner to be "
                  "notified separately."),
            ("p", "3. This order supersedes the earlier order on the rate of Dearness Allowance."),
        ],
        [
            ("p", "4. The expenditure shall be met from the respective heads of account under which the pay "
                  "and allowances of the employees concerned are drawn."),
            ("p", "5. This issues with the concurrence of the Finance Department."),
        ],
    ],
    "DA_Order_42_to_46.pdf": [
        GOV + [
            ("h", "ORDER (SAMPLE TEXT)"),
            ("p", "1. The rate of Dearness Allowance payable to State Government employees shall be enhanced "
                  "from 42 percent to 46 percent on the basic pay drawn in the revised pay structure."),
            ("p", "2. This order shall remain in force until further orders."),
        ],
    ],
    "DA_Order_38_to_42.pdf": [
        GOV + [
            ("h", "ORDER (SAMPLE TEXT)"),
            ("p", "1. The rate of Dearness Allowance payable to State Government employees shall be enhanced "
                  "from 38 percent to 42 percent on the basic pay drawn in the revised pay structure."),
        ],
    ],
    "Flood_Situation_Report_2024.pdf": [
        [
            ("h", "FLOOD SITUATION REPORT (SAMPLE TEXT)"),
            ("p", "This sample report summarises the flood situation in three districts during the first wave "
                  "of the monsoon. All figures below are illustrative and invented for UI testing."),
            ("p", "Reporting period: 1 June 2024 to 15 June 2024."),
            ("p", "Districts covered: Dhemaji, Lakhimpur and Majuli."),
        ],
        [
            ("s", "Impact"),
            ("p", "Villages affected: 120 villages across the three districts reported inundation of homes and fields."),
            ("p", "Population affected: 48,500 persons. Relief camps opened: 36."),
            ("p", "Crop area damaged: 2,150 hectares, mainly paddy at the nursery stage."),
        ],
        [
            ("s", "Response"),
            ("p", "Relief distributed includes rice, dal, salt and mustard oil to all camps. Medical teams "
                  "visited every camp at least twice a week."),
            ("p", "District administrations are to submit damage assessments by 30 June 2024 to the "
                  "Revenue and Disaster Management Department."),
        ],
    ],
    "AASC_Office_Procedure_Manual.pdf": [
        [
            ("h", "OFFICE PROCEDURE MANUAL (SAMPLE TEXT)"),
            ("s", "Receipt and movement of files"),
            ("p", "1. Every receipt shall be diarised on the day it is received and placed before the dealing "
                  "assistant within one working day."),
            ("p", "2. A file shall be disposed of at the lowest appropriate level. No file shall be kept pending "
                  "with any officer for more than seven working days without recorded reasons."),
        ],
        [
            ("s", "Record keeping"),
            ("p", "3. Files shall be recorded and classified at the time of closing, indicating the period "
                  "for which they are to be retained."),
        ],
    ],
}

for name, pages in DOCS.items():
    build("mock/" + name, pages)

# public/mock.pdf: a fallback for any document the mock library does not have.
build("mock.pdf", DOCS["ASSAC_Leave_Rules.pdf"])
print("Wrote", len(DOCS) + 1, "PDFs to", OUT)
