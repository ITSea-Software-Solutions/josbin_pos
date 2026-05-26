<?php

namespace App\Policies;

use App\Models\BtwSubmission;
use App\Models\User;

class BtwSubmissionPolicy
{
    public function before(User $user): ?bool
    {
        return $user->isSuperAdmin() ? true : null;
    }

    /**
     * Anyone with btw.view_submissions can list — controller scopes the query
     * by org for non-cross-org roles.
     */
    public function viewAny(User $user): bool
    {
        return $user->can('btw.view_submissions');
    }

    /**
     * Same gate as viewAny, plus an org-match check for non-cross-org roles.
     * Tax inspector can view across orgs; OA/SM see only their own org.
     */
    public function view(User $user, BtwSubmission $submission): bool
    {
        if (! $user->can('btw.view_submissions')) {
            return false;
        }
        if ($user->isCrossOrgRole()) {
            return true;
        }
        return $user->organisation_id === $submission->organisation_id;
    }

    /**
     * Submit a new filing — OA and SM (in their own org). Tax inspector
     * cannot submit on behalf of a taxpayer.
     */
    public function create(User $user): bool
    {
        return $user->can('btw.submit') && $user->organisation_id !== null;
    }

    /**
     * Accept / dispute — tax inspector only. Even SA goes through the same
     * gate so the action is correctly attributed in the audit log.
     */
    public function review(User $user, BtwSubmission $submission): bool
    {
        if (! $user->can('btw.review_submission')) {
            return false;
        }
        // Only filed (not already accepted/disputed/superseded) submissions
        // can be reviewed. Once accepted, the filing is locked.
        return $submission->status === BtwSubmission::STATUS_FILED;
    }

    /**
     * Resubmit a correction. Same OA/SM gate as create — they own their own
     * filings. Cannot supersede an accepted filing (would invalidate the
     * tax authority's record). Cross-org SA/inspector cannot supersede on
     * behalf of a taxpayer — that would be a forgery.
     */
    public function supersede(User $user, BtwSubmission $submission): bool
    {
        if (! $user->can('btw.submit')) {
            return false;
        }
        if ($user->organisation_id !== $submission->organisation_id) {
            return false;
        }
        // Already-accepted filings are locked. Only filed or disputed ones
        // can be corrected.
        return in_array($submission->status, [BtwSubmission::STATUS_FILED, BtwSubmission::STATUS_DISPUTED], true);
    }
}
