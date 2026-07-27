# 13 — De kassa-apps bouwen en uitbrengen

Hoe u de twee client-applicaties — de **Windows-desktopapp** (`.exe`) en de
**Android-terminalapp** (`.apk`) — met de hand bouwt, controleert en
publiceert, lokaal, zonder CI.

Beide apps zijn **dezelfde React-codebase**, op twee manieren verpakt:

```
frontend/src/            ← de kassa zelf. Eén codebase, beide platforms.
        /electron/       ← Windows-schil (main process, printen, IPC)
        /android/        ← Android-schil (Capacitor + eigen Java-plugins)
        /dist/           ← de gecompileerde webbundel die BEIDE schillen gebruiken
```

Die gedeelde `dist/` is het belangrijkste om te begrijpen vóór u iets bouwt —
zie [§13.3](#_13-3-de-gedeelde-dist-valkuil).

---

## 13.1 Gereedschap

| Tool | Versie | Waarom deze |
|---|---|---|
| Node (app-builds, tests) | 20.x | Waar `frontend/package.json` op is vastgezet |
| Node (alleen Capacitor CLI) | **≥ 22** | `npx cap` weigert te starten onder 22 |
| JDK | 21 (meegeleverd met Android Studio) | Gradle-toolchain |
| Android SDK | platform 36, build-tools 36 | `compileSdk = 36` |
| Xcode CLT / Windows-buildhost | — | electron-builder bouwt de `.exe` vanaf macOS |

### Het twee-Node-probleem

De repo draait op Node 20, maar de Capacitor CLI faalt daar hard op:

```
[fatal] The Capacitor CLI requires NodeJS >=22.0.0
```

Houd een nieuwere Node beschikbaar en zet die **alleen voor de
`cap`-commando's** vooraan in `PATH`. Op macOS met Homebrew naast nvm:

```bash
export PATH=/opt/homebrew/bin:$PATH   # Node 25 van Homebrew
node -v                               # controleer vóór u cap draait
```

Al het andere — `vite build`, `vitest`, `tsc`, `electron-builder` — draait
prima op Node 20.

### Locatie van de Android-SDK

`android/local.properties` staat **niet in git**, dus een verse clone heeft
geen SDK-pad en Gradle faalt met:

```
SDK location not found. Define a valid SDK location with an ANDROID_HOME
environment variable or by setting the sdk.dir path in local.properties
```

Exporteer het in plaats van een machinegebonden bestand te committen:

```bash
export ANDROID_HOME=$HOME/Library/Android/sdk        # macOS
# export ANDROID_HOME=$HOME/Android/Sdk              # Linux
# set ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk        # Windows
```

---

## 13.2 Waar de versie staat

Twee bestanden, en ze moeten overeenkomen:

| Bestand | Veld | Voorbeeld |
|---|---|---|
| `frontend/package.json` | `version` | `1.4.3` |
| `frontend/android/app/build.gradle` | `versionName` | `"1.4.3"` |
| `frontend/android/app/build.gradle` | `versionCode` | `10403` |

`versionName` is de leesbare tekst. **`versionCode` is waar Android
daadwerkelijk op controleert** bij het bijwerken — een build waarvan de
`versionCode` niet hoger is dan de geïnstalleerde, wordt geweigerd. Leid hem
mechanisch af:

```
versionCode = MAJOR × 10000 + MINOR × 100 + PATCH
1.4.3 → 10403      1.5.0 → 10500      2.0.0 → 20000
```

> Elke APK van 1.0.0 tot 1.4.0 had `versionCode 1`, omdat de
> Capacitor-template dat zo zet en alleen `versionName` werd bijgewerkt.
> Android kon nieuwere builds daardoor als duplicaat zien en weigeren.

**Regel: de `.exe` en de `.apk` worden altijd samen uitgebracht, op dezelfde
versie, vanaf dezelfde commit.** Een winkel mag zich nooit hoeven afvragen of
zijn Windows-kassa's en Android-terminals op gelijke software draaien.

---

## 13.3 De gedeelde `dist/`-valkuil {#_13-3-de-gedeelde-dist-valkuil}

`frontend/dist/` wordt door Vite gebouwd en door **drie** doelen gebruikt, die
elk een *andere* API-URL ingebakken nodig hebben:

| Doel | Nodig: `VITE_API_URL` | Waarom |
|---|---|---|
| Web-POS (door de droplet geserveerd) | `/api` (relatief) | Zelfde origin als de pagina |
| Android-APK | `http://<server>:8080/api` (absoluut) | De app is een bestand op het toestel — er is geen origin om relatief aan te zijn |
| Windows-exe | absoluut, of tijdens gebruik via **⚙ Server** | Laadt via `file://` |

Omdat ze één map delen, **is de volgorde bepalend**: wie het laatst bouwt,
bezit `dist/`. `scripts/deploy-server.sh` bouwt `dist/` zelf opnieuw met de
relatieve URL, dus:

> **Deploy eerst de server, bouw dáárna `dist/` opnieuw voor de APK.**
> Andersom duwt u een APK-bundel (absolute droplet-URL) naar de web-POS, of
> levert u een APK die `/api` op zichzelf probeert aan te roepen.

---

## 13.4 De Android-APK bouwen

Vanuit `frontend/`:

```bash
export PATH=/opt/homebrew/bin:$PATH
export ANDROID_HOME=$HOME/Library/Android/sdk
```

**Stap 1 — compileer de webbundel met de server-URL erin.**
`npm_package_version` zet npm normaal zelf; geef hem handmatig mee als u
`vite` direct aanroept, anders toont Instellingen `dev` als versie.

```bash
npm_package_version=1.4.3 VITE_API_URL=http://142.93.88.143:8080/api npx vite build
```

**Stap 2 — kopieer bundel en pluginregistraties naar het Android-project.**

```bash
npx cap sync android
```

Hij noemt de Capacitor-plugins die hij vindt. Onze eigen native plugins
(`UsbPrinterPlugin`, `TcpSocketPlugin`) zijn *lokale Java-klassen*, geen
npm-pakketten, en verschijnen daar dus **niet** — zie
[§13.8](#_13-8-eigen-android-plugins).

**Stap 3 — bouw de APK.**

```bash
cd android && ./gradlew assembleDebug
```

Resultaat: `frontend/android/app/build/outputs/apk/debug/app-debug.apk`

> **Bewust een debug-build.** Die is zelf-ondertekend en te sideloaden, wat
> veldterminals nodig hebben. Een release-APK vereist een keystore die we nog
> niet beheren. Android heeft hoe dan ook geen betaald certificaat nodig.

---

## 13.5 De Windows-exe bouwen

Vanuit `frontend/`:

```bash
npm run build:win
```

Dat draait `electron-vite build` en daarna `electron-builder --win --x64`, en
schrijft `frontend/release/Josbin POS Setup <versie>.exe`.

Goed om te weten:

- **Bouwt vanaf macOS of Linux** — geen Windows-machine nodig.
- **`build/installer.nsh`** vervangt de NSIS-controle op een draaiende app
  door `taskkill /F /IM … /T`. Een kassa draait schermvullend zonder
  vensterrand, dus er is geen venster om te sluiten; zonder dit liep
  bijwerken vast op *"Josbin POS cannot be closed"*.
- **De exe is niet ondertekend.** Windows waarschuwt bij downloaden en
  installeren tot er een code-signing-certificaat is aangeschaft.
  `signing with signtool.exe` in het buildlog betekent **niet** dat er
  ondertekend is — die stap doet niets zonder certificaat.

---

## 13.6 Controleren of uw wijziging écht in de build zit

Ga er niet vanuit dat het artefact bevat wat u net schreef. Beide schillen
hebben eerder stilletjes verouderde of ontbrekende code meegeleverd.

**Android — lees het manifest úit de gebouwde APK**, niet uit de broncode.
Een vergeten permissie of feature is onzichtbaar in de diff maar fataal
tijdens gebruik:

```bash
AAPT=$ANDROID_HOME/build-tools/36.0.0/aapt2
APK=android/app/build/outputs/apk/debug/app-debug.apk

$AAPT dump badging "$APK" | head -1          # package, versionCode, versionName
$AAPT dump xmltree --file AndroidManifest.xml "$APK" | grep -i usb
```

**Android — zit de JS werkelijk in de bundel:**

```bash
grep -l "eenHerkenbareString" android/app/src/main/assets/public/assets/*.js
```

**Android — zit een native pluginklasse erin.** Debug-builds splitsen dex,
dus controleer *elke* `classesN.dex`:

```bash
unzip -p "$APK" 'classes*.dex' | strings | grep UsbPrinterPlugin
```

> Aanwezigheid van uw code is noodzakelijk, niet voldoende. Een plugin kan in
> `classes8.dex` zitten, zijn bibliotheek gelinkt, zijn JS gebundeld — en tóch
> niets teruggeven omdat het besturingssysteem nooit om toestemming is
> gevraagd. Controleer het **manifest**, niet alleen de code.

**Beide platforms — de draaiende versie staat in de app:** Instellingen →
onderaan de pagina staat bijv. `v1.4.3 · android`. Bij een melding "werkt nog
steeds niet" is dat het eerste om te controleren.

---

## 13.7 Een release publiceren

**Stap 1 — noem de artefacten volgens de conventie.** De downloadpagina en
het installer-endpoint lezen de versie uit de bestandsnaam:

```
josbin-pos-demo-Setup-1.4.3.exe
josbin-pos-demo-1.4.3.apk
```

**Stap 2 — checksum-bestanden**, zodat een halve download te herkennen is:

```bash
cd downloads
shasum -a 256 josbin-pos-demo-Setup-1.4.3.exe | awk '{print $1}' > josbin-pos-demo-Setup-1.4.3.exe.sha256
shasum -a 256 josbin-pos-demo-1.4.3.apk       | awk '{print $1}' > josbin-pos-demo-1.4.3.apk.sha256
```

**Stap 3 — genereer de publieke downloadpagina opnieuw.** Die leest de échte
bestanden van schijf, dus versies, groottes en checksums kunnen nooit
afwijken van de werkelijkheid:

```bash
node scripts/build-downloads-page.mjs
# → "downloads page built: exe 1.4.3, apk 1.4.3 (in sync)"
```

Staat er `(VERSIONS DIFFER!)`, dan staat u op het punt een niet-passend paar
uit te brengen. Stoppen.

**Stap 4 — uploaden en op de server verifiëren.** Vertrouw de overdracht
nooit:

```bash
rsync -az downloads/josbin-pos-demo-*1.4.3* root@142.93.88.143:/var/www/html/downloads/

ssh root@142.93.88.143 'cd /var/www/html/downloads && for f in josbin-pos-demo-Setup-1.4.3.exe josbin-pos-demo-1.4.3.apk; do
  a=$(sha256sum "$f" | cut -d" " -f1); e=$(cat "$f.sha256")
  [ "$a" = "$e" ] && echo "OK $f" || echo "MISMATCH $f"; done'
```

**Stap 5 — deploy de documentatie, duw dáárna de downloadpagina.** Deze
volgorde gaat vaak mis:

```bash
./scripts/deploy-server.sh
rsync -az marketing/downloads.html \
  root@142.93.88.143:/var/www/html/docs-site/.vitepress/dist/downloads.html
```

> De publieke pagina wordt **vanuit de VitePress-dist geserveerd**, niet
> vanuit `marketing/`. `deploy-server.sh` kopieert hem daar tijdens een
> deploy — genereert u de pagina ná het deployen opnieuw, dan blijft de
> geserveerde kopie oud. In combinatie met een hernoemd artefact geeft de
> live downloadlink dan een 404 terwijl het bestand vrolijk op schijf staat.

**Stap 6 — controleer de links, niet alleen de pagina.** Een pagina die er
goed uitziet is precies wat een kapotte link verbergt:

```bash
for f in $(curl -s http://142.93.88.143:8095/downloads.html | grep -o '/downloads/josbin[^"]*'); do
  printf "%-44s " "$f"; curl -sI "http://142.93.88.143:8095$f" | head -1
done
```

**Stap 7 — schrijf de release notes** in `docs/17-release-notes.md` en de
Nederlandse tegenhanger `nl/docs/17-release-notes.md`, in gewone winkeltaal,
en deploy de documentatie opnieuw.

---

## 13.8 Eigen Android-plugins {#_13-8-eigen-android-plugins}

Alles wat de WebView niet kan — ruwe TCP-sockets, USB-printen — is een kleine
Java-klasse die aan JS wordt aangeboden.

```
android/app/src/main/java/sr/josbin_pos/pos/
  MainActivity.java        ← registreert elke lokale plugin
  UsbPrinterPlugin.java    ← USB Host API: lijst, toestemming, bulk write
  TcpSocketPlugin.java     ← ruwe TCP voor netwerkprinters
```

Een nieuwe toevoegen:

1. Schrijf de klasse met `@CapacitorPlugin(name = "MijnDing")` en
   `@PluginMethod`-methodes.
2. **Registreer hem in `MainActivity.onCreate` vóór `super.onCreate()`** —
   plugins moeten bestaan voordat de bridge initialiseert.
3. Declareer elke OS-mogelijkheid die hij nodig heeft in
   `AndroidManifest.xml`. Dat hoort bij de functie, het is geen formaliteit:
   zonder `<uses-feature android:name="android.hardware.usb.host" />` geeft
   `UsbManager.getDeviceList()` een **lege lijst**, wat u ook aansluit.
4. Koppel hem vanuit TS met `registerPlugin<T>('MijnDing')` — zie
   `src/lib/usbPrinter.ts`.
5. Vang aanroepen af zodat ze op andere platforms netjes falen;
   `registerPlugin` werkt alleen binnen de APK.

**Data die de bridge oversteekt moet een gewone, kloonbare waarde zijn.**
Stuur `number[]`, nooit een `Buffer` of een typed array met methodes. De
Electron-renderer draait in een sandbox, waar `Buffer` niet bestaat en de
aanroep faalt vóór er ook maar IPC plaatsvindt — dezelfde discipline houdt
beide bridges eerlijk.

---

## 13.9 App-iconen

Eén vierkant bronbestand levert elk icoon op beide platforms:

```bash
# zet het beeldmerk op brand/josbin-icon-source.png (vierkant, ≥1024×1024)
node scripts/generate-app-icons.mjs
```

Schrijft alle 5 Android-dichtheden (legacy, rond en de adaptieve voorgrond)
plus `frontend/build/icon.png` voor de exe en de installer. Bouw daarna beide
apps opnieuw — iconen worden meegecompileerd, niet tijdens gebruik geladen.

---

## 13.10 Volledige release, van begin tot eind

```bash
# 0. tests moeten eerst groen zijn
cd frontend && npx tsc --noEmit && npx vitest run

# 1. werk BEIDE versiebestanden bij (package.json + build.gradle name & code)

# 2. deploy EERST de server — die bouwt dist/ opnieuw met de relatieve API-URL
cd .. && ./scripts/deploy-server.sh

# 3. bouw dist/ nu opnieuw voor de APK, met de absolute server-URL
cd frontend
export PATH=/opt/homebrew/bin:$PATH ANDROID_HOME=$HOME/Library/Android/sdk
npm_package_version=1.4.3 VITE_API_URL=http://142.93.88.143:8080/api npx vite build
npx cap sync android
(cd android && ./gradlew assembleDebug)

# 4. Windows
npm run build:win

# 5. klaarzetten, checksums, pagina, uploaden, verifiëren  (§13.7)

# 6. release notes EN + NL, documentatie opnieuw deployen, downloadpagina duwen
```

---

## 13.11 Problemen oplossen

| Symptoom | Oorzaak | Oplossing |
|---|---|---|
| `The Capacitor CLI requires NodeJS >=22` | Node 20 in `PATH` | Zet een Node ≥22 vooraan, alleen voor `cap` |
| `SDK location not found` | `local.properties` staat niet in git | `export ANDROID_HOME=…` |
| APK installeert maar toont de oude build | `versionCode` niet verhoogd | Verhoog hem — Android kijkt naar de code, niet de naam |
| APK bereikt de server niet | Bundel gebouwd met relatieve `/api` | Herbouw met de absolute URL, opnieuw syncen en bouwen |
| Web-POS wijst ineens naar de droplet | `dist/` laatst voor de APK gebouwd | Draai `deploy-server.sh` opnieuw |
| Native functie geeft niets terug, code zit erin | Mogelijkheid niet in het manifest | Voeg `<uses-feature>` / permissie toe; controleer met `aapt2 dump xmltree` |
| Downloadlink geeft 404, pagina ziet er goed uit | Pagina ná de deploy gegenereerd, of artefact hernoemd | Duw `downloads.html` opnieuw naar het VitePress-dist-pad |
| Bijwerken blokkeert op *"cannot be closed"* | Installer ouder dan 1.3.3 | Nieuwere installers sluiten de app zelf af |
| Windows waarschuwt dat de exe onbetrouwbaar is | Geen code-signing-certificaat | Verwacht, tot er één is aangeschaft |

---

*Backend-workflow — migraties, seeders, queues, Telescope, testconventies —
staat in [12 — Code map](12-code-map.md), en het uitrolplan in
[14](14-client-deployment-playbook.md).*

→ Terug naar het [overzicht](README.md)
