import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { getStoreDetail, type StoreOverview } from '@/api/dashboard'
import { useOrgChannel } from '@/hooks/useEcho'
import { formatSRD } from '@/utils/currency'
import { useDashboardAuthStore } from '@/store/authStore'

export default function StoreDetailScreen({ storeId }: { storeId: string }) {
  const { i18n } = useTranslation()
  const qc = useQueryClient()
  const user = useDashboardAuthStore((s) => s.user)
  const isNl = i18n.language === 'nl'

  const { data, isLoading } = useQuery({
    queryKey: ['store-detail', storeId],
    queryFn: () => getStoreDetail(storeId),
    refetchInterval: 60_000,
  })

  // Real-time updates
  useOrgChannel(user?.organisation_id ?? null, {
    onSaleCompleted: (payload) => {
      const p = payload as { store_id: string; total_srd: string }
      if (p.store_id !== storeId) return
      qc.setQueryData(['store-detail', storeId], (old: StoreOverview | undefined) => {
        if (!old) return old
        return {
          ...old,
          today_revenue_srd: (parseFloat(old.today_revenue_srd) + parseFloat(p.total_srd)).toFixed(2),
          today_transaction_count: old.today_transaction_count + 1,
        }
      })
    },
    onStoreStatusChanged: (payload) => {
      const p = payload as { store_id: string; is_online: boolean }
      if (p.store_id !== storeId) return
      qc.setQueryData(['store-detail', storeId], (old: StoreOverview | undefined) =>
        old ? { ...old, is_online: p.is_online } : old
      )
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="p-6">
      {/* Store header */}
      <div className="flex items-center gap-3 mb-6">
        <span className={`w-3 h-3 rounded-full ${data.is_online ? 'bg-green-400' : 'bg-gray-300'}`} />
        <div>
          <h2 className="text-xl font-bold text-gray-900">{data.store_name}</h2>
          <p className="text-sm text-gray-500">{data.city}</p>
        </div>
        <span className={`ml-auto px-2 py-0.5 rounded text-xs font-medium ${
          data.is_online ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
        }`}>
          {data.is_online ? (isNl ? 'Online' : 'Online') : (isNl ? 'Offline' : 'Offline')}
        </span>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: isNl ? 'Omzet vandaag' : 'Today\'s revenue', value: formatSRD(data.today_revenue_srd) },
          { label: isNl ? 'Transacties' : 'Transactions', value: data.today_transaction_count.toString() },
          { label: isNl ? 'Gemiddelde bon' : 'Avg. basket', value: formatSRD(data.today_avg_basket_srd) },
          { label: 'BTW', value: formatSRD(data.today_btw_srd) },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 mb-1">{label}</p>
            <p className="text-xl font-bold text-gray-900">{value}</p>
          </div>
        ))}
      </div>

      {/* Sync status */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">
          {isNl ? 'Synchronisatiestatus' : 'Sync Status'}
        </h3>
        <div className="flex items-center gap-3">
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
            data.sync_status === 'synced' ? 'bg-green-100 text-green-800' :
            data.sync_status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
            'bg-red-100 text-red-800'
          }`}>
            {data.sync_status}
          </span>
          {data.last_sync_at && (
            <span className="text-xs text-gray-500">
              {isNl ? 'Laatste sync' : 'Last sync'}:{' '}
              {new Date(data.last_sync_at).toLocaleString(isNl ? 'nl-SR' : 'en-US')}
            </span>
          )}
          {data.last_z_report_date && (
            <span className="text-xs text-gray-500">
              {isNl ? 'Laatste Z-rapport' : 'Last Z-report'}:{' '}
              {data.last_z_report_date}
            </span>
          )}
        </div>
      </div>

      {/* Top product */}
      {data.top_product_name && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">
            {isNl ? 'Topproduct vandaag' : 'Top product today'}
          </h3>
          <p className="text-gray-900 font-medium">🏆 {data.top_product_name}</p>
        </div>
      )}
    </div>
  )
}
