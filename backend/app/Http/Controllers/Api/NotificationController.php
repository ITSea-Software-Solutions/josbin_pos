<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * In-app notification bell. Every action is scoped to $request->user()'s own
 * notifications via the Notifiable relation — a user can never read or mutate
 * another user's notifications.
 */
class NotificationController extends Controller
{
    /** GET /api/notifications — recent notifications + unread count. */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $items = $user->notifications()
            ->latest()
            ->limit(30)
            ->get()
            ->map(fn ($n) => [
                'id'         => $n->id,
                'data'       => $n->data,
                'read_at'    => optional($n->read_at)->toIso8601String(),
                'created_at' => optional($n->created_at)->toIso8601String(),
            ]);

        return response()->json([
            'data'         => $items,
            'unread_count' => $user->unreadNotifications()->count(),
        ]);
    }

    /** POST /api/notifications/{id}/read — mark one as read. */
    public function markRead(Request $request, string $id): JsonResponse
    {
        $notification = $request->user()->notifications()->whereKey($id)->first();

        if (! $notification) {
            return response()->json(['message' => 'Not found'], 404);
        }

        $notification->markAsRead();

        return response()->json([
            'unread_count' => $request->user()->unreadNotifications()->count(),
        ]);
    }

    /** POST /api/notifications/read-all — mark all as read. */
    public function markAllRead(Request $request): JsonResponse
    {
        $request->user()->unreadNotifications->markAsRead();

        return response()->json(['unread_count' => 0]);
    }
}
