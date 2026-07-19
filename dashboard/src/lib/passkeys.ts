/**
 * WebAuthn (passkey) client for the dashboard.
 *
 * Talks to the Josbin API's passkey endpoints (Api\PasskeyController) and
 * handles the base64url <-> ArrayBuffer plumbing around
 * navigator.credentials. Passkeys only exist in a secure context whose
 * host is a domain — so: localhost dev and the HTTPS production domain.
 * On the plain-IP droplet `passkeysSupported()` is false and the UI hides.
 */
import { apiClient } from '@/api/client'

export function passkeysSupported(): boolean {
  return typeof window !== 'undefined'
    && window.isSecureContext
    && typeof window.PublicKeyCredential !== 'undefined'
}

// ── base64url helpers ────────────────────────────────────────────────────

function b64urlToBuffer(value: string): ArrayBuffer {
  const b64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
  const raw = atob(padded)
  const bytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes.buffer
}

function bufferToB64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let raw = ''
  for (const b of bytes) raw += String.fromCharCode(b)
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// ── options parsing (server JSON → navigator.credentials shapes) ─────────

type ServerCreationOptions = {
  challenge: string
  user: { id: string; name: string; displayName: string }
  excludeCredentials?: { id: string; type: string; transports?: string[] }[]
} & Record<string, unknown>

type ServerRequestOptions = {
  challenge: string
  allowCredentials?: { id: string; type: string; transports?: string[] }[]
} & Record<string, unknown>

function parseCreationOptions(options: ServerCreationOptions): PublicKeyCredentialCreationOptions {
  return {
    ...options,
    challenge: b64urlToBuffer(options.challenge),
    user: { ...options.user, id: b64urlToBuffer(options.user.id) },
    excludeCredentials: (options.excludeCredentials ?? []).map((c) => ({
      ...c, id: b64urlToBuffer(c.id),
    })),
  } as PublicKeyCredentialCreationOptions
}

function parseRequestOptions(options: ServerRequestOptions): PublicKeyCredentialRequestOptions {
  return {
    ...options,
    challenge: b64urlToBuffer(options.challenge),
    allowCredentials: (options.allowCredentials ?? []).map((c) => ({
      ...c, id: b64urlToBuffer(c.id),
    })),
  } as PublicKeyCredentialRequestOptions
}

// ── credential serialisation (navigator result → server JSON) ────────────

function serializeCredential(credential: PublicKeyCredential): Record<string, unknown> {
  const response = credential.response
  const base: Record<string, unknown> = {
    id: credential.id,
    rawId: bufferToB64url(credential.rawId),
    type: credential.type,
    clientExtensionResults: credential.getClientExtensionResults(),
    authenticatorAttachment: credential.authenticatorAttachment ?? undefined,
  }

  if (response instanceof AuthenticatorAttestationResponse) {
    base.response = {
      clientDataJSON: bufferToB64url(response.clientDataJSON),
      attestationObject: bufferToB64url(response.attestationObject),
      transports: response.getTransports?.() ?? [],
    }
  } else if (response instanceof AuthenticatorAssertionResponse) {
    base.response = {
      clientDataJSON: bufferToB64url(response.clientDataJSON),
      authenticatorData: bufferToB64url(response.authenticatorData),
      signature: bufferToB64url(response.signature),
      userHandle: response.userHandle ? bufferToB64url(response.userHandle) : null,
    }
  }

  return base
}

// ── public API ───────────────────────────────────────────────────────────

export interface PasskeyRecord {
  id: number
  name: string
  created_at: string
  last_used_at: string | null
}

export async function listPasskeys(): Promise<PasskeyRecord[]> {
  const { data } = await apiClient.get('/auth/passkeys')
  return data.data
}

export async function registerPasskey(name: string): Promise<PasskeyRecord> {
  const { data: optionsRes } = await apiClient.post('/auth/passkeys/options')
  const credential = (await navigator.credentials.create({
    publicKey: parseCreationOptions(optionsRes.options),
  })) as PublicKeyCredential | null

  if (!credential) throw new Error('cancelled')

  const { data } = await apiClient.post('/auth/passkeys', {
    name,
    credential: serializeCredential(credential),
  })
  return data.data
}

export async function deletePasskey(id: number): Promise<void> {
  await apiClient.delete(`/auth/passkeys/${id}`)
}

export interface PasskeyLoginResponse {
  token: string
  expires_at: string
  user: Record<string, unknown>
}

export async function loginWithPasskey(deviceName = 'web'): Promise<PasskeyLoginResponse> {
  const { data: optionsRes } = await apiClient.post('/auth/passkeys/login-options')
  const credential = (await navigator.credentials.get({
    publicKey: parseRequestOptions(optionsRes.options),
  })) as PublicKeyCredential | null

  if (!credential) throw new Error('cancelled')

  const { data } = await apiClient.post('/auth/passkeys/login', {
    ceremony_id: optionsRes.ceremony_id,
    credential: serializeCredential(credential),
    device_name: deviceName,
  })
  return data
}
