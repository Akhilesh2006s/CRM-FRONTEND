/** Mobile port of the web components/dc/SpecimenProductPicker.tsx. */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import type { ProductSpecimenItem, SpecimenItemChoice } from '../../lib/crm/dcRowCategory';
import CheckRow from './CheckRow';

/** Which products get specimen copies (e.g. only EEL), and which items of each product's specimen set. */
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
  minProducts?: number;
  getItems?: (product: string) => ProductSpecimenItem[];
  chosenItems?: SpecimenItemChoice;
  onItemsChange?: (next: SpecimenItemChoice) => void;
}) {
  const chosen = new Set(selected);
  const itemsOf = (product: string) => (getItems ? getItems(product) : []);
  const showProducts = products.length >= minProducts;
  const anyItems = products.some((product) => chosen.has(product) && itemsOf(product).length > 0);
  if (!showProducts && !anyItems) return null;

  const toggleItem = (product: string, item: string, checked: boolean) => {
    const all = itemsOf(product).map((i) => i.product);
    const current = chosenItems[product] ?? all;
    const next = checked ? [...new Set([...current, item])] : current.filter((name) => name !== item);
    onItemsChange?.({ ...chosenItems, [product]: all.filter((name) => next.includes(name)) });
  };

  return (
    <View style={styles.wrap}>
      {showProducts ? (
        <View>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.wrapRow}>
            {products.map((product) => (
              <CheckRow
                key={product}
                checked={chosen.has(product)}
                label={product}
                onChange={(checked) =>
                  onChange(checked ? [...selected, product] : selected.filter((p) => p !== product))
                }
              />
            ))}
          </View>
        </View>
      ) : null}
      {products
        .filter((product) => chosen.has(product) && itemsOf(product).length > 0)
        .map((product) => {
          const ticked = chosenItems[product];
          return (
            <View key={product} style={styles.setBox}>
              <Text style={styles.title}>{product} specimen set</Text>
              <View style={styles.wrapRow}>
                {itemsOf(product).map((item) => (
                  <CheckRow
                    key={item.product}
                    checked={!ticked || ticked.includes(item.product)}
                    label={`${item.product} × ${item.quantity || 1}`}
                    onChange={(checked) => toggleItem(product, item.product, checked)}
                  />
                ))}
              </View>
            </View>
          );
        })}
    </View>
  );
}

/** Product names of the book rows a specimen copy can be made for. */
export function specimenCandidateProducts(rows: Array<{ product?: string; productName?: string }>): string[] {
  return [...new Set(rows.map((r) => String(r.product || r.productName || '').trim()).filter(Boolean))];
}

const styles = StyleSheet.create({
  wrap: { marginTop: 8 },
  title: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 4 },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 8 },
  setBox: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundMuted,
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
  },
});
