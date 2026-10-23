import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, radii } from '../../theme/colors';
import {
  specimenParentProduct,
  type ProductSpecimenItem,
  type SpecimenItemChoice,
} from '../../lib/crm/dcRowCategory';

function Check({ checked, label, note, onPress }: { checked: boolean; label: string; note?: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.check} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.box, checked && styles.boxOn]}>{checked ? <Text style={styles.tick}>✓</Text> : null}</View>
      <Text style={styles.checkLabel}>{label}</Text>
      {note ? <Text style={styles.note}>{note}</Text> : null}
    </TouchableOpacity>
  );
}

/** Which products get specimen copies, and which items of each product's specimen set (web SpecimenProductPicker). */
export function SpecimenProductPicker({
  products,
  selected,
  onChange,
  title = 'Specimen copies for',
  minProducts = 2,
  getItems,
  chosenItems = {},
  onItemsChange,
}: {
  products: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  title?: string;
  /** Hide the product choice when there are fewer products than this. */
  minProducts?: number;
  getItems?: (product: string) => ProductSpecimenItem[];
  /** Ticked items per product; a product missing here sends its whole set. */
  chosenItems?: SpecimenItemChoice;
  onItemsChange?: (next: SpecimenItemChoice) => void;
}) {
  const chosen = new Set(selected);
  const itemsOf = (product: string) => (getItems ? getItems(product) : []);
  const showProducts = products.length >= minProducts;
  const anyItems = products.some((p) => chosen.has(p) && itemsOf(p).length > 0);
  if (!showProducts && !anyItems) return null;

  const toggleItem = (product: string, item: string, checked: boolean) => {
    const all = itemsOf(product).map((i) => i.product);
    const current = chosenItems[product] ?? all;
    const next = checked ? Array.from(new Set([...current, item])) : current.filter((n) => n !== item);
    onItemsChange?.({ ...chosenItems, [product]: all.filter((n) => next.includes(n)) });
  };

  return (
    <View style={styles.wrap}>
      {showProducts ? (
        <View>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.row}>
            {products.map((product) => (
              <Check
                key={product}
                label={product}
                checked={chosen.has(product)}
                onPress={() =>
                  onChange(chosen.has(product) ? selected.filter((p) => p !== product) : [...selected, product])
                }
              />
            ))}
          </View>
        </View>
      ) : null}
      {products
        .filter((p) => chosen.has(p) && itemsOf(p).length > 0)
        .map((product) => {
          const ticked = chosenItems[product];
          return (
            <View key={product} style={styles.setBox}>
              <Text style={styles.title}>{product} specimen set</Text>
              <View style={styles.row}>
                {itemsOf(product).map((item) => {
                  const on = !ticked || ticked.includes(item.product);
                  return (
                    <Check
                      key={item.product}
                      label={item.product}
                      note={`× ${item.quantity || 1}`}
                      checked={on}
                      onPress={() => toggleItem(product, item.product, !on)}
                    />
                  );
                })}
              </View>
            </View>
          );
        })}
    </View>
  );
}

/** Product names of the book rows a specimen copy can be made for. */
export function specimenCandidateProducts(rows: Array<{ product?: string; productName?: string }>): string[] {
  return Array.from(new Set(rows.map((r) => String(r.product || r.productName || '').trim()).filter(Boolean)));
}

/** Products saved specimen lines were requested for, and the items ticked for each. */
export function specimenChoiceFromRows(rows: Array<Record<string, any>>): { products: string[]; items: SpecimenItemChoice } {
  const items: SpecimenItemChoice = {};
  const products: string[] = [];
  for (const row of rows) {
    const parent = specimenParentProduct(row);
    if (!parent) continue;
    if (!products.includes(parent)) products.push(parent);
    if (String(row.specs || '').startsWith('Specimen for ')) {
      const name = String(row.product || row.productName || row.product_name || '').trim();
      items[parent] = [...(items[parent] || []), name];
    }
  }
  return { products, items };
}

const styles = StyleSheet.create({
  wrap: { gap: 8, marginBottom: 8 },
  title: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 4 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  setBox: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, backgroundColor: colors.backgroundMuted, padding: 8 },
  check: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  box: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundLight,
  },
  boxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  tick: { color: '#fff', fontSize: 12, fontWeight: '700' },
  checkLabel: { fontSize: 14, color: colors.textPrimary },
  note: { fontSize: 12, color: colors.textTertiary },
});

export default SpecimenProductPicker;
