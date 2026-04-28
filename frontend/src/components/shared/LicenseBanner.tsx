import { useTranslation } from 'react-i18next'

type LicenseStatus =
  | 'active'
  | 'warning_30'
  | 'warning_14'
  | 'grace'
  | 'soft_lock'
  | 'hard_lock'
  | 'LICENSE_SOFT_LOCK'
  | 'LICENSE_HARD_LOCK'
  | string

function getLicenseStatus(): LicenseStatus | null {
  return localStorage.getItem('josbin_pos_license_status') as LicenseStatus | null
}

export function LicenseBanner() {
  const { i18n } = useTranslation()
  const status = getLicenseStatus()
  const isNl = i18n.language === 'nl'

  if (!status || status === 'active') return null

  type BannerConfig = {
    bg: string
    text: string
    msg: { nl: string; en: string }
  }

  const configs: Record<string, BannerConfig> = {
    warning_30: {
      bg: 'bg-yellow-400 text-yellow-900',
      text: 'font-medium',
      msg: {
        nl: 'Licentie verloopt over 30 dagen. Neem contact op met Josbin POS voor verlenging.',
        en: 'License expires in 30 days. Contact Josbin POS to renew.',
      },
    },
    warning_14: {
      bg: 'bg-amber-500 text-white',
      text: 'font-semibold',
      msg: {
        nl: 'Licentie verloopt over 14 dagen. Verleng nu om onderbreking te voorkomen.',
        en: 'License expires in 14 days. Renew now to avoid interruption.',
      },
    },
    grace: {
      bg: 'bg-red-500 text-white',
      text: 'font-semibold',
      msg: {
        nl: 'Licentie verlopen — 14 dagen noodperiode actief. Verkopen doorgaan. Verleng zo snel mogelijk.',
        en: 'License expired — 14-day grace period active. Sales continue. Renew immediately.',
      },
    },
    soft_lock: {
      bg: 'bg-red-700 text-white',
      text: 'font-bold',
      msg: {
        nl: 'SOFT LOCK: Licentie verlopen. Nieuwe verkopen geblokkeerd. Verleng nu om te heractiveren.',
        en: 'SOFT LOCK: License expired. New sales blocked. Renew to reactivate.',
      },
    },
    LICENSE_SOFT_LOCK: {
      bg: 'bg-red-700 text-white',
      text: 'font-bold',
      msg: {
        nl: 'SOFT LOCK: Licentie verlopen. Nieuwe verkopen geblokkeerd. Verleng nu om te heractiveren.',
        en: 'SOFT LOCK: License expired. New sales blocked. Renew to reactivate.',
      },
    },
    hard_lock: {
      bg: 'bg-gray-900 text-white',
      text: 'font-bold',
      msg: {
        nl: 'HARD LOCK: Systeemtoegang geblokkeerd. Rapporten en exports beschikbaar. Bel Josbin POS.',
        en: 'HARD LOCK: System access blocked. Reports and exports remain available. Call Josbin POS.',
      },
    },
    LICENSE_HARD_LOCK: {
      bg: 'bg-gray-900 text-white',
      text: 'font-bold',
      msg: {
        nl: 'HARD LOCK: Systeemtoegang geblokkeerd. Rapporten en exports beschikbaar. Bel Josbin POS.',
        en: 'HARD LOCK: System access blocked. Reports and exports remain available. Call Josbin POS.',
      },
    },
  }

  const config = configs[status]
  if (!config) return null

  const message = isNl ? config.msg.nl : config.msg.en

  return (
    <div className={`w-full py-1.5 px-4 text-center text-sm ${config.bg} ${config.text}`}>
      {message}
    </div>
  )
}
