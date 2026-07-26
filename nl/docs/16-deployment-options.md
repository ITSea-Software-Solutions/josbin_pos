# 16. De vier manieren om Josbin POS te draaien

Josbin POS bestaat altijd uit twee helften: de **kassa** (wat de caissière
aanraakt) en de **server** (waar producten, verkopen en rapporten leven).
Elke helft heeft twee opties, en elke combinatie werkt:

|  | **Server in de winkel** (lokaal) | **Server in de cloud** (op afstand) |
|---|---|---|
| **Windows-kassa** | A — De klassieke winkel | B — Windows-kassa zonder server-PC |
| **Android-kassa** | C — De moderne toonbank | D — De lichtste start |

De ene vraag die de kolommen scheidt: **kan ik nog verkopen als het
internet uitvalt?** Server in de winkel: **ja**. Cloudserver: **nee** (een
telefoonhotspot overbrugt korte storingen).

U kiest per winkel — en kassa's mogen door elkaar (§16.6).

## 16.1 Opzet A — Windows-kassa + server in de winkel *(de klassieke winkel)*

De vorm die de meeste supermarkten kiezen. Alles staat in de winkel; het
internet dient alleen om resultaten naar het hoofdkantoor te sturen.

<svg viewBox="0 0 640 300" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Windows-kassa en server-PC in de winkel, printer en lade op het lokale netwerk, internet optioneel" style="max-width:640px;width:100%;height:auto;font-family:sans-serif">
  <rect x="250" y="10" width="140" height="40" rx="8" fill="none" stroke="#9aa3b8" stroke-width="2" stroke-dasharray="6 5"/>
  <text x="320" y="35" text-anchor="middle" font-size="14" fill="#6b7280">☁️ Internet</text>
  <text x="400" y="35" font-size="11" fill="#EF6C00">optioneel — alleen sync</text>
  <line x1="320" y1="50" x2="320" y2="90" stroke="#9aa3b8" stroke-width="2" stroke-dasharray="3 5"/>
  <rect x="245" y="90" width="150" height="46" rx="8" fill="#293371"/>
  <text x="320" y="118" text-anchor="middle" font-size="14" fill="#ffffff">📡 Winkelrouter</text>
  <line x1="120" y1="180" x2="290" y2="136" stroke="#293371" stroke-width="2.5"/>
  <line x1="320" y1="136" x2="320" y2="180" stroke="#293371" stroke-width="2.5"/>
  <line x1="520" y1="180" x2="350" y2="136" stroke="#293371" stroke-width="2.5"/>
  <rect x="30" y="180" width="180" height="72" rx="10" fill="#ffffff" stroke="#293371" stroke-width="2.5"/>
  <text x="120" y="207" text-anchor="middle" font-size="14" fill="#111827">🖥 Windows-kassa</text>
  <text x="120" y="228" text-anchor="middle" font-size="12" fill="#6b7280">scanner zit hierin</text>
  <rect x="240" y="180" width="160" height="72" rx="10" fill="#ffffff" stroke="#293371" stroke-width="2.5"/>
  <text x="320" y="207" text-anchor="middle" font-size="14" fill="#111827">🗄 Server-PC</text>
  <text x="320" y="228" text-anchor="middle" font-size="12" fill="#6b7280">elke Windows-PC</text>
  <rect x="430" y="180" width="180" height="72" rx="10" fill="#ffffff" stroke="#293371" stroke-width="2.5"/>
  <text x="520" y="203" text-anchor="middle" font-size="14" fill="#111827">🖨 Bonprinter</text>
  <text x="520" y="222" text-anchor="middle" font-size="12" fill="#6b7280">netwerk of USB-aan-kassa</text>
  <line x1="520" y1="252" x2="520" y2="272" stroke="#111827" stroke-width="2"/>
  <text x="527" y="270" font-size="11" fill="#6b7280">RJ11</text>
  <rect x="455" y="272" width="130" height="24" rx="6" fill="#f3f4f6" stroke="#9aa3b8" stroke-width="1.5"/>
  <text x="520" y="289" text-anchor="middle" font-size="12" fill="#111827">💵 Geldlade</text>
  <rect x="30" y="268" width="250" height="28" rx="6" fill="#e9f7ef"/>
  <text x="155" y="287" text-anchor="middle" font-size="13" fill="#1d7a46">✅ Internet weg → verkopen gaat door</text>
</svg>

- **Nodig:** een Windows-kassa + een willekeurige Windows-PC als server (een
  oude kantoor-PC volstaat — of in een éénkassawinkel is de kassa zelf de
  server).
- **Printer:** netwerk *of* USB rechtstreeks in de kassa — op Windows werkt
  allebei.
- **Ideaal voor:** elke winkel waar "we kunnen niet verkopen" onacceptabel is.

## 16.2 Opzet B — Windows-kassa + cloudserver

Geen server-PC in de winkel — de kassa praat via internet met de cloud.

<svg viewBox="0 0 640 260" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Windows-kassa die via internet met een cloudserver verbindt" style="max-width:640px;width:100%;height:auto;font-family:sans-serif">
  <rect x="420" y="20" width="190" height="60" rx="10" fill="#293371"/>
  <text x="515" y="46" text-anchor="middle" font-size="14" fill="#ffffff">☁️ Cloudserver</text>
  <text x="515" y="66" text-anchor="middle" font-size="12" fill="#c7d2fe">producten · verkopen · rapporten</text>
  <rect x="250" y="120" width="150" height="46" rx="8" fill="#ffffff" stroke="#293371" stroke-width="2.5"/>
  <text x="325" y="148" text-anchor="middle" font-size="14" fill="#111827">📡 Router</text>
  <line x1="400" y1="130" x2="450" y2="80" stroke="#EF6C00" stroke-width="3"/>
  <text x="437" y="112" font-size="12" fill="#EF6C00">internet — vereist</text>
  <rect x="30" y="120" width="180" height="72" rx="10" fill="#ffffff" stroke="#293371" stroke-width="2.5"/>
  <text x="120" y="147" text-anchor="middle" font-size="14" fill="#111827">🖥 Windows-kassa</text>
  <text x="120" y="168" text-anchor="middle" font-size="12" fill="#6b7280">scanner + printer + lade</text>
  <line x1="210" y1="143" x2="250" y2="143" stroke="#293371" stroke-width="2.5"/>
  <rect x="30" y="212" width="350" height="28" rx="6" fill="#fdecec"/>
  <text x="205" y="231" text-anchor="middle" font-size="13" fill="#b3261e">⛔ Internet weg → geen verkoop (hotspot overbrugt korte storingen)</text>
</svg>

- **Nodig:** alleen de kassa en betrouwbaar internet. Printer/lade/scanner
  werken gewoon — die horen bij de kassa, niet bij de server.
- **Ideaal voor:** kleine stadswinkels met stabiel internet en geen PC over.

## 16.3 Opzet C — Android-kassa + server in de winkel *(de moderne toonbank)*

De Posiflex-achtige opzet: een Android-terminal aan de toonbank, een PC in
het kantoortje die het systeem draait, alles op het eigen winkelnetwerk.

<svg viewBox="0 0 640 300" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Android-terminal op wifi met server-PC en netwerkprinter met geldlade, internet optioneel" style="max-width:640px;width:100%;height:auto;font-family:sans-serif">
  <rect x="250" y="10" width="140" height="40" rx="8" fill="none" stroke="#9aa3b8" stroke-width="2" stroke-dasharray="6 5"/>
  <text x="320" y="35" text-anchor="middle" font-size="14" fill="#6b7280">☁️ Internet</text>
  <text x="400" y="35" font-size="11" fill="#EF6C00">optioneel — alleen sync</text>
  <line x1="320" y1="50" x2="320" y2="90" stroke="#9aa3b8" stroke-width="2" stroke-dasharray="3 5"/>
  <rect x="245" y="90" width="150" height="46" rx="8" fill="#293371"/>
  <text x="320" y="118" text-anchor="middle" font-size="14" fill="#ffffff">📡 Winkelrouter</text>
  <line x1="120" y1="180" x2="290" y2="136" stroke="#293371" stroke-width="2.5" stroke-dasharray="7 5"/>
  <text x="160" y="152" font-size="11" fill="#293371">wifi</text>
  <line x1="320" y1="136" x2="320" y2="180" stroke="#293371" stroke-width="2.5"/>
  <line x1="520" y1="180" x2="350" y2="136" stroke="#293371" stroke-width="2.5"/>
  <text x="450" y="152" font-size="11" fill="#293371">kabel</text>
  <rect x="30" y="180" width="180" height="72" rx="10" fill="#ffffff" stroke="#293371" stroke-width="2.5"/>
  <text x="120" y="207" text-anchor="middle" font-size="14" fill="#111827">📱 Android-kassa</text>
  <text x="120" y="228" text-anchor="middle" font-size="12" fill="#6b7280">alleen de scanner zit erin</text>
  <rect x="240" y="180" width="160" height="72" rx="10" fill="#ffffff" stroke="#293371" stroke-width="2.5"/>
  <text x="320" y="207" text-anchor="middle" font-size="14" fill="#111827">🗄 Server-PC</text>
  <text x="320" y="228" text-anchor="middle" font-size="12" fill="#6b7280">elke Windows-PC</text>
  <rect x="430" y="180" width="180" height="72" rx="10" fill="#ffffff" stroke="#EF6C00" stroke-width="2.5"/>
  <text x="520" y="203" text-anchor="middle" font-size="14" fill="#111827">🖨 Netwerkprinter</text>
  <text x="520" y="222" text-anchor="middle" font-size="12" fill="#EF6C00">moet op het netwerk</text>
  <line x1="520" y1="252" x2="520" y2="272" stroke="#111827" stroke-width="2"/>
  <text x="527" y="270" font-size="11" fill="#6b7280">RJ11</text>
  <rect x="455" y="272" width="130" height="24" rx="6" fill="#f3f4f6" stroke="#9aa3b8" stroke-width="1.5"/>
  <text x="520" y="289" text-anchor="middle" font-size="12" fill="#111827">💵 Geldlade</text>
  <rect x="30" y="268" width="250" height="28" rx="6" fill="#e9f7ef"/>
  <text x="155" y="287" text-anchor="middle" font-size="13" fill="#1d7a46">✅ Internet weg → verkopen gaat door</text>
</svg>

- **Nodig:** Android-terminal(s) + een PC als server + een **netwerk-**
  bonprinter (dé harde regel op Android — zie
  [hoofdstuk 15](/nl/docs/15-android-terminals)).
- **Ideaal voor:** toonbanken met moderne Android-hardware die tóch
  offline-bestendig moeten zijn.

## 16.4 Opzet D — Android-kassa + cloudserver *(de lichtste start)*

Nul computers in de winkel. Eén Android-terminal, rechtstreeks naar de cloud.

<svg viewBox="0 0 640 260" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Android-terminal die via internet met een cloudserver verbindt" style="max-width:640px;width:100%;height:auto;font-family:sans-serif">
  <rect x="420" y="20" width="190" height="60" rx="10" fill="#293371"/>
  <text x="515" y="46" text-anchor="middle" font-size="14" fill="#ffffff">☁️ Cloudserver</text>
  <text x="515" y="66" text-anchor="middle" font-size="12" fill="#c7d2fe">producten · verkopen · rapporten</text>
  <rect x="250" y="120" width="150" height="46" rx="8" fill="#ffffff" stroke="#293371" stroke-width="2.5"/>
  <text x="325" y="148" text-anchor="middle" font-size="14" fill="#111827">📡 Router</text>
  <line x1="400" y1="130" x2="450" y2="80" stroke="#EF6C00" stroke-width="3"/>
  <text x="437" y="112" font-size="12" fill="#EF6C00">internet — vereist</text>
  <rect x="30" y="120" width="180" height="72" rx="10" fill="#ffffff" stroke="#293371" stroke-width="2.5"/>
  <text x="120" y="147" text-anchor="middle" font-size="14" fill="#111827">📱 Android-kassa</text>
  <text x="120" y="168" text-anchor="middle" font-size="12" fill="#6b7280">scanner op de kassa</text>
  <line x1="210" y1="143" x2="250" y2="143" stroke="#293371" stroke-width="2.5" stroke-dasharray="7 5"/>
  <rect x="30" y="212" width="350" height="28" rx="6" fill="#fdecec"/>
  <text x="205" y="231" text-anchor="middle" font-size="13" fill="#b3261e">⛔ Internet weg → geen verkoop (hotspot overbrugt korte storingen)</text>
</svg>

- **Nodig:** de terminal, wifi, betrouwbaar internet. Een netwerkprinter op
  dezelfde wifi voor bonnen + lade.
- **Ideaal voor:** de kleinste winkels die hun allereerste stap zetten —
  later opwaarderen naar opzet C door er een PC bij te zetten.

## 16.5 Kiezen in drie vragen

| Vraag | Bij **ja** | Bij **nee** |
|---|---|---|
| 1. Moet u kunnen verkopen als het internet uitvalt? | Server in de winkel (A of C) | Cloud is prima (B of D) |
| 2. Staat er ergens in de winkel een Windows-PC (mag oud zijn)? | Die kan de server zijn — A of C kost geen nieuwe hardware | Cloud (B/D), of reken ± USD 150–200 voor een mini-PC |
| 3. Welke kassa's heeft u? | Windows-machines → A/B · Android-terminals → C/D | Nieuw aan het kopen? Beide platforms worden volledig ondersteund — kies op hardware­voorkeur, niet op software |

**Regels die in élke opzet gelden:**

- De **scanner** zit altijd in de kassa en werkt direct.
- De **geldlade** zit altijd met haar kabel aan de **printer** — nooit aan
  een computer (waarom: [hoofdstuk 15 §15.1](/nl/docs/15-android-terminals)).
- De **printer**: netwerk kan in elke opzet; USB kan alléén extra op
  Windows-kassa's.
- Het **dashboard** heeft nergens een extra machine nodig — elke browser op
  het netwerk (of op internet, bij cloudopzetten) opent het.

## 16.6 Mengen — één winkel, beide kassatypes

De vier opzetten zijn keuzes per *winkel*, geen contracten. Een winkel kan
een **Windows-kassa en een Android-kassa naast elkaar op dezelfde server**
draaien — ze delen producten, voorraad, kassasessies en rapporten, want de
server is de enige bron van waarheid en elke kassa is slechts een scherm
erop. Een keten kan net zo goed opzet A in de hoofdvestiging draaien en
opzet D in een kiosk.

**Eén planningsnotitie:** een bestaande winkel *verhuizen* tussen de
kolommen — lokale server ↔ cloud — is een datamigratie (de verkoophistorie
verhuist mee). Routine, maar wél gepland werk met uw leverancier, geen
instelling op de kassa. Kies de kolom per winkel met een horizon van een
jaar, niet van een week.

**Verder lezen:** offline-gedrag uur voor uur in
[hoofdstuk 7](/nl/docs/07-sync-and-offline) · alles over Android in
[hoofdstuk 15](/nl/docs/15-android-terminals) · installatiestappen in de
[installatiegids](/nl/docs/00-installation-and-setup).
