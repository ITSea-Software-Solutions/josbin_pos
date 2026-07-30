# 25. Opstellingen — elke vorm waarin een winkel verkocht kan worden

Zes manieren waarop een winkel Josbin POS kan draaien. Ze verschillen op één vraag:
**waar woont het winkelknooppunt?** Al het andere — kassa's, printers,
synchronisatie, aangifte — volgt uit dat antwoord.

Hoofdstuk 23 schetste er drie. Dit hoofdstuk is de volledige set, met de afweging
die elke vorm meebrengt en aan wie hij verkocht hoort te worden.

---

## 25.1 De ene regel die alles bepaalt

> **Wie het winkelknooppunt heeft, heeft de boekhouding, en een kassa kan alleen
> verkopen zolang zij het knooppunt kan bereiken.**

Lees elk diagram hieronder door die zin heen. De opstellingen waarin het knooppunt
in onze cloud staat, zijn de opstellingen waarin een wegvallende verbinding de
winkel laat stilvallen.

---

## 25.2 T1 — Knooppunt in de cloud, Android-kassa

<svg viewBox="0 0 700 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="An Android-kassa in the shop connecting over the internet to a shop node hosted in our cloud, which in turn reaches the control plane and the tax node" style="max-width:700px;width:100%;height:auto;font-family:sans-serif">
  <rect x="12" y="30" width="180" height="120" rx="10" fill="#ffffff" stroke="#9aa3b8" stroke-width="1.6" stroke-dasharray="4 3"/>
  <text x="102" y="24" text-anchor="middle" font-size="10.5" font-weight="700" fill="#6b7280">DE WINKEL</text>
  <rect x="52" y="52" width="100" height="66" rx="8" fill="#eef2fb" stroke="#293371" stroke-width="1.6"/>
  <text x="102" y="78" text-anchor="middle" font-size="18">📱</text>
  <text x="102" y="98" text-anchor="middle" font-size="10.5" fill="#111827">Android-kassa</text>
  <text x="102" y="112" text-anchor="middle" font-size="9" fill="#6b7280">printer op USB</text>
  <text x="102" y="140" text-anchor="middle" font-size="9.5" fill="#b91c1c">geen lokale gegevens</text>

  <line x1="196" y1="90" x2="286" y2="90" stroke="#b91c1c" stroke-width="2.5" stroke-dasharray="6 4"/>
  <polygon points="286,90 274,86 274,95" fill="#b91c1c"/>
  <text x="241" y="76" text-anchor="middle" font-size="10" font-weight="700" fill="#b91c1c">internet</text>
  <text x="241" y="110" text-anchor="middle" font-size="9.5" fill="#b91c1c">elke verkoop</text>

  <rect x="290" y="14" width="396" height="160" rx="10" fill="#f7f9fc" stroke="#293371" stroke-width="1.4" stroke-dasharray="4 3"/>
  <text x="488" y="9" text-anchor="middle" font-size="10.5" font-weight="700" fill="#293371">ONZE CLOUD</text>
  <rect x="306" y="52" width="130" height="66" rx="8" fill="#293371"/>
  <text x="371" y="76" text-anchor="middle" font-size="11" font-weight="700" fill="#ffffff">🗄 Winkelknooppunt</text>
  <text x="371" y="93" text-anchor="middle" font-size="9.5" fill="#c9d2ee">wij hosten het</text>
  <text x="371" y="108" text-anchor="middle" font-size="9.5" fill="#c9d2ee">de boeken staan HIER</text>
  <line x1="440" y1="72" x2="486" y2="60" stroke="#293371" stroke-width="1.6"/>
  <polygon points="486,60 475,58 478,67" fill="#293371"/>
  <rect x="490" y="38" width="182" height="40" rx="7" fill="#ffffff" stroke="#293371" stroke-width="1.5"/>
  <text x="581" y="55" text-anchor="middle" font-size="10.5" font-weight="700" fill="#111827">☁️ Beheerknooppunt</text>
  <text x="581" y="69" text-anchor="middle" font-size="9" fill="#6b7280">totalen · vloot · licenties</text>
  <line x1="440" y1="100" x2="486" y2="114" stroke="#1f6b3b" stroke-width="1.6"/>
  <polygon points="486,114 475,108 477,117" fill="#1f6b3b"/>
  <rect x="490" y="98" width="182" height="40" rx="7" fill="#ffffff" stroke="#1f6b3b" stroke-width="1.5"/>
  <text x="581" y="115" text-anchor="middle" font-size="10.5" font-weight="700" fill="#0e1a14">🏛 Belastingknooppunt</text>
  <text x="581" y="129" text-anchor="middle" font-size="9" fill="#5b6b62">BTW-aangiften, door de winkel ondertekend</text>
</svg>

De winkel heeft een terminal en verder niets. Geen pc, geen Docker, geen server om
te onderhouden, geen back-up om te vergeten.

::: danger Deze opstelling kan niet offline verkopen.
De kassa bewaart geen gegevens. Valt de verbinding weg, dan stopt de handel. Dat is
het tegenovergestelde van de belofte waarop de rest van dit product gebouwd is, en
het is **alleen** acceptabel waar het internet werkelijk betrouwbaar is — delen van
Paramaribo, en nergens in het binnenland. Zeg dat bij de verkoop, op papier.
:::

Intern ook duidelijk zijn: **hosten wij het knooppunt, dan hebben wij de
boekhouding van die winkel én hun klantgegevens.** D6 houdt persoonsgegevens
bewust buiten onze cloud. T1 zet ze er voor die klant weer in. Dat is een
WBP-S-verwerkingsrelatie met een eigen overeenkomst, een eigen bewaartermijn en
een eigen risico bij een inbreuk — niet zomaar een hostingkeuze.

**Verkoop aan:** marktkramen en kleine winkels in Paramaribo met glasvezel die
geen IT willen. **Verkoop nooit aan:** Nickerie, Marowijne, het binnenland.

---

## 25.3 T2 — Knooppunt in de cloud, Windows-kassa

<svg viewBox="0 0 700 190" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="One or more Windows kassas running the Electron app in the shop, connecting over the internet to a shop node hosted in our cloud" style="max-width:700px;width:100%;height:auto;font-family:sans-serif">
  <rect x="12" y="26" width="200" height="130" rx="10" fill="#ffffff" stroke="#9aa3b8" stroke-width="1.6" stroke-dasharray="4 3"/>
  <text x="112" y="20" text-anchor="middle" font-size="10.5" font-weight="700" fill="#6b7280">DE WINKEL</text>
  <rect x="28" y="46" width="80" height="56" rx="7" fill="#eef2fb" stroke="#293371" stroke-width="1.5"/>
  <text x="68" y="70" text-anchor="middle" font-size="16">🖥</text>
  <text x="68" y="90" text-anchor="middle" font-size="9.5" fill="#111827">.exe-kassa</text>
  <rect x="118" y="46" width="80" height="56" rx="7" fill="#eef2fb" stroke="#293371" stroke-width="1.5"/>
  <text x="158" y="70" text-anchor="middle" font-size="16">🖥</text>
  <text x="158" y="90" text-anchor="middle" font-size="9.5" fill="#111827">.exe-kassa</text>
  <text x="112" y="122" text-anchor="middle" font-size="9.5" fill="#6b7280">Electron-clients · printers op USB</text>
  <text x="112" y="140" text-anchor="middle" font-size="9.5" fill="#b91c1c">geen lokale gegevens · geen Docker</text>

  <line x1="216" y1="80" x2="306" y2="80" stroke="#b91c1c" stroke-width="2.5" stroke-dasharray="6 4"/>
  <polygon points="306,80 294,76 294,85" fill="#b91c1c"/>
  <text x="261" y="68" text-anchor="middle" font-size="10" font-weight="700" fill="#b91c1c">internet</text>
  <text x="261" y="100" text-anchor="middle" font-size="9.5" fill="#b91c1c">elke verkoop</text>

  <rect x="310" y="14" width="376" height="150" rx="10" fill="#f7f9fc" stroke="#293371" stroke-width="1.4" stroke-dasharray="4 3"/>
  <text x="498" y="9" text-anchor="middle" font-size="10.5" font-weight="700" fill="#293371">ONZE CLOUD</text>
  <rect x="326" y="48" width="126" height="62" rx="8" fill="#293371"/>
  <text x="389" y="72" text-anchor="middle" font-size="11" font-weight="700" fill="#ffffff">🗄 Winkelknooppunt</text>
  <text x="389" y="89" text-anchor="middle" font-size="9.5" fill="#c9d2ee">de boeken staan HIER</text>
  <line x1="456" y1="66" x2="500" y2="54" stroke="#293371" stroke-width="1.6"/>
  <polygon points="500,54 489,52 492,61" fill="#293371"/>
  <rect x="504" y="34" width="168" height="36" rx="7" fill="#ffffff" stroke="#293371" stroke-width="1.5"/>
  <text x="588" y="57" text-anchor="middle" font-size="10.5" font-weight="700" fill="#111827">☁️ Beheerknooppunt</text>
  <line x1="456" y1="94" x2="500" y2="108" stroke="#1f6b3b" stroke-width="1.6"/>
  <polygon points="500,108 489,102 491,111" fill="#1f6b3b"/>
  <rect x="504" y="90" width="168" height="36" rx="7" fill="#ffffff" stroke="#1f6b3b" stroke-width="1.5"/>
  <text x="588" y="113" text-anchor="middle" font-size="10.5" font-weight="700" fill="#0e1a14">🏛 Belastingknooppunt</text>
</svg>

Gelijk aan T1, met een andere kassa. Dezelfde waarschuwing, even hard: **geen
internet, geen handel.**

Het enige praktische voordeel boven T1 is dat een Windows-kassa later opgewaardeerd
kan worden — installeer er Docker op en het wordt T4, zonder nieuwe hardware. Goed
om te weten als de verbinding van een klant in Paramaribo tegenvalt.

---

## 25.4 T3 — Knooppunt op een backoffice-pc, Android-kassa's

<svg viewBox="0 0 700 210" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Android-kassas on the winkelnetwerk talking to a Windows PC running Docker, which reaches our cloud and the tax node only when internet is available" style="max-width:700px;width:100%;height:auto;font-family:sans-serif">
  <rect x="12" y="26" width="330" height="160" rx="10" fill="#ffffff" stroke="#1f6b3b" stroke-width="2"/>
  <text x="177" y="20" text-anchor="middle" font-size="10.5" font-weight="700" fill="#1d7a46">DE WINKEL — alles om te verkopen zit in dit vak</text>
  <rect x="28" y="42" width="76" height="52" rx="7" fill="#eef2fb" stroke="#293371" stroke-width="1.5"/>
  <text x="66" y="64" text-anchor="middle" font-size="15">📱</text>
  <text x="66" y="83" text-anchor="middle" font-size="9" fill="#111827">kassa</text>
  <rect x="114" y="42" width="76" height="52" rx="7" fill="#eef2fb" stroke="#293371" stroke-width="1.5"/>
  <text x="152" y="64" text-anchor="middle" font-size="15">📱</text>
  <text x="152" y="83" text-anchor="middle" font-size="9" fill="#111827">kassa</text>
  <rect x="200" y="42" width="76" height="52" rx="7" fill="#eef2fb" stroke="#293371" stroke-width="1.5"/>
  <text x="238" y="64" text-anchor="middle" font-size="15">🖥</text>
  <text x="238" y="83" text-anchor="middle" font-size="9" fill="#111827">kassa</text>
  <line x1="66" y1="96" x2="150" y2="122" stroke="#293371" stroke-width="1.6"/>
  <line x1="152" y1="96" x2="168" y2="122" stroke="#293371" stroke-width="1.6"/>
  <line x1="238" y1="96" x2="188" y2="122" stroke="#293371" stroke-width="1.6"/>
  <text x="290" y="112" text-anchor="middle" font-size="9.5" fill="#6b7280">winkelnetwerk — geen internet</text>
  <rect x="96" y="124" width="150" height="52" rx="8" fill="#293371"/>
  <text x="171" y="145" text-anchor="middle" font-size="11" font-weight="700" fill="#ffffff">🗄 Windows-pc + Docker</text>
  <text x="171" y="162" text-anchor="middle" font-size="9.5" fill="#c9d2ee">winkelknooppunt · de boeken</text>

  <line x1="250" y1="150" x2="360" y2="150" stroke="#9aa3b8" stroke-width="2" stroke-dasharray="5 4"/>
  <polygon points="360,150 349,146 349,155" fill="#9aa3b8"/>
  <text x="305" y="140" text-anchor="middle" font-size="9.5" font-weight="600" fill="#6b7280">als er internet is</text>
  <text x="305" y="172" text-anchor="middle" font-size="9" fill="#1d7a46">wacht in de rij als dat er niet is</text>

  <rect x="364" y="34" width="322" height="60" rx="8" fill="#ffffff" stroke="#293371" stroke-width="1.5"/>
  <text x="525" y="55" text-anchor="middle" font-size="10.5" font-weight="700" fill="#111827">☁️ Beheerknooppunt</text>
  <text x="525" y="72" text-anchor="middle" font-size="9" fill="#6b7280">totalen · Z-rapporten · vlootstatus · licentievernieuwing</text>
  <text x="525" y="86" text-anchor="middle" font-size="9" fill="#6b7280">nooit klantgegevens</text>
  <rect x="364" y="120" width="322" height="60" rx="8" fill="#ffffff" stroke="#1f6b3b" stroke-width="1.5"/>
  <text x="525" y="141" text-anchor="middle" font-size="10.5" font-weight="700" fill="#0e1a14">🏛 Belastingknooppunt</text>
  <text x="525" y="158" text-anchor="middle" font-size="9" fill="#5b6b62">BTW-aangiften, ondertekend door de winkel</text>
  <text x="525" y="172" text-anchor="middle" font-size="9" fill="#5b6b62">totalen per tarief — nooit regeldetail</text>
  <line x1="300" y1="160" x2="360" y2="150" stroke="#1f6b3b" stroke-width="0"/>
</svg>

**De standaard, en waar het product voor ontworpen is.** Verkoopt de hele dag door
met het internet plat. Elke Windows-machine volstaat — het hoeft geen server te
zijn en ook niet nieuw.

**Verkoop aan:** vrijwel iedereen. Winkels, bakkerijen, apotheken, overal met 2–5
kassa's.

---

## 25.5 T4 — Eén Windows-machine die zowel knooppunt als kassa is

<svg viewBox="0 0 700 180" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="A single Windows PC running both Docker with the shop node and the Electron kassa, reaching our cloud and the tax node when internet is available" style="max-width:700px;width:100%;height:auto;font-family:sans-serif">
  <rect x="12" y="26" width="300" height="132" rx="10" fill="#ffffff" stroke="#1f6b3b" stroke-width="2"/>
  <text x="162" y="20" text-anchor="middle" font-size="10.5" font-weight="700" fill="#1d7a46">DE WINKEL — één machine</text>
  <rect x="34" y="42" width="256" height="46" rx="7" fill="#eef2fb" stroke="#293371" stroke-width="1.5"/>
  <text x="162" y="62" text-anchor="middle" font-size="14">🖥</text>
  <text x="162" y="80" text-anchor="middle" font-size="9.5" fill="#111827">Josbin POS.exe — de kassa</text>
  <line x1="162" y1="90" x2="162" y2="100" stroke="#293371" stroke-width="1.6"/>
  <text x="220" y="99" text-anchor="middle" font-size="8.5" fill="#6b7280">localhost</text>
  <rect x="34" y="102" width="256" height="46" rx="7" fill="#293371"/>
  <text x="162" y="122" text-anchor="middle" font-size="10.5" font-weight="700" fill="#ffffff">🗄 Docker — het winkelknooppunt</text>
  <text x="162" y="138" text-anchor="middle" font-size="9" fill="#c9d2ee">zelfde machine, zelfde boeken</text>

  <line x1="318" y1="92" x2="392" y2="92" stroke="#9aa3b8" stroke-width="2" stroke-dasharray="5 4"/>
  <polygon points="392,92 381,88 381,97" fill="#9aa3b8"/>
  <text x="355" y="82" text-anchor="middle" font-size="9" fill="#6b7280">als er internet is</text>

  <rect x="396" y="28" width="290" height="50" rx="8" fill="#ffffff" stroke="#293371" stroke-width="1.5"/>
  <text x="541" y="48" text-anchor="middle" font-size="10.5" font-weight="700" fill="#111827">☁️ Beheerknooppunt</text>
  <text x="541" y="64" text-anchor="middle" font-size="9" fill="#6b7280">totalen · vloot · licentie</text>
  <rect x="396" y="106" width="290" height="50" rx="8" fill="#ffffff" stroke="#1f6b3b" stroke-width="1.5"/>
  <text x="541" y="126" text-anchor="middle" font-size="10.5" font-weight="700" fill="#0e1a14">🏛 Belastingknooppunt</text>
  <text x="541" y="142" text-anchor="middle" font-size="9" fill="#5b6b62">BTW-aangiften, door de winkel ondertekend</text>
</svg>

T3 samengevouwen op één machine. De `.exe` praat met `localhost` in plaats van met
een LAN-adres; verder verschilt er niets. Volledig offline bruikbaar.

**Het enige waarvoor je de winkel moet waarschuwen:** deze machine is nu de kassa
*en* de boekhouding. Zet een kassamedewerker hem bij sluitingstijd uit, dan draaien
de synchronisatie en het nachtelijke archief niet. De instelling voor automatisch
starten en het archiefschema wegen hier zwaarder dan waar dan ook.

**Verkoop aan:** eenkassa-winkels die al een Windows-pc hebben en offline willen
kunnen handelen — het eerlijke alternatief voor T1 en T2.

---

## 25.6 T5 — Meerdere Windows-machines, één daarvan aangewezen als knooppunt

<svg viewBox="0 0 700 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Several Windows kassas on a winkelnetwerk, one of which is designated to run Docker and the shop node, reaching our cloud als er internet is" style="max-width:700px;width:100%;height:auto;font-family:sans-serif">
  <rect x="12" y="26" width="330" height="152" rx="10" fill="#ffffff" stroke="#1f6b3b" stroke-width="2"/>
  <text x="177" y="20" text-anchor="middle" font-size="10.5" font-weight="700" fill="#1d7a46">DE WINKEL</text>
  <rect x="28" y="40" width="72" height="46" rx="7" fill="#eef2fb" stroke="#293371" stroke-width="1.5"/>
  <text x="64" y="60" text-anchor="middle" font-size="14">🖥</text>
  <text x="64" y="78" text-anchor="middle" font-size="8.5" fill="#111827">kassa</text>
  <rect x="110" y="40" width="72" height="46" rx="7" fill="#eef2fb" stroke="#293371" stroke-width="1.5"/>
  <text x="146" y="60" text-anchor="middle" font-size="14">🖥</text>
  <text x="146" y="78" text-anchor="middle" font-size="8.5" fill="#111827">kassa</text>
  <rect x="192" y="40" width="72" height="46" rx="7" fill="#eef2fb" stroke="#293371" stroke-width="1.5"/>
  <text x="228" y="60" text-anchor="middle" font-size="14">📱</text>
  <text x="228" y="78" text-anchor="middle" font-size="8.5" fill="#111827">kassa</text>
  <line x1="64" y1="88" x2="140" y2="114" stroke="#293371" stroke-width="1.5"/>
  <line x1="146" y1="88" x2="160" y2="114" stroke="#293371" stroke-width="1.5"/>
  <line x1="228" y1="88" x2="180" y2="114" stroke="#293371" stroke-width="1.5"/>
  <text x="292" y="104" text-anchor="middle" font-size="9" fill="#6b7280">winkelnetwerk</text>
  <rect x="76" y="116" width="180" height="52" rx="8" fill="#293371"/>
  <text x="166" y="136" text-anchor="middle" font-size="10.5" font-weight="700" fill="#ffffff">🗄 ÉÉN aangewezen pc</text>
  <text x="166" y="152" text-anchor="middle" font-size="9" fill="#c9d2ee">Docker · winkelknooppunt · de boeken</text>
  <text x="166" y="164" text-anchor="middle" font-size="8.5" fill="#EF6C00">het mag ook een kassa zijn</text>

  <line x1="260" y1="142" x2="350" y2="142" stroke="#9aa3b8" stroke-width="2" stroke-dasharray="5 4"/>
  <polygon points="350,142 339,138 339,147" fill="#9aa3b8"/>
  <text x="305" y="133" text-anchor="middle" font-size="9" fill="#6b7280">als er internet is</text>

  <rect x="356" y="30" width="330" height="52" rx="8" fill="#ffffff" stroke="#293371" stroke-width="1.5"/>
  <text x="521" y="51" text-anchor="middle" font-size="10.5" font-weight="700" fill="#111827">☁️ Beheerknooppunt</text>
  <text x="521" y="68" text-anchor="middle" font-size="9" fill="#6b7280">totalen · geconsolideerd beeld over de vestigingen</text>
  <rect x="356" y="112" width="330" height="52" rx="8" fill="#ffffff" stroke="#1f6b3b" stroke-width="1.5"/>
  <text x="521" y="133" text-anchor="middle" font-size="10.5" font-weight="700" fill="#0e1a14">🏛 Belastingknooppunt</text>
  <text x="521" y="150" text-anchor="middle" font-size="9" fill="#5b6b62">één aangifte per organisatie</text>
</svg>

Elke machine *kan* het hosten. Precies **één** moet het doen, en dat hoort een
opgeschreven besluit te zijn, geen gewoonte.

::: warning Draai nooit twee knooppunten in één winkel, en schakel nooit automatisch over.
Twee knooppunten die verkopen wegschrijven voor dezelfde vestiging betekent dubbele
verkoopnummers, twee Z-rapporten voor één dag, en twee BTW-aangiften die niet
kloppen. Herstellen betekent boeken met de hand samenvoegen.

Sterft de aangewezen pc, dan is het antwoord een **gedocumenteerde promotie**: zet
het laatste archief terug op een andere machine, wijs de kassa's om, activeer de
licentie opnieuw op de nieuwe vingerafdruk. Minuten werk, en voorspelbaar.
Automatisch overschakelen zou van een kapotte pc een kapotte boekhouding maken.
:::

**Verkoop aan:** winkels die al meerdere pc's hebben en geen zin hebben in een
server. Dezelfde software als T3.

---

## 25.7 T6 — Zelfstandig, geen Docker, eigen database (toekomst)

<svg viewBox="0 0 700 180" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="A single Android terminal or Windows PC running everything locally with its own embedded database, syncing to our cloud and the tax node als er internet is" style="max-width:700px;width:100%;height:auto;font-family:sans-serif">
  <rect x="12" y="26" width="300" height="130" rx="10" fill="#ffffff" stroke="#EF6C00" stroke-width="2.2"/>
  <text x="162" y="20" text-anchor="middle" font-size="10.5" font-weight="700" fill="#b35400">ÉÉN APPARAAT — verder niets</text>
  <rect x="34" y="42" width="120" height="98" rx="8" fill="#fff6ee" stroke="#EF6C00" stroke-width="1.6"/>
  <text x="94" y="68" text-anchor="middle" font-size="20">📱</text>
  <text x="94" y="90" text-anchor="middle" font-size="9.5" font-weight="700" fill="#111827">Android</text>
  <text x="94" y="106" text-anchor="middle" font-size="8.5" fill="#6b7280">native Kotlin-knooppunt</text>
  <text x="94" y="120" text-anchor="middle" font-size="8.5" fill="#6b7280">Room / SQLite</text>
  <text x="94" y="134" text-anchor="middle" font-size="8.5" fill="#b35400">sleutel in de Keystore</text>
  <rect x="168" y="42" width="122" height="98" rx="8" fill="#fff6ee" stroke="#EF6C00" stroke-width="1.6"/>
  <text x="229" y="68" text-anchor="middle" font-size="20">🖥</text>
  <text x="229" y="90" text-anchor="middle" font-size="9.5" font-weight="700" fill="#111827">Windows</text>
  <text x="229" y="106" text-anchor="middle" font-size="8.5" fill="#6b7280">Electron + ingebouwde database</text>
  <text x="229" y="120" text-anchor="middle" font-size="8.5" fill="#6b7280">geen Docker te installeren</text>
  <text x="229" y="134" text-anchor="middle" font-size="8.5" fill="#b35400">één .exe, één installatie</text>

  <line x1="318" y1="90" x2="392" y2="90" stroke="#9aa3b8" stroke-width="2" stroke-dasharray="5 4"/>
  <polygon points="392,90 381,86 381,95" fill="#9aa3b8"/>
  <text x="355" y="80" text-anchor="middle" font-size="9" fill="#6b7280">als er internet is</text>

  <rect x="396" y="28" width="290" height="50" rx="8" fill="#ffffff" stroke="#293371" stroke-width="1.5"/>
  <text x="541" y="48" text-anchor="middle" font-size="10.5" font-weight="700" fill="#111827">☁️ Beheerknooppunt</text>
  <text x="541" y="64" text-anchor="middle" font-size="9" fill="#6b7280">totalen · licentie · versleuteld archief</text>
  <rect x="396" y="104" width="290" height="50" rx="8" fill="#ffffff" stroke="#1f6b3b" stroke-width="1.5"/>
  <text x="541" y="124" text-anchor="middle" font-size="10.5" font-weight="700" fill="#0e1a14">🏛 Belastingknooppunt</text>
  <text x="541" y="140" text-anchor="middle" font-size="9" fill="#5b6b62">BTW-aangiften, door de winkel ondertekend</text>
</svg>

**Nu vastgelegd, later gebouwd.** Geen Docker, geen server, geen LAN — installeer
één app en verkoop. De installatie met de minste wrijving in het product, en de
meeste bouwinspanning, want de serverlogica van het winkelknooppunt moet op het
apparaat opnieuw gebouwd worden: Kotlin voor Android, en voor Windows een
ingebouwde database in de Electron-app.

Beide zijn **één kassa, afgedwongen door de licentie** — twee zelfstandige
apparaten in één winkel zouden twee boekhoudingen zijn. Zie
[§23.10](/nl/migration-architecture-plan/23-installs-and-artifacts).

Details voor de Android-kant staan in
[hoofdstuk 23](/nl/migration-architecture-plan/23-installs-and-artifacts). De
Windows-variant volgt dezelfde regels en dezelfde BTW-conformiteitsvectoren.

---

## 25.8 Naast elkaar

| | Knooppunt woont | Verkoopt offline | Boeken bij | Kassa's | Docker | Verkoop aan |
|---|---|---|---|---|---|---|
| **T1** | Onze cloud | ❌ **Nee** | **Ons** | 1+ Android | nee | Paramaribo, betrouwbare glasvezel, geen IT |
| **T2** | Onze cloud | ❌ **Nee** | **Ons** | 1+ Windows | nee | Idem, later op te waarderen naar T4 |
| **T3** | Pc van de winkel | ✅ Ja | De winkel | Android + Windows | ja | **De standaard** |
| **T4** | De kassa zelf | ✅ Ja | De winkel | 1 Windows | ja | Eén kassa, heeft al een pc |
| **T5** | Eén aangewezen pc | ✅ Ja | De winkel | Meerdere Windows | ja | Heeft pc's, geen server |
| **T6** | Het apparaat | ✅ Ja | De winkel | 1 | **nee** | Toekomst — minste wrijving |

Vier van de zes verkopen zonder internet. De twee die dat niet doen, zijn de twee
waar wij het knooppunt hebben — dezelfde zin als §25.1, van de andere kant gelezen.

---

## 25.9 Doorgeven via onze cloud mag. Opnieuw ondertekenen niet.

In elke opstelling kan de winkel ons bereiken en bereiken wij vervolgens het
belastingknooppunt. Dat werkt, met één grens die niet overschreden mag worden.

- ✅ **Doorgeven mag.** Onze infrastructuur mag een aangifte dragen, in de wachtrij
  zetten en doorsturen — nuttig als de verbinding van een winkel te slecht is om het
  belastingknooppunt rechtstreeks te bereiken, of als dat knooppunt plat ligt en
  iets de inzending moet vasthouden.
- ❌ **Opnieuw ondertekenen niet.** Wij openen een aangifte nooit, herberekenen hem
  niet en ondertekenen hem nooit als onszelf. D4 houdt ons buiten de bewijsketen, en
  hoofdstuk 22 is wat dat een doorgifte laat overleven: de signatuur zit op de
  **payload**, blijft dus geldig over willekeurig veel schakels, en bewijst dat de
  aangifte van de winkel is en ongewijzigd — ongeacht wiens verbinding hem droeg.

Dat is precies waarom hoofdstuk 22 payloads ondertekent en geen verbindingen. Een
doorgifte waaraan wij niet kunnen knoeien is operationeel handig; een doorgifte
waaraan wij wél zouden kunnen knoeien zou een nalevingsprobleem zijn.

---

## 25.10 Wisselen van opstelling

Klanten veranderen. Verbindingen vallen tegen, winkels groeien, er komen kassa's
bij. Dit zijn de overgangen die het waard zijn om goed te ondersteunen:

| Van → naar | Waarom het gebeurt | Wat ervoor nodig is |
|---|---|---|
| **T1/T2 → T3/T4** | Internet bleek onbetrouwbaar | Exporteren uit het cloudknooppunt, lokaal installeren, importeren, kassa's omwijzen. **Degene die we het vaakst nodig hebben.** |
| **T4 → T3** | Er komt een tweede kassa | Docker naar een backoffice-pc verplaatsen, of laten staan en kassa's toevoegen; beide werkt |
| **T4 → T5** | Meer pc's, nog steeds geen server | Wijs de host aan, wijs de rest om |
| **T3 → T5** | Backoffice-pc vervangen | Gedocumenteerde promotie — §25.6 |
| **T6 → T3** | Zelfstandige winkel groeit | Archief exporteren, installeren, importeren, het apparaat omzetten naar kassa (§23.10) |
| **T3 → T1/T2** | Winkel wil helemaal van IT af | Archief uploaden, wij zetten het terug in een gehost knooppunt |

Stuk voor stuk dezelfde drie handelingen — **exporteren, importeren, omwijzen** —
en juist daarom zijn het versleutelde archief en het importpad dragende
infrastructuur en geen back-upfunctie. Bouw ze één keer, goed.

---

## 25.11 Wat dit toevoegt aan de bouwlijst

| # | Te bouwen | Waar |
|---|---|---|
| N49 | Gehoste winkelknooppunten voor T1/T2 — inrichten, isolatie, eigen verwerkersovereenkomst | ☁️ Control |
| N50 | Waarschuwing over niet-offline werken in het product zelf voor T1/T2, niet alleen in het contract | 🏪 + ☁️ |
| N51 | Afdwingen van één aangewezen knooppunt: een tweede per vestiging weigeren, twee detecteren | ☁️ Control |
| N52 | Gedocumenteerde knooppuntpromotie: archief terugzetten → kassa's omwijzen → licentie heractiveren | 🏪 + ☁️ |
| N53 | Opstelling vastgelegd op het knooppunt en gemeld in de vlootstatus | 🏪 → ☁️ |
| N54 | Migratiegereedschap: exporteren → importeren → omwijzen, beproefd voor elke rij in §25.10 | All |
| N55 | Zelfstandig Windows — Electron met ingebouwde database, geen Docker | 🖥 Standalone |

N51 en N52 tellen eerder dan ze lijken. De eerste winkel die Docker "voor de
zekerheid" op twee machines zet, vertelt het ons niet, en ontdekt het probleem aan
het eind van een handelsdag.
