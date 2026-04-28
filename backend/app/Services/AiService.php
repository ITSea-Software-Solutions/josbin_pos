<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Lightweight OpenAI API client via Laravel's Http facade.
 * No additional packages required — uses GPT-4o for text generation.
 *
 * Falls back gracefully when no API key is configured (dev/test environments).
 */
class AiService
{
    private string $apiKey;
    private string $model;
    private string $baseUrl = 'https://api.openai.com/v1';

    public function __construct()
    {
        $this->apiKey = config('services.openai.key', '');
        $this->model  = config('services.openai.model', 'gpt-4o');
    }

    public function isConfigured(): bool
    {
        return ! empty($this->apiKey) && $this->apiKey !== 'your_openai_key_here';
    }

    /**
     * Send a chat completion request.
     *
     * @param  array<array{role: string, content: string}>  $messages
     * @param  int  $maxTokens
     * @return string|null   null on failure
     */
    public function chat(array $messages, int $maxTokens = 800): ?string
    {
        if (! $this->isConfigured()) {
            Log::info('[AiService] OpenAI key not configured — skipping AI call');
            return null;
        }

        try {
            $response = Http::withToken($this->apiKey)
                ->timeout(30)
                ->retry(2, 1000)
                ->post("{$this->baseUrl}/chat/completions", [
                    'model'      => $this->model,
                    'messages'   => $messages,
                    'max_tokens' => $maxTokens,
                    'temperature'=> 0.3,
                ]);

            if ($response->failed()) {
                Log::warning('[AiService] OpenAI API error', [
                    'status' => $response->status(),
                    'body'   => $response->body(),
                ]);
                return null;
            }

            return $response->json('choices.0.message.content');
        } catch (\Throwable $e) {
            Log::error('[AiService] OpenAI call failed', ['error' => $e->getMessage()]);
            return null;
        }
    }

    /**
     * Single-turn completion — convenience wrapper.
     */
    public function complete(string $systemPrompt, string $userMessage, int $maxTokens = 800): ?string
    {
        return $this->chat([
            ['role' => 'system',  'content' => $systemPrompt],
            ['role' => 'user',    'content' => $userMessage],
        ], $maxTokens);
    }
}
