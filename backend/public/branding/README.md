# Receipt watermark

Drop the watermark image here as **`receipt-watermark.png`**. It is printed
faintly behind the body of the HTML, emailed and PDF receipt for **every
store**, unless a store overrides it with its own under
`settings.receipt_watermark_path`.

- **PNG with transparency**, roughly square, 600–1200 px wide.
- A **missing file means no watermark** — never a broken image on a
  customer's receipt.
- Strength is `JOSBIN_POS_RECEIPT_WATERMARK_OPACITY` (default `0.08`). The
  receipt is a financial document; the amounts must stay the most legible
  thing on the paper.
- Path is `JOSBIN_POS_RECEIPT_WATERMARK`, relative to `public/`.

**The thermal printed receipt cannot carry a watermark.** ESC/POS is one-bit
black dots with no layering — there is no "behind the text" to print into.
This applies to the on-screen, emailed and PDF receipt only.

> Third-party marks (a tax authority emblem, a certification body) must not
> be shipped here without written authorisation from the owner on file — a
> receipt carrying an official emblem reads as an endorsement.
