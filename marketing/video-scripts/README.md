# Video scripts — record-in-Loom-and-ship

Five scripts, one per feature. Each is self-contained: you can hand one script to a different person and they can record without reading the others.

## Why these five

| # | Script | Audience | Length | Recorder POV |
|---|---|---|---|---|
| 01 | [Daily cycle: open register → first sale → Z-Report](./01-daily-cycle-cashier.md) | Cashier trainers, "what does the till look like?" | 4–5 min | Cashier |
| 02 | [BTW filing → Belastingdienst inspector accepts](./02-btw-submission.md) | OA + accounting + government pitch | 5 min | OA → Inspector |
| 03 | [Multi-store HQ live overview](./03-multi-store-hq-overview.md) | OA / executive pitch — the SaaS story | 3 min | OA / SA |
| 04 | [Tax Inspector portal walkthrough](./04-tax-inspector-portal.md) | Belastingdienst Suriname + Rekenkamer pitch | 4 min | Tax inspector |
| 05 | [Payment methods showcase (card recon, transfers, foreign cash)](./05-payment-methods-showcase.md) | Sales — "yes we handle SR-specific payments" | 4 min | Cashier |

Total: ~20 min of video covering the five highest-leverage stories.

## Recording setup — do this once

**Tools.** Loom (free tier is fine for clips under 5 min — paid for longer). On Mac: QuickTime → File → New Screen Recording also works and gives you a .mov you can upload anywhere. OBS Studio if you want post-production overlays.

**Browser.** Chrome, fresh profile (no extensions). Window size 1366 × 820 — matches the Playwright screenshot suite and looks crisp at full-screen playback. Zoom to 100%. **Set the dashboard locale to `nl-NL` first** so the on-screen text matches what a Surinamese viewer will see.

**Mic.** Wired headset mic if at all possible. Built-in MacBook mic is acceptable as fallback — record in a quiet room, no fan, no kids. Test with a 10-second clip before doing the full take.

**Stack.** Boot the demo stack before recording:

```bash
docker compose -f docker-compose.demo.yml up -d
cd dashboard && npm run dev          # :5174
cd frontend && npm run dev           # :5173
```

Wait for both servers to print "ready", then visit `http://localhost:5174` and verify you can log in as `orgadmin@dehoop.sr / OrgAdmin@2026`. Same for cashier (`kassa@dehoop.sr / Cashier@2026`) on `:5173`.

**Tax inspector demo (script 04 only).** 2FA is mandatory for this role. Before recording, clear the inspector's 2FA secret once:

```bash
docker exec josbin_demo_app php artisan tinker --execute='
  $u = \App\Models\User::where("email","belastingdienst@gov.sr")->first();
  $u->two_factor_secret = null;
  $u->two_factor_confirmed_at = null;
  $u->save();
  echo "cleared\n";
'
```

Re-enable 2FA after the take. (Production never bypasses this — it's a recording-only workaround.)

## Narration style

- **Conversational, not corporate.** "So I'm logged in as the Org Admin…" beats "The Organisation Administrator user role…"
- **Name the user role.** Always say "as the cashier" or "as the Org Admin" up front so viewers know whose screen they're seeing.
- **Quote the Dutch button text once**, in the way a customer will see it: *"…I click **Indienen**, which is *Submit*…"* — keeps the recording usable for both Dutch and English viewers.
- **Explain WHY, not just WHAT.** "I'm filling in the bank approval code so daily card settlement matches the bank's statement automatically" — not "I type the approval code."
- **Don't read the screen.** The viewer can read.
- **Re-take if you stumble.** Pausing for 3 seconds then continuing reads fine in the final cut — Loom lets you trim. Don't say "umm let me try that again."

## What goes on screen vs in narration

Most scripts have a 3-column structure:

| **Click** | **Narration** | **On-screen caption** |
|---|---|---|

The **on-screen caption** column is Loom's text-overlay feature — add it as you go, or in post. Keep captions under 8 words. They reinforce the narration without competing with it.

## Recording sequence

For each script:

1. **Read the whole script once silently.** Get the feel.
2. **Read it out loud.** Spot the tongue-twisters. Re-word them.
3. **Dry run with the actual UI.** Click through silently to make sure every element is where the script says it is.
4. **Record.** Hit Loom record, breathe, start with the opening hook. Don't worry about umms — the trim tool fixes them.
5. **Review on 1.5× speed.** Spots pacing issues you can't hear at 1×.
6. **Trim deadspots, add captions, share.**

If a script feels long, split into two clips at a natural break. Two 2-min clips watched fully beats one 4-min clip half-watched.

## Updating the scripts

The scripts reference UI element labels exactly as they appear in the app. When the UI changes (button rename, modal redesign), update the matching script in the same PR as the UI change — same discipline as the user manual (see `CLAUDE_WORKING_GUIDE.md` §2 surfaces checklist).
