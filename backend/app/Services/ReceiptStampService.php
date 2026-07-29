<?php

namespace App\Services;

use App\Models\Store;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;

/**
 * Turns a store's configured stamp image into the packed 1-bit bitmap a
 * thermal printer wants, so the shop can choose what gets stamped at the foot
 * of the receipt instead of being stuck with whatever the app was compiled
 * with.
 *
 * The rasterising happens HERE, not on the till, for two reasons: every till
 * would otherwise need its own image pipeline (Windows, Android and the
 * browser build all differ), and the answer is identical for every till in
 * the store, so computing it once and caching it is simply cheaper.
 *
 * The till keeps the Josbin wing compiled in as its fallback. If this endpoint
 * is unreachable — the shop's server is down, the terminal is on its own — a
 * receipt still prints with a mark on it. A logo that only works online is a
 * logo that is missing on the day it matters.
 *
 * Source image resolution, in order:
 *   1. store.settings.receipt_stamp_path   — this store's own stamp
 *   2. store.settings.receipt_watermark_path — reuse the PDF watermark
 *   3. config josbin_pos.receipt_watermark_default — the platform default
 * Null at every step means "no server-side stamp", and the till falls back.
 */
class ReceiptStampService
{
    /** Dots across. 240 fits inside both the 576-dot (80 mm) and 384-dot
     *  (58 mm) heads without needing a per-width variant. */
    private const WIDTH = 240;

    /** Tallest we will let a stamp be, in dots. A tall image is metres of
     *  paper across a trading day, and nobody notices until the roll runs out
     *  mid-queue. ~20 mm at 203 dpi. */
    private const MAX_HEIGHT = 160;

    /**
     * Luma at or above which a pixel is paper rather than ink.
     *
     * Thermal paper has no greys — a dot is burned or it is not — so every
     * anti-aliased edge has to fall one way. 190 is deliberately generous:
     * a logo that is mid-tone green on white (the common case for a flat
     * brand mark) has a luma around 200 for the background and well under
     * 190 for the mark, and dropping it to 128 would erase the whole logo.
     */
    private const LUMA_CUTOFF = 190;

    /** How much of a rubber stamp's tilt to imitate. Degrees, anticlockwise. */
    private const STAMP_ROTATE_DEG = 11.0;

    /** Fraction of the stamp's dots actually burned. ~45% reads as a faded
     *  ink impression and lets the printed text show through it. */
    private const STAMP_KEEP = 0.45;

    /** Ordered 4x4 dither. Spreading the dropped dots evenly looks like
     *  lighter ink; dropping them in blocks would look like a printing fault. */
    private const BAYER = [
        [0, 8, 2, 10],
        [12, 4, 14, 6],
        [3, 11, 1, 9],
        [15, 7, 13, 5],
    ];

    /**
     * @return array{b64:string,width:int,height:int,coverage:float}|null
     */
    public function forStore(Store $store): ?array
    {
        $source = $this->resolveSource($store);
        if ($source === null) {
            return null;
        }

        // Keyed by the resolved path AND its mtime, so replacing the file
        // takes effect without anyone remembering to flush a cache.
        $key = 'receipt_stamp:' . md5($source['path'] . '|' . $source['mtime']);

        return Cache::remember($key, now()->addDay(), function () use ($source) {
            // The footer mark is a STAMP: tilted and faded. The header logo
            // (logoForStore) stays square and solid — that one is the shop
            // identifying itself, not an impression pressed onto the paper.
            return $this->rasterise($source['bytes'], self::STAMP_ROTATE_DEG, self::STAMP_KEEP);
        });
    }

    /**
     * The store's HEADER logo, rasterised for the top of a thermal receipt.
     *
     * Same pipeline as the footer stamp — the difference is only which field
     * it comes from (`receipt_logo_path`, the one the logo upload writes) and
     * that there is no platform-wide fallback: a header logo identifies the
     * SHOP, so an empty one prints nothing rather than someone else's mark.
     *
     * @return array{b64:string,width:int,height:int,coverage:float}|null
     */
    public function logoForStore(Store $store): ?array
    {
        $disk = Storage::disk('public');
        $path = $store->receipt_logo_path;
        if (! $path || ! $disk->exists($path)) {
            return null;
        }

        $key = 'receipt_logo:' . md5($path . '|' . $disk->lastModified($path));

        return Cache::remember($key, now()->addDay(), function () use ($disk, $path) {
            return $this->rasterise((string) $disk->get($path));
        });
    }

    /** @return array{path:string,mtime:int,bytes:string}|null */
    private function resolveSource(Store $store): ?array
    {
        $disk = Storage::disk('public');

        foreach (['receipt_stamp_path', 'receipt_watermark_path'] as $key) {
            $path = data_get($store->settings, $key);
            if ($path && $disk->exists($path)) {
                return [
                    'path'  => 'public:' . $path,
                    'mtime' => (int) $disk->lastModified($path),
                    'bytes' => (string) $disk->get($path),
                ];
            }
        }

        // Platform default set by a Super Admin in the dashboard. Sits above
        // the file shipped with the backend so the image can be changed
        // without a redeploy.
        $platform = \App\Models\AppSetting::get(
            \App\Http\Controllers\Api\PlatformBrandingController::STAMP_KEY,
        );
        if ($platform && $disk->exists($platform)) {
            return [
                'path'  => 'public:' . $platform,
                'mtime' => (int) $disk->lastModified($platform),
                'bytes' => (string) $disk->get($platform),
            ];
        }

        $default = config('josbin_pos.receipt_watermark_default');
        if (! $default) {
            return null;
        }

        $absolute = public_path($default);
        if (! is_file($absolute) || ! is_readable($absolute)) {
            return null;
        }

        return [
            'path'  => $absolute,
            'mtime' => (int) filemtime($absolute),
            'bytes' => (string) file_get_contents($absolute),
        ];
    }

    /**
     * @return array{b64:string,width:int,height:int,coverage:float}|null
     */
    private function rasterise(string $bytes, float $rotateDeg = 0.0, float $keep = 1.0): ?array
    {
        $src = @imagecreatefromstring($bytes);
        if ($src === false) {
            return null;
        }

        $srcW = imagesx($src);
        $srcH = imagesy($src);
        if ($srcW < 1 || $srcH < 1) {
            imagedestroy($src);

            return null;
        }

        $w = self::WIDTH;
        $h = (int) round($srcH * ($w / $srcW));
        if ($h > self::MAX_HEIGHT) {
            // Too tall to scale by width — fit by height instead, so a
            // portrait logo shrinks rather than eating the paper roll.
            $h = self::MAX_HEIGHT;
            $w = max(1, (int) round($srcW * ($h / $srcH)));
        }

        $dst = imagecreatetruecolor($w, $h);
        // Flatten onto white FIRST. A transparent PNG left un-flattened
        // greyscales to "everything is dark", which prints a solid black
        // rectangle — the single most common way this goes wrong.
        $white = imagecolorallocate($dst, 255, 255, 255);
        imagefilledrectangle($dst, 0, 0, $w, $h, $white);
        imagecopyresampled($dst, $src, 0, 0, 0, 0, $w, $h, $srcW, $srcH);
        imagedestroy($src);

        // Tilt it, the way a hand presses a rubber stamp — never quite square.
        if (abs($rotateDeg) > 0.01) {
            $rotated = imagerotate($dst, $rotateDeg, $white);
            if ($rotated !== false) {
                imagedestroy($dst);
                $dst = $rotated;
                $w = imagesx($dst);
                $h = imagesy($dst);
                // Rotation grows the canvas; keep it inside the paper.
                if ($w > self::WIDTH || $h > self::MAX_HEIGHT) {
                    $scale = min(self::WIDTH / $w, self::MAX_HEIGHT / $h);
                    $fw = max(1, (int) floor($w * $scale));
                    $fh = max(1, (int) floor($h * $scale));
                    $fit = imagecreatetruecolor($fw, $fh);
                    imagefilledrectangle($fit, 0, 0, $fw, $fh, imagecolorallocate($fit, 255, 255, 255));
                    imagecopyresampled($fit, $dst, 0, 0, 0, 0, $fw, $fh, $w, $h);
                    imagedestroy($dst);
                    $dst = $fit; $w = $fw; $h = $fh;
                }
            }
        }

        $rowBytes = intdiv($w + 7, 8);
        $packed = array_fill(0, $rowBytes * $h, 0);
        $inked = 0;

        for ($y = 0; $y < $h; $y++) {
            for ($x = 0; $x < $w; $x++) {
                $rgb = imagecolorat($dst, $x, $y);
                $luma = (int) round(
                    0.299 * (($rgb >> 16) & 0xFF)
                    + 0.587 * (($rgb >> 8) & 0xFF)
                    + 0.114 * ($rgb & 0xFF)
                );
                if ($luma >= self::LUMA_CUTOFF) {
                    continue;
                }
                // Fade, by printing only some of the dots.
                //
                // Thermal paper has no grey — a dot is burned or it is not —
                // so "lighter" means "fewer dots". An ordered (Bayer) pattern
                // drops them evenly, which the eye reads as a lighter ink
                // rather than as gaps. A rubber stamp is never solid black
                // either, so this is closer to the real thing AND it burns
                // fewer dots, which is faster to print and kinder to the head.
                if ($keep < 1.0 && self::BAYER[$y & 3][$x & 3] >= $keep * 16) {
                    continue;
                }

                // MSB first within each byte — the order ESC/POS GS v 0 reads.
                $packed[$y * $rowBytes + ($x >> 3)] |= 0x80 >> ($x & 7);
                $inked++;
            }
        }
        imagedestroy($dst);

        // Refuse only what is genuinely broken — a blank stamp, or a solid
        // slab of ink. NOT merely "dark".
        //
        // The first ceiling here was 60%, and it silently rejected a real
        // logo that measured 60.6%: a mark with a coloured background and the
        // letters knocked out in white, which is an entirely normal way for a
        // logo to be drawn. It printed nothing, said nothing, and cost a day.
        // 85% still catches an all-black rectangle while letting a
        // solid-background mark through.
        //
        // Coverage travels back with the bitmap so the upload screen can warn
        // that a dark image will come out heavy on thermal paper — a warning
        // the shop can act on beats a refusal it never sees.
        // Judge density BEFORE the fade — otherwise dithering would drag a
        // solid black slab under the ceiling and let it through.
        $coverage = $keep > 0 ? ($inked / ($w * $h)) / $keep : 0.0;
        if ($coverage < 0.01 || $coverage > 0.85) {
            return null;
        }

        return [
            'b64'      => base64_encode(pack('C*', ...$packed)),
            'width'    => $w,
            'height'   => $h,
            'coverage' => round($coverage, 3),
        ];
    }
}
