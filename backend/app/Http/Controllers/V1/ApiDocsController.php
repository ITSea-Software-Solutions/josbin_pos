<?php

namespace App\Http\Controllers\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;

/**
 * Serves the OpenAPI specification and an interactive Swagger UI page for
 * the Layer 3 Open Integration API.
 *
 * Both endpoints are intentionally public — third-party integrators must be
 * able to read the documentation before they have been issued an API key.
 */
class ApiDocsController extends Controller
{
    /** GET /v1/openapi.json — the raw OpenAPI 3.0 specification. */
    public function spec(): JsonResponse
    {
        $path = resource_path('api-docs/openapi.json');

        abort_unless(is_file($path), 404, 'OpenAPI specification not found.');

        return response()->json(
            json_decode(file_get_contents($path), true)
        );
    }

    /** GET /v1/docs — interactive Swagger UI. */
    public function ui(): Response
    {
        return response()->view('api-docs');
    }
}
