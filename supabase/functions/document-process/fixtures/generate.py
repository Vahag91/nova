"""Deterministic synthetic extraction fixtures; run with reportlab and pypdf.
These deliberately exercise invisible/out-of-bounds text and other edge cases.
No customer data or downloadable fonts are used.
"""
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from pypdf import PdfReader, PdfWriter
from pypdf.generic import RectangleObject
import io
import zipfile

ROOT = Path(__file__).parent

def pdf(name, draw):
    c = canvas.Canvas(str(ROOT / name), pagesize=(612, 792), invariant=1)
    draw(c)
    c.save()

def layout(c):
    c.drawString(40, 750, 'COLUMN LEFT ONE')
    c.drawString(40, 725, 'COLUMN LEFT TWO')
    c.drawString(350, 750, 'COLUMN RIGHT ONE')
    c.drawString(350, 725, 'COLUMN RIGHT TWO')
    for y, a, b in [(650, 'Item', 'Amount'), (630, 'Cedar', '8200'), (610, 'Garden', '640')]:
        c.drawString(40, y, a)
        c.drawString(200, y, b)
    c.drawString(40, 540, 'hyphen-')
    c.drawString(40, 520, 'ation stays explicit')
    c.showPage()
pdf('layout.pdf', layout)
pdf('outside-media.pdf', lambda c: (c.drawString(590, 700, 'PREFIX OUTSIDE_MEDIA_TAIL'), c.showPage()))
pdf('crop.pdf', lambda c: (c.drawString(40, 750, 'INSIDE MEDIA OUTSIDE CROP'), c.showPage()))
r = PdfReader(ROOT / 'crop.pdf'); w = PdfWriter(); w.add_page(r.pages[0]); w.pages[0].cropbox = RectangleObject([0, 0, 200, 500]); w.write(ROOT / 'outside-crop.pdf')
(ROOT / 'crop.pdf').unlink()
pdf('partial.pdf', lambda c: (c.drawString(40, 740, 'Readable page with 37 volunteers'), c.showPage(), c.rect(50, 50, 100, 100, fill=1), c.showPage()))
pdf('blank.pdf', lambda c: (c.rect(50, 50, 100, 100, fill=1), c.showPage()))
pdf('rotated.pdf', lambda c: (c.setPageRotation(90), c.drawString(40, 500, 'ROTATED PAGE 37'), c.showPage()))
pdf('150-pages.pdf', lambda c: [(c.drawString(40, 700, f'PAGE {i+1}'), c.showPage()) for i in range(150)])
w = PdfWriter()
for page in PdfReader(ROOT / '150-pages.pdf').pages[:100]: w.add_page(page)
w.write(ROOT / '100-pages.pdf')
pdf('long-text.pdf', lambda c: (c.setFont('Helvetica', 1), c.drawString(40, 700, 'A' * 200010), c.showPage()))
w = PdfWriter(); w.add_page(PdfReader(ROOT / 'layout.pdf').pages[0]); w.encrypt('fixture-password'); w.write(ROOT / 'encrypted.pdf')
font_root = Path('C:/Windows/Fonts')
pdfmetrics.registerFont(TTFont('UnicodeFixture', str(font_root / 'arial.ttf')))
pdfmetrics.registerFont(TTFont('CjkFixture', str(font_root / 'malgun.ttf')))
def unicode(c):
    c.setFont('UnicodeFixture', 16)
    c.drawString(40, 740, 'office \ufb01le \ufb02ow')
    c.drawString(40, 700, '\u05e9\u05dc\u05d5\u05dd')
    c.setFont('CjkFixture', 16)
    c.drawString(40, 650, '\u4e2d\u6587\u6e2c\u8a66')
    c.showPage()
pdf('unicode.pdf', unicode)

ns = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
def para(text): return f'<w:p><w:r><w:t>{text}</w:t></w:r></w:p>'
body = (para('Main 37 volunteers') + '<w:tbl><w:tr><w:tc>' + para('Cedar') + '</w:tc><w:tc>' + para('8200') + '</w:tc></w:tr></w:tbl>'
        + '<w:p><w:r><w:pict><w:txbxContent>' + para('TEXT BOX FACT') + '</w:txbxContent></w:pict></w:r></w:p>')
with zipfile.ZipFile(ROOT / 'structure.docx', 'w', zipfile.ZIP_DEFLATED) as z:
    for name, content in [('document', body), ('header1', para('HEADER FACT')), ('footer1', para('FOOTER FACT')), ('footnotes', para('FOOTNOTE FACT')), ('endnotes', para('ENDNOTE FACT'))]:
        info = zipfile.ZipInfo(f'word/{name}.xml', (2026, 1, 1, 0, 0, 0)); info.compress_type = zipfile.ZIP_DEFLATED
        z.writestr(info, f'<w:document xmlns:w="{ns}"><w:body>{content}</w:body></w:document>')
print('Generated extraction fixtures:', ROOT)
