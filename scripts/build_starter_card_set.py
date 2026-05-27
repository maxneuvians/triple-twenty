from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph


OUT = "darts-starter-card-set.pdf"

PAGE_W, PAGE_H = letter
CARD_W = 2.35 * inch
CARD_H = 3.25 * inch
GAP = 0.12 * inch
MARGIN_X = (PAGE_W - (3 * CARD_W + 2 * GAP)) / 2
MARGIN_Y = (PAGE_H - (3 * CARD_H + 2 * GAP)) / 2

INK = colors.HexColor("#1F2933")
MUTED = colors.HexColor("#5F6B76")
BORDER = colors.HexColor("#30363D")
LIGHT_RULE = colors.HexColor("#D0D7DE")
OUTCOME_FILL = colors.HexColor("#E8EEF5")
TECHNIQUE_FILL = colors.HexColor("#F4F6F9")
REFERENCE_FILL = colors.HexColor("#EFEFEF")


TEXT_STYLE = ParagraphStyle(
    "CardBody",
    fontName="Helvetica",
    fontSize=8.3,
    leading=10.1,
    textColor=INK,
    spaceAfter=0,
)

NOTE_STYLE = ParagraphStyle(
    "CardNote",
    fontName="Helvetica",
    fontSize=6.9,
    leading=8.2,
    textColor=MUTED,
    alignment=TA_CENTER,
)


def starter_deck(deck_id):
    specs = [
        ("Clean Hit", "Outcome", 4, "Hit the exact segment you aimed at.", "Use as this dart's outcome."),
        (
            "Fat Segment",
            "Outcome",
            5,
            "If aiming at a double or treble, score the single of that number. If aiming at a single, hit it.",
            "Use as this dart's outcome.",
        ),
        (
            "Drift Left",
            "Outcome",
            2,
            "Choose a Drift variant before play. Unstable: flip; drift left on success, original single on fail. Counterplay: play on opponent.",
            "Left is counter-clockwise.",
        ),
        (
            "Drift Right",
            "Outcome",
            2,
            "Choose a Drift variant before play. Unstable: flip; drift right on success, original single on fail. Counterplay: play on opponent.",
            "Right is clockwise.",
        ),
        ("Wire", "Outcome", 2, "Score 0.", "Use as this dart's outcome."),
        (
            "Focus",
            "Technique",
            3,
            "Improve one outcome: Wire -> Fat Segment; Fat Segment -> Double. In Counterplay Drift, cancel one Drift against your dart.",
            "Play after the Outcome card.",
        ),
        (
            "Safe Setup",
            "Technique",
            2,
            "If aiming at a single, ignore Drift and score the intended single. In Counterplay Drift, cancel one Drift against your dart.",
            "Play after Outcome or as Drift defense.",
        ),
        (
            "Checkout Nerve",
            "Technique",
            1,
            "If this dart could legally win the leg, cancel Wire or Drift and treat it as Clean Hit.",
            "Play only on a checkout dart.",
        ),
    ]

    cards = []
    idx = 1
    for name, card_type, count, effect, note in specs:
        for _ in range(count):
            cards.append(
                {
                    "name": name,
                    "type": card_type,
                    "deck": deck_id,
                    "code": f"{deck_id}{idx:02d}",
                    "effect": effect,
                    "note": note,
                }
            )
            idx += 1
    return cards


def reference_cards():
    return [
        {
            "name": "Quick Turn",
            "type": "Reference",
            "deck": "",
            "code": "REF",
            "effect": "A turn is one visit. Throw up to 3 darts. For each dart: declare target, play one Outcome, optionally play Technique cards, resolve score.",
            "note": "Discard played cards. Only unplayed Technique cards may be discarded. Draw back to 5.",
        },
        {
            "name": "Bust & Win",
            "type": "Reference",
            "deck": "",
            "code": "REF",
            "effect": "Bust if your score goes below 0, becomes exactly 1, or reaches 0 without a double or bull.",
            "note": "On a bust, reset to the score from the start of the visit.",
        },
        {
            "name": "Board Order",
            "type": "Reference",
            "deck": "",
            "code": "REF",
            "effect": "20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5",
            "note": "Drift Right moves clockwise. Drift Left moves counter-clockwise.",
        },
    ]


def draw_centered_string(c, text, x, y, width, font="Helvetica", size=7, color=MUTED):
    c.setFont(font, size)
    c.setFillColor(color)
    text_width = stringWidth(text, font, size)
    c.drawString(x + (width - text_width) / 2, y, text)


def draw_card(c, card, x, y):
    card_type = card["type"]
    fill = REFERENCE_FILL
    if card_type == "Outcome":
        fill = OUTCOME_FILL
    elif card_type == "Technique":
        fill = TECHNIQUE_FILL

    c.setStrokeColor(BORDER)
    c.setLineWidth(1)
    c.setFillColor(colors.white)
    c.roundRect(x, y, CARD_W, CARD_H, 7, fill=1, stroke=1)

    band_h = 0.34 * inch
    c.setFillColor(fill)
    c.roundRect(x, y + CARD_H - band_h, CARD_W, band_h, 7, fill=1, stroke=0)
    c.setStrokeColor(LIGHT_RULE)
    c.setLineWidth(0.5)
    c.line(x, y + CARD_H - band_h, x + CARD_W, y + CARD_H - band_h)

    c.setFont("Helvetica-Bold", 7)
    c.setFillColor(MUTED)
    c.drawString(x + 0.13 * inch, y + CARD_H - 0.22 * inch, card_type.upper())

    c.setFont("Helvetica", 6.7)
    c.setFillColor(MUTED)
    code = card["code"] if not card["deck"] else f"Deck {card['deck']} | {card['code']}"
    c.drawRightString(x + CARD_W - 0.13 * inch, y + CARD_H - 0.22 * inch, code)

    c.setFont("Helvetica-Bold", 15)
    c.setFillColor(INK)
    title_y = y + CARD_H - 0.68 * inch
    title_width = stringWidth(card["name"], "Helvetica-Bold", 15)
    if title_width > CARD_W - 0.28 * inch:
        c.setFont("Helvetica-Bold", 13)
    c.drawCentredString(x + CARD_W / 2, title_y, card["name"])

    c.setStrokeColor(LIGHT_RULE)
    c.setLineWidth(0.5)
    c.line(x + 0.18 * inch, y + CARD_H - 0.88 * inch, x + CARD_W - 0.18 * inch, y + CARD_H - 0.88 * inch)

    body = Paragraph(card["effect"], TEXT_STYLE)
    body_w = CARD_W - 0.36 * inch
    body_h = 1.35 * inch
    body.wrapOn(c, body_w, body_h)
    body.drawOn(c, x + 0.18 * inch, y + CARD_H - 2.28 * inch)

    c.setStrokeColor(LIGHT_RULE)
    c.setLineWidth(0.5)
    c.line(x + 0.18 * inch, y + 0.61 * inch, x + CARD_W - 0.18 * inch, y + 0.61 * inch)

    note = Paragraph(card["note"], NOTE_STYLE)
    note_w = CARD_W - 0.36 * inch
    note.wrapOn(c, note_w, 0.45 * inch)
    note.drawOn(c, x + 0.18 * inch, y + 0.22 * inch)


def build_pdf():
    cards = starter_deck("A") + starter_deck("B") + reference_cards()

    c = canvas.Canvas(OUT, pagesize=letter)
    c.setTitle("Darts Deck-Builder Starter Card Set")
    c.setAuthor("Codex")

    for page_start in range(0, len(cards), 9):
        page_cards = cards[page_start : page_start + 9]
        for idx, card in enumerate(page_cards):
            col = idx % 3
            row = idx // 3
            x = MARGIN_X + col * (CARD_W + GAP)
            y = PAGE_H - MARGIN_Y - CARD_H - row * (CARD_H + GAP)
            draw_card(c, card, x, y)

        c.setFont("Helvetica", 6.5)
        c.setFillColor(MUTED)
        c.drawCentredString(PAGE_W / 2, 0.24 * inch, "Darts Deck-Builder starter set | Fronts only | Cut on card borders")
        c.showPage()

    c.save()


if __name__ == "__main__":
    build_pdf()
