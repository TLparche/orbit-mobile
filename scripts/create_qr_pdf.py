"""Create the single A4 print handout, only after the public site is reachable."""
from pathlib import Path
import argparse
from urllib.request import urlopen
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor, black, white
from reportlab.graphics.shapes import Drawing
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics import renderPDF

URL = "https://tlparche.github.io/orbit-mobile/"
ROOT = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser()
parser.add_argument('--font', required=True)
parser.add_argument('--bold-font', required=True)
args = parser.parse_args()
with urlopen(URL, timeout=30) as response:
    assert response.status == 200
    assert 'ORBIT' in response.read().decode('utf-8')
pdfmetrics.registerFont(TTFont('Korean', args.font))
pdfmetrics.registerFont(TTFont('KoreanBold', args.bold_font))
output = ROOT / 'output/pdf/ORBIT_QR_안내문.pdf'
output.parent.mkdir(parents=True, exist_ok=True)
w, h = A4
c = canvas.Canvas(str(output), pagesize=A4, pageCompression=1)
c.setTitle('ORBIT | 휴대폰으로 모임 데이터 둘러보기')
c.setAuthor('ORBIT')
c.setFillColor(white)
c.rect(0, 0, w, h, fill=1, stroke=0)
c.setFillColor(HexColor('#16493d'))
c.setFont('Helvetica-Bold', 15)
c.drawCentredString(w/2, 267*mm, 'O R B I T')
c.setFont('KoreanBold', 29)
for text, y in [('휴대폰으로', 242), ('모임 데이터 둘러보기', 226)]:
    assert pdfmetrics.stringWidth(text, 'KoreanBold', 29) <= w - 40*mm
    c.drawCentredString(w/2, y*mm, text)
c.setFillColor(HexColor('#53665d'))
c.setFont('Korean', 16)
c.drawCentredString(w/2, 207*mm, '카메라로 QR을 비춰 주세요.')
qr = QrCodeWidget(URL, barLevel='M', barBorder=4, barFillColor=black)
x0, y0, x1, y1 = qr.getBounds()
size = 90*mm
drawing = Drawing(size, size, transform=[size/(x1-x0), 0, 0, size/(y1-y0), 0, 0])
drawing.add(qr)
renderPDF.draw(drawing, c, (w-size)/2, 103*mm)
c.setFillColor(black)
c.setFont('Helvetica', 13)
c.drawCentredString(w/2, 82*mm, 'tlparche.github.io/orbit-mobile/')
c.linkURL(URL, (30*mm, 77*mm, w-30*mm, 90*mm), relative=0)
c.setFillColor(HexColor('#53665d'))
c.setFont('Korean', 13)
c.drawCentredString(w/2, 63*mm, '궁금한 그래프를 눌러 둘러보세요.')
c.setStrokeColor(HexColor('#d5e0d8'))
c.line(25*mm, 33*mm, w-25*mm, 33*mm)
c.setFont('Helvetica', 10)
c.drawCentredString(w/2, 24*mm, 'CERAGEM  x  ORBIT')
c.showPage()
c.save()
print(output)
