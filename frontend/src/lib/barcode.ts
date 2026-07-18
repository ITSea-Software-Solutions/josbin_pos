/**
 * Scanned-code heuristics shared by the POS search box and the camera scanner.
 *
 * USB/Bluetooth scanners act as keyboards ("HID wedge"): they type the code
 * and press Enter. The search box has to decide whether that Enter meant
 * "look this up as a barcode" or was just someone typing. The old rule
 * (exactly 8–13 digits) silently rejected real-world codes:
 *
 *   - UPC-E           6–8 digits   (compact US import packaging)
 *   - EAN-8           8 digits
 *   - EAN-13 / UPC-A  12–13 digits
 *   - ITF-14 / GTIN-14 14 digits   (carton/outer-case codes)
 *   - Code 39 / Code 128 alphanumeric supplier SKUs (letters + digits)
 */

/**
 * Strip an AIM symbology identifier if the scanner is configured to send one
 * (a 3-char prefix like "]E0" for EAN-13, "]C1" for Code 128).
 */
export function stripAimPrefix(raw: string): string {
  return /^\][A-Za-z].?/.test(raw) ? raw.slice(3) : raw
}

/**
 * Should an Enter press on this value trigger a barcode lookup?
 *
 *  - numeric, 6–14 digits → yes (UPC-E through GTIN-14, incl. scale barcodes)
 *  - alphanumeric (with - or .) 4–24 chars containing at least one digit and
 *    no spaces → yes (Code 39 / Code 128 supplier SKUs)
 *  - anything else (product-name searches, short numbers like "1l") → no
 */
export function looksLikeScannedCode(value: string): boolean {
  const v = value.trim()
  if (/^\d{6,14}$/.test(v)) return true
  if (/^[A-Za-z0-9][A-Za-z0-9\-.]{3,23}$/.test(v) && /\d/.test(v) && /[A-Za-z\-.]/.test(v)) return true
  return false
}
