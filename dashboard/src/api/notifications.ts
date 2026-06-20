import apiClient from './client'

export type NotificationType =
  | 'btw_disputed'
  | 'btw_accepted'
  | 'btw_resubmitted'
  | string

/** The structured payload stored in the notification's `data` column. */
export interface NotificationData {
  category?: string
  type?: NotificationType
  submission_id?: string
  reference?: string
  organisation?: string
  period?: string
  amount_srd?: string
  reason?: string
  link?: string
  title?: { nl: string; en: string }
  message?: { nl: string; en: string }
}

export interface AppNotification {
  id: string
  data: NotificationData
  read_at: string | null
  created_at: string | null
}

export interface NotificationsResponse {
  data: AppNotification[]
  unread_count: number
}

export async function getNotifications(): Promise<NotificationsResponse> {
  const res = await apiClient.get('/notifications')
  return res.data
}

export async function markNotificationRead(id: string): Promise<{ unread_count: number }> {
  const res = await apiClient.post(`/notifications/${id}/read`)
  return res.data
}

export async function markAllNotificationsRead(): Promise<{ unread_count: number }> {
  const res = await apiClient.post('/notifications/read-all')
  return res.data
}
