import apiClient from './client'
import type { User } from '@/types/models'

export interface LoginResponse {
  token: string
  expires_at: string
  user: User
}

export async function login(email: string, password: string, deviceName = 'pos'): Promise<LoginResponse> {
  const { data } = await apiClient.post<LoginResponse>('/auth/login', {
    email,
    password,
    device_name: deviceName,
  })
  return data
}

export async function logout(): Promise<void> {
  await apiClient.post('/auth/logout')
}

export async function getMe(): Promise<User> {
  const { data } = await apiClient.get<{ user: User }>('/auth/me')
  return data.user
}

export async function refreshToken(): Promise<{ token: string; expires_at: string }> {
  const { data } = await apiClient.post('/auth/refresh')
  return data
}
