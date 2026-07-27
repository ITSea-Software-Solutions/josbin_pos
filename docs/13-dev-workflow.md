# 13 — Building & releasing the till apps

How to build, verify and publish the two client applications — the **Windows
desktop app** (`.exe`) and the **Android terminal app** (`.apk`) — by hand,
on a local machine, without any CI.

Both apps are the **same React codebase** wrapped two different ways:

```
frontend/src/            ← the POS itself. One codebase, both platforms.
        /electron/       ← Windows shell (main process, printing, IPC)
        /android/        ← Android shell (Capacitor + native Java plugins)
        /dist/           ← the compiled web bundle BOTH wrappers consume
```

That shared `dist/` is the single most important thing to understand before
building anything — see [§13.3](#_13-3-the-shared-dist-trap).

---

## 13.1 Toolchain

| Tool | Version | Why this one |
|---|---|---|
| Node (app builds, tests) | 20.x | What `frontend/package.json` is pinned against |
| Node (Capacitor CLI only) | **≥ 22** | `npx cap` refuses to start below 22 |
| JDK | 21 (bundled with Android Studio) | Gradle toolchain |
| Android SDK | platform 36, build-tools 36 | `compileSdk = 36` |
| Xcode CLT / Windows build host | — | electron-builder cross-builds the `.exe` from macOS |

### The two-Node problem

The repo runs on Node 20, but the Capacitor CLI hard-fails on it:

```
[fatal] The Capacitor CLI requires NodeJS >=22.0.0
```

Keep a newer Node available and put it in front of `PATH` **only for the
`cap` commands**. On macOS with Homebrew alongside nvm:

```bash
export PATH=/opt/homebrew/bin:$PATH   # Node 25 from Homebrew
node -v                               # confirm before running cap
```

Everything else — `vite build`, `vitest`, `tsc`, `electron-builder` — runs
fine on Node 20.

### Android SDK location

`android/local.properties` is **git-ignored**, so a fresh clone has no SDK
path and Gradle fails with:

```
SDK location not found. Define a valid SDK location with an ANDROID_HOME
environment variable or by setting the sdk.dir path in local.properties
```

Export it instead of committing a machine-specific file:

```bash
export ANDROID_HOME=$HOME/Library/Android/sdk        # macOS
# export ANDROID_HOME=$HOME/Android/Sdk              # Linux
# set ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk        # Windows
```

---

## 13.2 Where the version lives

Two files, and they must agree:

| File | Field | Example |
|---|---|---|
| `frontend/package.json` | `version` | `1.4.3` |
| `frontend/android/app/build.gradle` | `versionName` | `"1.4.3"` |
| `frontend/android/app/build.gradle` | `versionCode` | `10403` |

`versionName` is the human string. **`versionCode` is the one Android
actually gates upgrades on** — install of a build whose `versionCode` is not
higher than the installed one is refused. Derive it mechanically:

```
versionCode = MAJOR × 10000 + MINOR × 100 + PATCH
1.4.3 → 10403      1.5.0 → 10500      2.0.0 → 20000
```

> Every APK from 1.0.0 to 1.4.0 shipped `versionCode 1`, because that is
> what the Capacitor template sets and only `versionName` was being bumped.
> Android could treat newer builds as duplicates and refuse to install them.

**Rule: the `.exe` and the `.apk` are always released together, on the same
version, from the same commit.** A store must never have to wonder whether
its Windows tills and Android terminals are on matching software.

---

## 13.3 The shared `dist/` trap {#_13-3-the-shared-dist-trap}

`frontend/dist/` is built by Vite and consumed by **three** different
targets, each needing a *different* API URL baked in:

| Target | Needs `VITE_API_URL` | Because |
|---|---|---|
| POS web (served by the droplet) | `/api` (relative) | Same origin as the page |
| Android APK | `http://<server>:8080/api` (absolute) | The app is a file on the device — it has no origin to be relative to |
| Windows exe | absolute, or set at runtime via **⚙ Server** | Loads over `file://` |

Because they share one folder, **order matters**: whichever build ran last
owns `dist/`. `scripts/deploy-server.sh` rebuilds `dist/` itself with the
relative URL, so:

> **Deploy the server first, then rebuild `dist/` for the APK.** Doing it the
> other way round pushes an APK-flavoured bundle (absolute droplet URL) to
> the web POS, or ships an APK that tries to call `/api` on itself.

---

## 13.4 Building the Android APK

From `frontend/`:

```bash
export PATH=/opt/homebrew/bin:$PATH
export ANDROID_HOME=$HOME/Library/Android/sdk
```

**Step 1 — compile the web bundle with the server URL baked in.**
`npm_package_version` is what npm normally sets; pass it by hand when
calling `vite` directly, or the version shown in Settings reads `dev`.

```bash
npm_package_version=1.4.3 VITE_API_URL=http://142.93.88.143:8080/api npx vite build
```

**Step 2 — copy the bundle and plugin registrations into the Android project.**

```bash
npx cap sync android
```

Expect it to list the Capacitor plugins it found. Our own native plugins
(`UsbPrinterPlugin`, `TcpSocketPlugin`) are *local Java classes*, not npm
packages, so they will **not** appear in that list — see
[§13.8](#_13-8-native-android-plugins).

**Step 3 — build the APK.**

```bash
cd android && ./gradlew assembleDebug
```

Output: `frontend/android/app/build/outputs/apk/debug/app-debug.apk`

> **Debug, deliberately.** A debug APK is self-signed and sideloadable,
> which is what field terminals need. A release APK requires a keystore we
> do not yet manage. Android needs no paid certificate either way.

---

## 13.5 Building the Windows exe

From `frontend/`:

```bash
npm run build:win
```

That runs `electron-vite build` then `electron-builder --win --x64`, and
writes `frontend/release/Josbin POS Setup <version>.exe`.

Worth knowing:

- **It cross-builds from macOS or Linux** — no Windows machine needed.
- **`build/installer.nsh`** overrides the NSIS app-running check to
  `taskkill /F /IM … /T`. A till runs fullscreen and frameless, so there is
  no window for an operator to close; without this, upgrades dead-end on
  *"Josbin POS cannot be closed"*.
- **The exe is unsigned.** Windows will warn on download and install until a
  code-signing certificate is purchased. `signing with signtool.exe` in the
  build log does **not** mean it got signed — that step is a no-op with no
  certificate configured.

---

## 13.6 Verifying a build actually contains your change

Do not assume the artifact holds what you just wrote. Both wrappers have
silently shipped stale or missing code before.

**Android — read the manifest out of the built APK**, not the source tree.
A permission or feature you forgot to declare is invisible in the source
diff but fatal at runtime:

```bash
AAPT=$ANDROID_HOME/build-tools/36.0.0/aapt2
APK=android/app/build/outputs/apk/debug/app-debug.apk

$AAPT dump badging "$APK" | head -1          # package, versionCode, versionName
$AAPT dump xmltree --file AndroidManifest.xml "$APK" | grep -i usb
```

**Android — confirm the JS actually made it into the bundle:**

```bash
grep -l "someDistinctiveString" android/app/src/main/assets/public/assets/*.js
```

**Android — confirm a native plugin class is compiled in.** Debug builds
split dex, so check *every* `classesN.dex`:

```bash
unzip -p "$APK" 'classes*.dex' | strings | grep UsbPrinterPlugin
```

> Presence of your code is necessary, not sufficient. A plugin can be in
> `classes8.dex`, its library linked, its JS bundled — and still return
> nothing because the OS was never asked for the permission. Verify the
> **manifest**, not just the code.

**Both platforms — the running version is shown in the app:** Settings →
bottom of the page reads e.g. `v1.4.3 · android`. When a field report says
"still broken", check that first.

---

## 13.7 Publishing a release

**Step 1 — name the artifacts to the convention.** The download page and the
installer endpoint both parse the version out of the filename:

```
josbin-pos-demo-Setup-1.4.3.exe
josbin-pos-demo-1.4.3.apk
```

**Step 2 — checksum sidecars**, so a partial download is diagnosable:

```bash
cd downloads
shasum -a 256 josbin-pos-demo-Setup-1.4.3.exe | awk '{print $1}' > josbin-pos-demo-Setup-1.4.3.exe.sha256
shasum -a 256 josbin-pos-demo-1.4.3.apk       | awk '{print $1}' > josbin-pos-demo-1.4.3.apk.sha256
```

**Step 3 — regenerate the public download page.** It reads the real files on
disk, so versions, sizes and checksums can never drift from reality:

```bash
node scripts/build-downloads-page.mjs
# → "downloads page built: exe 1.4.3, apk 1.4.3 (in sync)"
```

A `(VERSIONS DIFFER!)` in that output means you are about to ship a
mismatched pair. Stop.

**Step 4 — upload and verify server-side.** Never trust the transfer:

```bash
rsync -az downloads/josbin-pos-demo-*1.4.3* root@142.93.88.143:/var/www/html/downloads/

ssh root@142.93.88.143 'cd /var/www/html/downloads && for f in josbin-pos-demo-Setup-1.4.3.exe josbin-pos-demo-1.4.3.apk; do
  a=$(sha256sum "$f" | cut -d" " -f1); e=$(cat "$f.sha256")
  [ "$a" = "$e" ] && echo "OK $f" || echo "MISMATCH $f"; done'
```

**Step 5 — deploy the docs, then push the download page.** This ordering
trips people up:

```bash
./scripts/deploy-server.sh
rsync -az marketing/downloads.html \
  root@142.93.88.143:/var/www/html/docs-site/.vitepress/dist/downloads.html
```

> The public page is **served from the VitePress dist**, not from
> `marketing/`. `deploy-server.sh` copies it there during a deploy — so if
> you regenerate the page *after* deploying, the served copy stays stale.
> Combine that with a renamed artifact and the live download link 404s while
> the file sits perfectly happily on disk.

**Step 6 — verify the links, not just the page.** A page that renders fine is
exactly what hides a broken link:

```bash
for f in $(curl -s http://142.93.88.143:8095/downloads.html | grep -o '/downloads/josbin[^"]*'); do
  printf "%-44s " "$f"; curl -sI "http://142.93.88.143:8095$f" | head -1
done
```

**Step 7 — write the release notes** in `docs/17-release-notes.md` and its
Dutch mirror `nl/docs/17-release-notes.md`, in plain shop language, then
deploy the docs again.

---

## 13.8 Native Android plugins {#_13-8-native-android-plugins}

Anything the WebView cannot do — raw TCP sockets, USB printing — is a small
Java class exposed to JS.

```
android/app/src/main/java/sr/josbin_pos/pos/
  MainActivity.java        ← registers every local plugin
  UsbPrinterPlugin.java    ← USB Host API: list, request permission, bulk write
  TcpSocketPlugin.java     ← raw TCP for network printers
```

To add one:

1. Write the class with `@CapacitorPlugin(name = "MyThing")` and
   `@PluginMethod` methods.
2. **Register it in `MainActivity.onCreate` before `super.onCreate()`** —
   plugins must exist before the bridge initialises.
3. Declare any OS capability it needs in `AndroidManifest.xml`. This is part
   of the feature, not paperwork: without
   `<uses-feature android:name="android.hardware.usb.host" />`,
   `UsbManager.getDeviceList()` returns an **empty map** no matter what is
   plugged in.
4. Bridge it from TS with `registerPlugin<T>('MyThing')` — see
   `src/lib/usbPrinter.ts`.
5. Wrap calls so they degrade on other platforms; `registerPlugin` resolves
   only inside the APK.

**Data crossing the bridge must be plain, structured-cloneable values.**
Send `number[]`, never a `Buffer` or a typed array with methods. The Electron
renderer is sandboxed, so `Buffer` is undefined there and the call throws
before any IPC happens — the same discipline keeps both bridges honest.

---

## 13.9 App icons

One square source drives every icon on both platforms:

```bash
# put the mark at brand/josbin-icon-source.png (square, ≥1024×1024)
node scripts/generate-app-icons.mjs
```

Writes all 5 Android density buckets (legacy, round, and the adaptive
foreground) plus `frontend/build/icon.png` for the exe and installer. Then
rebuild both apps — icons are compiled in, not loaded at runtime. Details in
[`brand/README.md`](https://github.com/ITSea-Software-Solutions/josbin_pos/blob/main/brand/README.md).

---

## 13.10 Full release, start to finish

```bash
# 0. tests must be green first
cd frontend && npx tsc --noEmit && npx vitest run

# 1. bump BOTH version files (package.json + build.gradle name & code)

# 2. deploy the server FIRST — it rebuilds dist/ with the relative API URL
cd .. && ./scripts/deploy-server.sh

# 3. now rebuild dist/ for the APK, with the absolute server URL
cd frontend
export PATH=/opt/homebrew/bin:$PATH ANDROID_HOME=$HOME/Library/Android/sdk
npm_package_version=1.4.3 VITE_API_URL=http://142.93.88.143:8080/api npx vite build
npx cap sync android
(cd android && ./gradlew assembleDebug)

# 4. Windows
npm run build:win

# 5. stage, checksum, page, upload, verify  (§13.7)

# 6. release notes EN + NL, deploy docs again, push the downloads page
```

---

## 13.11 Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `The Capacitor CLI requires NodeJS >=22` | Node 20 on `PATH` | Put a ≥22 Node first, for `cap` only |
| `SDK location not found` | `local.properties` is git-ignored | `export ANDROID_HOME=…` |
| APK installs but shows the old build | `versionCode` did not increase | Bump it — Android gates on the code, not the name |
| App can't reach the server from the APK | Bundle built with relative `/api` | Rebuild with the absolute URL, re-sync, rebuild |
| Web POS suddenly points at the droplet | `dist/` last built for the APK | Re-run `deploy-server.sh` |
| Native feature returns nothing, code is present | Capability not declared in the manifest | Add `<uses-feature>` / permission; verify with `aapt2 dump xmltree` |
| Download link 404s, page looks right | Page regenerated after deploy, or artifact renamed | Re-push `downloads.html` to the VitePress dist path |
| Upgrade blocked by *"cannot be closed"* | Installer older than 1.3.3 | Newer installers force-close the app themselves |
| Windows warns the exe is untrusted | No code-signing certificate | Expected until one is purchased |

---

*Backend workflow — migrations, seeders, queues, Telescope, test conventions
— is covered in [12 — Code map](12-code-map.md) and the deployment playbook
in [14](14-client-deployment-playbook.md).*

→ Back to the [overview](README.md)
