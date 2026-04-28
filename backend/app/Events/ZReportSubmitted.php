<?php

namespace App\Events;

use App\Models\ZReport;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Broadcast when a store closes its day (Z-Report) and submits to headquarters.
 * The Super Admin Dashboard updates the store card sync status in real time.
 *
 * Channel: org.{orgId} — dashboard receives this and updates the store row.
 */
class ZReportSubmitted implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public readonly ZReport $zReport,
    ) {}

    public function broadcastOn(): array
    {
        return [
            new PrivateChannel("org.{$this->zReport->store->organisation_id}"),
        ];
    }

    public function broadcastAs(): string
    {
        return 'z-report.submitted';
    }

    public function broadcastWith(): array
    {
        return [
            'z_report_id'    => $this->zReport->id,
            'store_id'       => $this->zReport->store_id,
            'store_name'     => $this->zReport->store?->name,
            'report_date'    => $this->zReport->report_date->toDateString(),
            'total_srd'      => $this->zReport->total_srd,
            'btw_srd'        => $this->zReport->btw_srd,
            'transaction_count' => $this->zReport->transaction_count,
            'sync_status'    => $this->zReport->sync_status,
            'submitted_at'   => $this->zReport->submitted_at,
            'submitted_by'   => $this->zReport->submittedBy?->name,
        ];
    }
}
