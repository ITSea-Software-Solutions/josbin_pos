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

    /**
     * @return array{b64:string,width:int,height:int}|null
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
            return $this->rasterise($source['bytes']);
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
     * @return array{b64:string,width:int,height:int}|null
     */
    private function rasterise(string $bytes): ?array
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
                // MSB first within each byte — the order ESC/POS GS v 0 reads.
                $packed[$y * $rowBytes + ($x >> 3)] |= 0x80 >> ($x & 7);
                $inked++;
            }
        }
        imagedestroy($dst);

        // Refuse the two failure modes that produce a ruined receipt rather
        // than a missing logo: a blank stamp, and a black bar. Returning null
        // makes the till fall back to its built-in mark.
        $coverage = $inked / ($w * $h);
        if ($coverage < 0.01 || $coverage > 0.60) {
            return null;
        }

        return [
            'b64'    => base64_encode(pack('C*', ...$packed)),
            'width'  => $w,
            'height' => $h,
        ];
    }
}
