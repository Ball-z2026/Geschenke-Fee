FROM node:20-slim

WORKDIR /app

# Vektorisierung (vectorize.js): vtracer ueber Python. Ohne diese Zeilen laeuft alles wie bisher,
# nur die SVG-Druckdatei fehlt dann (vectorReady() meldet das sauber).
# poppler-utils: pdftocairo rendert die PDF-Logos der Firmenkunden (images.js pdfZuPng). Fehlt es,
# bleibt beim PDF-Upload die Meldung "koennen wir nicht direkt lesen" - nichts bricht.
# ffmpeg (6. Okt.): bereitet Ottos Stimme auf (/admin/stimme) - fehlt es, bleibt die Rohaufnahme liegen.
# librsvg2-bin: rsvg-convert macht aus der SVG-Druckdatei die Vektor-PDF (images.js makePdfVonSvg).
# Fehlt es, kommt die PDF als Raster aus dem PNG - gleiches Mass, nur nicht vektoriell.
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 python3-pip poppler-utils librsvg2-bin ffmpeg \
 && pip3 install --no-cache-dir --break-system-packages vtracer \
 && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

ENV NODE_ENV=production
ENV FONTCONFIG_FILE=/app/fonts.conf
EXPOSE 8080

CMD ["node", "server.js"]
