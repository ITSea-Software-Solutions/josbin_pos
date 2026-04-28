import { useTranslation } from 'react-i18next'
import type { Category } from '@/types/models'

interface CategoryFilterProps {
  categories: Category[]
  selected: string | null
  onSelect: (categoryId: string | null) => void
}

export default function CategoryFilter({ categories, selected, onSelect }: CategoryFilterProps) {
  const { t, i18n } = useTranslation()
  const isNl = i18n.language === 'nl'

  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        overflowX: 'auto',
        padding: '0 16px',
        flexShrink: 0,
        scrollbarWidth: 'none',
      }}
    >
      <CategoryChip
        label={t('pos.allCategories')}
        active={selected === null}
        onClick={() => onSelect(null)}
      />
      {categories.map((cat) => (
        <CategoryChip
          key={cat.id}
          label={isNl ? cat.name_nl : cat.name_en}
          active={selected === cat.id}
          onClick={() => onSelect(cat.id)}
        />
      ))}
    </div>
  )
}

function CategoryChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        flexShrink: 0,
        padding: '8px 16px',
        borderRadius: 20,
        border: active ? '1px solid var(--color-primary)' : '1px solid var(--border-color)',
        background: active ? 'var(--color-primary)' : 'var(--bg-elevated)',
        color: active ? '#fff' : 'var(--text-secondary)',
        fontSize: 'var(--font-size-sm)',
        fontWeight: active ? 600 : 400,
        cursor: 'pointer',
        height: 36,
        whiteSpace: 'nowrap',
        transition: 'all 0.12s',
      }}
    >
      {label}
    </button>
  )
}
