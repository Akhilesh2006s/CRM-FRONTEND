import React from 'react';
import { WebSelect } from '../../ui/WebPrimitives';
import { DC_ROW_CATEGORIES, DC_ROW_CATEGORY_BILLING, dcRowCategoryOrDefault } from '../../lib/crm/dcRowCategory';

/** Per-row DC category (New Students / Training Material / Shortage / Excess), as the web DC forms. */
export function DcCategoryPicker({
  value,
  onChange,
  label,
  disabled,
  compact = true,
  showBilling = false,
}: {
  value: unknown;
  onChange: (category: string) => void;
  label?: string;
  disabled?: boolean;
  compact?: boolean;
  showBilling?: boolean;
}) {
  return (
    <WebSelect
      label={label}
      compact={compact}
      disabled={disabled}
      value={dcRowCategoryOrDefault(value)}
      onValueChange={(v) => onChange(v || 'New Students')}
      items={DC_ROW_CATEGORIES.map((c) => ({
        label: showBilling ? `${c} (${DC_ROW_CATEGORY_BILLING[c]})` : c,
        value: c,
      }))}
    />
  );
}

export default DcCategoryPicker;
