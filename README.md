# CLUSTERMAP

CLUSTERMAP visualisiert die originale MaxPane-`CuratorWhitelist` als
interaktives SybilKit-Beziehungsfeld. Die globale Karte zeigt alle Wallets,
ordnet Wallets mit vielen Punkten im Zentrum an und lässt unabhängige Wallets
grün und unverbunden. Erkannte Gruppen sind anhand ihrer Evidenzstärke gelb,
orange oder rot verbunden. Die aktuelle Oberfläche verwendet ausschließlich
den MaxPane-Matrix-Look; sie ist browsernativ, responsiv und read-only.

Der mitgelieferte Snapshot umfasst 19.522 Wallets, 28.353 Deposits und 263 von
SybilKit erkannte Gruppen. Er stammt aus dem finalen MaxPane-Cache und endet bei
Ethereum-Block 25.807.057.

## Schnellstart

Voraussetzungen: Python 3.11+, `uv`, Node.js und npm.

```bash
make install
make build
make run
```

Danach ist die App unter <http://127.0.0.1:8766> erreichbar. Port `8766` ist
absichtlich gewählt, damit das PAWAI-Referenzdashboard auf `8765` parallel
laufen kann. Die FastAPI-Dokumentation liegt unter
<http://127.0.0.1:8766/docs>.

Für die Frontend-Entwicklung können Backend und Vite getrennt gestartet werden:

```bash
uv run clustermap
npm --prefix dashboard run dev
```

Vite läuft dann auf `5173` und leitet `/api` an das lokale Backend weiter.

## Funktionen

- globale Canvas-Karte mit allen 19.522 Wallets und 11.310 echten,
  evidenzbasierten Verbindungen
- standardmäßiger, zur Wallet-Karte umschaltbarer Cluster-Evidence-Atlas:
  X-Achse Evidenzsicherheit, Y-Achse logarithmischer Punkteanteil und
  Bubble-Fläche als Wallet-Anzahl
- unabhängige Wallets grün und unverbunden; höchste Punktzahlen im Zentrum
- Evidenzstufen Gelb (Review), Orange (erhöht) und Rot (starkes Sybil-Signal)
- zusätzliche gestrichelte Kennzeichnung für mögliche False Positives samt
  konkreter Review-Begründung
- Cluster-Drill-down mit allen projizierten SybilKit-Kanten, Pan, Zoom, Drag
  und Wallet-Auswahl
- Inline-Gruppenbegründung direkt unter der Clusterkarte mit Evidenzfamilien,
  Confidence, Kennzahlen und False-Positive-Hinweisen
- vollständiges Wallet-Dossier im selben Inline-Bereich; Schließen kehrt ohne
  Kontextverlust zur Gruppenbegründung zurück
- typisierte Evidenzkanten für Funding, Betrag, Sequenz, Kadenz und Gas
- fokussierter MaxPane-Matrix-Look; der vorhandene Drei-Theme-Schalter bleibt
  für eine spätere Reaktivierung im Code deaktiviert
- responsive Desktop-/Mobile-Oberfläche und Reduced-Motion-Unterstützung
- vollständig nutzbarer lokaler Snapshot ohne API-Key oder laufenden RPC

Die früheren MaxPane-Screens bleiben im Quellcode erhalten, sind momentan aber
ausgeblendet, damit die Clustermap die zentrale Arbeitsfläche ist.

## Warum kein gestreamtes Terminal?

Für das unveränderte Veröffentlichen der kompletten Textual-App wäre
`textual-serve` die kürzeste Route. Die Beziehungskarte benötigt jedoch
performantes Canvas-Rendering für 19.522 Wallets, Touch-Bedienung und
browsernative Overlays. Deshalb läuft die Karte als React-Anwendung über dem
FastAPI/SybilKit-Read-Model. Ein Shell-Emulator oder pro Browser gestarteter
TUI-Prozess ist nicht erforderlich.

Die globale Ansicht verwendet aus Performancegründen einen deterministischen
Punkte- und Gruppen-Layoutalgorithmus sowie einen stärksten evidenzbasierten
Spannwald. Nach dem Öffnen einer Gruppe zeigt die Clusteransicht weiterhin alle
projizierten SybilKit-Kanten. Der standardmäßige Cluster-Atlas verwendet keine
erfundenen Verbindungen zwischen Gruppen, sondern ordnet alle 263 Gruppen nach
Confidence, Punkteanteil und Größe.

Funding-Kanten sind tatsächliche Transfers und werden durchgezogen dargestellt.
Gestrichelte Kanten sind Verhaltensähnlichkeiten. Eine Gruppierung ist ein
Analysesignal und **kein Beweis gemeinsamer Eigentümerschaft**.

## Daten und Herkunft

- Contract: `0xcB0b0531e86A9aC36Fa865cA8e3dbccF047FDA91`
- Chain: Ethereum Mainnet
- Deployment-Block: `25.769.870`
- Snapshot: `data/curator_snapshot.json.gz`
- Analyse: das aus `github.com/banse/maxpane` geklonte und in
  `vendor/sybilkit` gepinnte SybilKit

Die App führt SybilKit beim Start über den Snapshot aus; die im UI gezeigten
Gruppen sind daher reproduzierbar und nicht als fertiges Graph-Ergebnis
eingebacken. Der genaue Upstream-Commit steht in
`vendor/sybilkit/UPSTREAM_COMMIT`.

Ein aktueller lokaler MaxPane-Stand kann so exportiert werden:

```bash
make snapshot
```

Der Export erwartet standardmäßig `~/.maxpane/curator_cache.json` und
`~/.maxpane/curator_raw_list.json`. Abweichende Pfade lassen sich direkt an
`scripts/export_snapshot.py` übergeben. Der Export speichert keine API-Keys.

## Architektur

Frontend und Backend halten die MVC-Grenzen bewusst klein:

- `src/clustermap/models`: Snapshot, SybilKit-Analyse und Graphprojektion
- `src/clustermap/controllers`: HTTP-Validierung und API-Routen
- `dashboard/src/models`: Typen, API-Client und reine Darstellungshilfen
- `dashboard/src/controllers`: UI-Zustand und asynchrone Abläufe
- `dashboard/src/views`: React-Ansichten ohne direkte API-Zugriffe

Die ursprüngliche Daten- und Graphherleitung steht in
`.claude/designs/clustermap.md`. Die Entscheidung zwischen `textual-serve`,
xterm.js und dem browsernativen MaxPane-Rebuild ist in
`.claude/designs/maxpane-the-list-web.md` dokumentiert. Layout, Risikostufen und
der aktuelle Map-Fokus stehen in
`.claude/designs/global-wallet-map-and-themes.md`.

## Qualitätssicherung

```bash
make test
```

Der Befehl führt Python-Tests, Ruff, Frontend-Tests, TypeScript-Prüfung und den
Produktionsbuild aus.

Konfiguration erfolgt über Umgebungsvariablen; `.env.example` dient als Vorlage.
Eine lokale `.env` kann vor dem Start mit
`set -a; source .env; set +a` geladen werden und wird nicht eingecheckt. Ein
optionaler `CLUSTERMAP_ETH_USD`-Wert dient ausschließlich der Anzeige; ohne ihn
zeigt die App bewusst „USD unavailable“.
