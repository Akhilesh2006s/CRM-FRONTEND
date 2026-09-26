import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { WebSelect } from '../../ui/WebPrimitives';
import { apiService } from '../../services/api';
import { assignTermsByLevelCombination } from '../../utils/levelTermRouting';

export type CloseLeadProductRow = {
  id: string;
  product: string;
  class: string;
  category: string;
  quantity: number;
  strength: number;
  price: number;
  total: number;
  level: string;
  specs: string;
  subject?: string;
  deliverables?: string[];
  term?: string;
  isParentRow?: boolean;
  sameRateForAllClasses?: boolean;
};

type ClassEntry = { selected: boolean; strength: number; category?: string };

type SectionProduct = {
  product: string;
  expanded: boolean;
  sameStrengthForAll: boolean;
  strengthForAll: string;
  sameRateForAllClasses: boolean;
  unitPrice: string;
  selectedSpec: string;
  selectedCategory: string;
  selectedLevels: string[];
  selectedSubjects: string[];
  selectedDeliverables: string[];
  classes: Record<string, ClassEntry>;
};

type ProductSection = {
  id: string;
  products: SectionProduct[];
};

const CLASS_NUMBERS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

function emptyClasses(): Record<string, ClassEntry> {
  return Object.fromEntries(CLASS_NUMBERS.map((c) => [c, { selected: false, strength: 0 }]));
}

function getCatalogEntry(catalogProducts: any[], productName: string) {
  return catalogProducts.find(
    (p) => (p.productName || p.name || p.product || '') === productName,
  );
}

function getCatalogProductId(catalogProducts: any[], productName: string): string | null {
  const product = getCatalogEntry(catalogProducts, productName);
  return product?._id ? String(product._id) : null;
}

/** Specs only when product.hasSpecs is true (e.g. p4 / p6). */
function getProductSpecsOptions(catalogProducts: any[], productName: string): string[] {
  const product = getCatalogEntry(catalogProducts, productName);
  if (!product?.hasSpecs) return [];
  if (Array.isArray(product.specs) && product.specs.length > 0) {
    return product.specs.map((s: any) => String(s).trim()).filter(Boolean);
  }
  if (typeof product.specs === 'string' && product.specs.trim()) {
    return [product.specs.trim()];
  }
  return [];
}

/** Subjects when product.hasSubjects is true (e.g. p2). */
function getProductSubjectsOptions(catalogProducts: any[], productName: string): string[] {
  const product = getCatalogEntry(catalogProducts, productName);
  if (!product?.hasSubjects) return [];
  if (Array.isArray(product.subjects) && product.subjects.length > 0) {
    return product.subjects.map((s: any) => String(s).trim()).filter(Boolean);
  }
  return [];
}

/** Levels from product.productLevels (e.g. p3 / p5). */
function getProductLevelsOptions(catalogProducts: any[], productName: string): string[] {
  const product = getCatalogEntry(catalogProducts, productName);
  if (Array.isArray(product?.productLevels) && product.productLevels.length > 0) {
    return product.productLevels.map((l: any) => String(l).trim()).filter(Boolean);
  }
  return [];
}

function getProductCategoryOptions(catalogProducts: any[], productName: string): string[] {
  const product = getCatalogEntry(catalogProducts, productName);
  if (!product?.hasCategory) return [];
  if (Array.isArray(product.categories) && product.categories.length > 0) {
    return product.categories.map((c: any) => String(c).trim()).filter(Boolean);
  }
  return [];
}

function createSectionProduct(product: string, catalogProducts: any[]): SectionProduct {
  const specs = getProductSpecsOptions(catalogProducts, product);
  const categories = getProductCategoryOptions(catalogProducts, product);
  const levels = getProductLevelsOptions(catalogProducts, product);
  const subjects = getProductSubjectsOptions(catalogProducts, product);
  return {
    product,
    expanded: true,
    sameStrengthForAll: true,
    strengthForAll: '',
    sameRateForAllClasses: true,
    unitPrice: '',
    selectedSpec: 'CW',
    selectedCategory: categories[0] || '',
    selectedLevels: levels.length > 0 ? [levels[0]] : [],
    selectedSubjects: subjects.length > 0 ? [subjects[0]] : [],
    selectedDeliverables: [],
    classes: emptyClasses(),
  };
}

function newSectionId() {
  return `sec_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function classStrengthFor(sp: SectionProduct, cls: string): number {
  const entry = sp.classes[cls];
  if (!entry?.selected) return 0;
  const bulk = Number(sp.strengthForAll) || 0;
  return sp.sameStrengthForAll ? bulk : Number(entry.strength) || 0;
}

function lineTotalAmount(sp: SectionProduct, catalogProducts: any[]): number {
  const price = Number(sp.unitPrice) || 0;
  const strengthSum = CLASS_NUMBERS.reduce((sum, cls) => sum + classStrengthFor(sp, cls), 0);
  // Match expanded Product Details rows: one row per class × level × subject
  const levelOptions = getProductLevelsOptions(catalogProducts, sp.product);
  const subjectOptions = getProductSubjectsOptions(catalogProducts, sp.product);
  const levelsCount =
    levelOptions.length > 0
      ? Math.max(1, (sp.selectedLevels || []).length)
      : 1;
  const subjectsCount =
    subjectOptions.length > 0
      ? Math.max(1, (sp.selectedSubjects || []).length)
      : 1;
  return strengthSum * price * levelsCount * subjectsCount;
}

function productHeaderSummary(sp: SectionProduct): string {
  const parts = CLASS_NUMBERS.filter((c) => sp.classes[c]?.selected)
    .map((c) => {
      const s = classStrengthFor(sp, c);
      return s > 0 ? `Cl ${c} (${s})` : `Cl ${c}`;
    });
  if (parts.length === 0) return 'No classes selected';
  return parts.join(', ');
}

function expandSectionsToRows(
  sections: ProductSection[],
  catalogProducts: any[],
): CloseLeadProductRow[] {
  const rows: CloseLeadProductRow[] = [];
  sections.forEach((sec) => {
    sec.products.forEach((sp) => {
      const price = Number(sp.unitPrice) || 0;
      const levelOptions = getProductLevelsOptions(catalogProducts, sp.product);
      const subjectOptions = getProductSubjectsOptions(catalogProducts, sp.product);
      const levelsToUse =
        levelOptions.length > 0
          ? sp.selectedLevels.length > 0
            ? sp.selectedLevels
            : [levelOptions[0]]
          : [''];
      const subjectsToUse =
        subjectOptions.length > 0
          ? sp.selectedSubjects.length > 0
            ? sp.selectedSubjects
            : [subjectOptions[0]]
          : [''];

      CLASS_NUMBERS.forEach((cls) => {
        const strength = classStrengthFor(sp, cls);
        if (strength <= 0) return;
        const entry = sp.classes[cls];
        let idx = 0;
        const specsToUse = sp.selectedSpec === 'CW and HW' ? ['CW', 'HW'] : ['CW'];
        levelsToUse.forEach((level) => {
          subjectsToUse.forEach((subject) => {
            specsToUse.forEach((specs) => {
            rows.push({
              id: `${sec.id}_${sp.product}_${cls}_${specs}_${idx++}`,
              product: sp.product,
              class: cls,
              category: entry?.category || sp.selectedCategory || '',
              quantity: strength,
              strength,
              price,
              total: strength * price,
              level: level || '',
              specs,
              subject: subject || undefined,
              deliverables: sp.selectedDeliverables?.length
                ? [...sp.selectedDeliverables]
                : undefined,
              term: 'Term 1', // reassigned in assignTermsByLevelCombination
              isParentRow: false,
              sameRateForAllClasses: sp.sameRateForAllClasses,
            });
          });
        });
      });
    });
  });
  return assignTermsByLevelCombination(rows, (product) =>
    getProductLevelsOptions(catalogProducts, product),
  );
}

function productHasValidClasses(sp: SectionProduct) {
  return CLASS_NUMBERS.some((c) => classStrengthFor(sp, c) > 0);
}

type Props = {
  visible: boolean;
  onClose: () => void;
  onDone: (rows: CloseLeadProductRow[]) => void;
  catalogProducts: any[];
  loadingProducts?: boolean;
  onRefreshProducts?: () => void;
};

export default function CloseLeadProductsModal({
  visible,
  onClose,
  onDone,
  catalogProducts,
  loadingProducts,
  onRefreshProducts,
}: Props) {
  const [sections, setSections] = useState<ProductSection[]>([]);
  const [deliverablesByProduct, setDeliverablesByProduct] = useState<Record<string, string[]>>(
    {},
  );

  useEffect(() => {
    if (visible && sections.length === 0) {
      setSections([{ id: newSectionId(), products: [] }]);
    }
  }, [visible]);

  // When catalog levels are renamed (e.g. Term 1 → hi), remapping selectedLevels keeps checkboxes in sync.
  useEffect(() => {
    if (!visible || !catalogProducts.length) return;
    setSections((prev) =>
      prev.map((sec) => ({
        ...sec,
        products: sec.products.map((sp) => {
          const levels = getProductLevelsOptions(catalogProducts, sp.product);
          if (levels.length === 0) return { ...sp, selectedLevels: [] };
          const mapped = (sp.selectedLevels || [])
            .map((sel, i) => {
              if (levels.includes(sel)) return sel;
              return levels[Math.min(i, levels.length - 1)] || levels[0];
            })
            .filter(Boolean);
          const next =
            mapped.length > 0 ? Array.from(new Set(mapped)) : [levels[0]];
          if (
            next.length === (sp.selectedLevels || []).length &&
            next.every((v, i) => v === (sp.selectedLevels || [])[i])
          ) {
            return sp;
          }
          return { ...sp, selectedLevels: next };
        }),
      })),
    );
  }, [catalogProducts, visible]);

  const ensureDeliverablesLoaded = async (productName: string) => {
    if (deliverablesByProduct[productName] !== undefined) return;
    const productId = getCatalogProductId(catalogProducts, productName);
    if (!productId) {
      setDeliverablesByProduct((prev) => ({ ...prev, [productName]: [] }));
      return;
    }
    try {
      const items = await apiService.get(`/deliverables/by-product/${productId}`);
      const names = (Array.isArray(items) ? items : [])
        .map((d: any) => String(d.deliverableName || d.name || '').trim())
        .filter(Boolean);
      setDeliverablesByProduct((prev) => ({ ...prev, [productName]: names }));
    } catch {
      setDeliverablesByProduct((prev) => ({ ...prev, [productName]: [] }));
    }
  };

  const catalogNames = useMemo(
    () =>
      catalogProducts.map(
        (p) => p.productName || p.name || p.product || 'Unknown'
      ) as string[],
    [catalogProducts]
  );

  const addSection = () => {
    setSections((prev) => [...prev, { id: newSectionId(), products: [] }]);
  };

  const removeSection = (sectionId: string) => {
    setSections((prev) => prev.filter((s) => s.id !== sectionId));
  };

  const toggleProductInSection = (sectionId: string, productName: string) => {
    void ensureDeliverablesLoaded(productName);
    setSections((prev) =>
      prev.map((sec) => {
        if (sec.id !== sectionId) return sec;
        const exists = sec.products.find((p) => p.product === productName);
        if (exists) {
          return { ...sec, products: sec.products.filter((p) => p.product !== productName) };
        }
        // Collapse other products so only one panel is open
        const collapsed = sec.products.map((p) => ({ ...p, expanded: false }));
        return { ...sec, products: [...collapsed, createSectionProduct(productName, catalogProducts)] };
      })
    );
  };

  const updateSectionProduct = (
    sectionId: string,
    productName: string,
    patch: Partial<SectionProduct>
  ) => {
    setSections((prev) =>
      prev.map((sec) => {
        if (sec.id !== sectionId) return sec;
        return {
          ...sec,
          products: sec.products.map((p) => {
            if (p.product !== productName) {
              // Only one panel open at a time when expanding
              if (patch.expanded === true) return { ...p, expanded: false };
              return p;
            }
            return { ...p, ...patch };
          }),
        };
      })
    );
  };

  const toggleClass = (sectionId: string, productName: string, classNum: string) => {
    setSections((prev) =>
      prev.map((sec) => {
        if (sec.id !== sectionId) return sec;
        return {
          ...sec,
          products: sec.products.map((p) => {
            if (p.product !== productName) return p;
            const entry = p.classes[classNum] || { selected: false, strength: 0 };
            return {
              ...p,
              classes: {
                ...p.classes,
                [classNum]: { ...entry, selected: !entry.selected },
              },
            };
          }),
        };
      })
    );
  };

  const setClassStrength = (
    sectionId: string,
    productName: string,
    classNum: string,
    value: string
  ) => {
    const num = value === '' ? 0 : Number(value.replace(/^0+(?=\d)/, '') || value) || 0;
    setSections((prev) =>
      prev.map((sec) => {
        if (sec.id !== sectionId) return sec;
        return {
          ...sec,
          products: sec.products.map((p) => {
            if (p.product !== productName) return p;
            const entry = p.classes[classNum] || { selected: false, strength: 0 };
            return {
              ...p,
              classes: {
                ...p.classes,
                [classNum]: { ...entry, strength: num },
              },
            };
          }),
        };
      })
    );
  };

  const handleDone = () => {
    const selected = sections.flatMap((s) => s.products);
    if (selected.length === 0) {
      Alert.alert('Products required', 'Select at least one product and configure classes.');
      return;
    }
    for (const sp of selected) {
      if (!productHasValidClasses(sp)) {
        Alert.alert(
          'Incomplete product',
          `Select classes with strength > 0 for "${sp.product}".`,
        );
        return;
      }
      if (!(Number(sp.unitPrice) > 0)) {
        Alert.alert('Unit price required', `Enter unit price for "${sp.product}".`);
        return;
      }
      const deliverables = deliverablesByProduct[sp.product] || [];
      if (deliverables.length > 0 && (!sp.selectedDeliverables || sp.selectedDeliverables.length === 0)) {
        Alert.alert('Deliverables required', `Select at least one deliverable for "${sp.product}".`);
        return;
      }
      const subjects = getProductSubjectsOptions(catalogProducts, sp.product);
      if (subjects.length > 0 && (!sp.selectedSubjects || sp.selectedSubjects.length === 0)) {
        Alert.alert('Subjects required', `Select at least one subject for "${sp.product}".`);
        return;
      }
      const levels = getProductLevelsOptions(catalogProducts, sp.product);
      if (levels.length > 0 && (!sp.selectedLevels || sp.selectedLevels.length === 0)) {
        Alert.alert('Levels required', `Select at least one level for "${sp.product}".`);
        return;
      }
      const specs = getProductSpecsOptions(catalogProducts, sp.product);
      if (specs.length > 0 && !sp.selectedSpec) {
        Alert.alert('Specs required', `Select a spec for "${sp.product}".`);
        return;
      }
    }
    const rows = expandSectionsToRows(sections, catalogProducts);
    onDone(rows);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Add Products & Details</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            <Text style={styles.instructions}>
              Add a section, pick products, then set classes and strength per product. Only one product
              panel is open at a time. DC rows are generated per class for each product.
            </Text>

            <View style={styles.sectionsHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionsTitle}>Sections</Text>
                <Text style={styles.sectionsHint}>
                  Products are always edited inside a section. Use the catalog buttons under each
                  section.
                </Text>
              </View>
              <TouchableOpacity style={styles.addSectionBtn} onPress={addSection}>
                <Ionicons name="add" size={18} color="#fff" />
                <Text style={styles.addSectionText}>Add section</Text>
              </TouchableOpacity>
            </View>

            {loadingProducts ? (
              <View style={styles.centerBox}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.muted}>Loading products…</Text>
              </View>
            ) : catalogNames.length === 0 ? (
              <View style={styles.warnBox}>
                <Text style={styles.warnText}>No products available. Contact admin to add products.</Text>
                {onRefreshProducts ? (
                  <TouchableOpacity onPress={onRefreshProducts} style={styles.refreshBtn}>
                    <Text style={styles.refreshText}>Refresh</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}

            {sections.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.muted}>
                  No sections yet. Tap “Add section”, then pick products and classes.
                </Text>
              </View>
            ) : (
              sections.map((section, idx) => (
                <View key={section.id} style={styles.sectionCard}>
                  <View style={styles.sectionTop}>
                    <Text style={styles.sectionLabel}>Section {idx + 1}</Text>
                    <TouchableOpacity
                      onPress={() => removeSection(section.id)}
                      style={styles.removeLink}
                    >
                      <Ionicons name="close" size={16} color={colors.error} />
                      <Text style={styles.removeLinkText}>Remove section</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.subHeading}>Add products to this section</Text>
                  <View style={styles.productChips}>
                    {catalogNames.map((name) => {
                      const selected = section.products.some((p) => p.product === name);
                      return (
                        <TouchableOpacity
                          key={name}
                          style={[styles.chip, selected && styles.chipSelected]}
                          onPress={() => toggleProductInSection(section.id, name)}
                        >
                          <View style={[styles.checkbox, selected && styles.checkboxOn]}>
                            {selected ? (
                              <Ionicons name="checkmark" size={12} color="#fff" />
                            ) : null}
                          </View>
                          <Text style={[styles.chipText, selected && styles.chipTextOn]}>{name}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {section.products.map((sp) => {
                    const valid = productHasValidClasses(sp);
                    const deliverableOptions = deliverablesByProduct[sp.product] || [];
                    const subjectOptions = getProductSubjectsOptions(catalogProducts, sp.product);
                    const levelOptions = getProductLevelsOptions(catalogProducts, sp.product);
                    const specOptions = ['CW', 'CW and HW'];
                    const totalAmt = lineTotalAmount(sp, catalogProducts);
                    return (
                      <View key={sp.product} style={styles.productPanel}>
                        <TouchableOpacity
                          style={styles.productPanelHeader}
                          onPress={() =>
                            updateSectionProduct(section.id, sp.product, {
                              expanded: !sp.expanded,
                            })
                          }
                        >
                          <Ionicons
                            name={sp.expanded ? 'chevron-up' : 'chevron-down'}
                            size={18}
                            color={colors.textSecondary}
                          />
                          <Text style={styles.productPanelTitle}>
                            {sp.product}{' '}
                            <Text style={styles.productPanelMeta}>
                              {productHeaderSummary(sp)}
                            </Text>
                          </Text>
                        </TouchableOpacity>

                        {sp.expanded ? (
                          <View style={styles.productPanelBody}>
                            <Text style={styles.classesTitle}>Classes for {sp.product} *</Text>
                            <Text style={styles.classesHint}>
                              Strength per class applies only to this product.
                            </Text>

                            <TouchableOpacity
                              style={styles.checkRow}
                              onPress={() =>
                                updateSectionProduct(section.id, sp.product, {
                                  sameStrengthForAll: !sp.sameStrengthForAll,
                                })
                              }
                            >
                              <View
                                style={[
                                  styles.checkbox,
                                  sp.sameStrengthForAll && styles.checkboxOn,
                                ]}
                              >
                                {sp.sameStrengthForAll ? (
                                  <Ionicons name="checkmark" size={12} color="#fff" />
                                ) : null}
                              </View>
                              <Text style={styles.checkLabel}>
                                Same strength for all selected classes
                              </Text>
                            </TouchableOpacity>

                            {sp.sameStrengthForAll ? (
                              <View style={styles.bulkStrengthRow}>
                                <Text style={styles.bulkLabel}>Strength for all:</Text>
                                <TextInput
                                  style={styles.bulkInput}
                                  keyboardType="number-pad"
                                  placeholder="Qty"
                                  placeholderTextColor={colors.textMuted}
                                  value={sp.strengthForAll}
                                  onChangeText={(t) =>
                                    updateSectionProduct(section.id, sp.product, {
                                      strengthForAll: t.replace(/[^0-9]/g, ''),
                                    })
                                  }
                                />
                              </View>
                            ) : null}

                            <View style={styles.classGrid}>
                              {CLASS_NUMBERS.map((cls) => {
                                const entry = sp.classes[cls];
                                const selected = !!entry?.selected;
                                return (
                                  <View key={cls} style={styles.classCell}>
                                    <TouchableOpacity
                                      style={styles.classCheckRow}
                                      onPress={() => toggleClass(section.id, sp.product, cls)}
                                    >
                                      <View
                                        style={[styles.checkbox, selected && styles.checkboxOn]}
                                      >
                                        {selected ? (
                                          <Ionicons name="checkmark" size={12} color="#fff" />
                                        ) : null}
                                      </View>
                                      <Text style={styles.classLabel}>Class {cls}</Text>
                                    </TouchableOpacity>
                                    <TextInput
                                      style={[
                                        styles.classStrengthInput,
                                        (sp.sameStrengthForAll || !selected) &&
                                          styles.inputDisabled,
                                      ]}
                                      editable={!sp.sameStrengthForAll && selected}
                                      keyboardType="number-pad"
                                      placeholder="Strength"
                                      placeholderTextColor={colors.textMuted}
                                      value={
                                        sp.sameStrengthForAll
                                          ? selected
                                            ? sp.strengthForAll
                                            : ''
                                          : entry?.strength
                                            ? String(entry.strength)
                                            : ''
                                      }
                                      onChangeText={(t) =>
                                        setClassStrength(
                                          section.id,
                                          sp.product,
                                          cls,
                                          t.replace(/[^0-9]/g, '')
                                        )
                                      }
                                    />
                                  </View>
                                );
                              })}
                            </View>

                            {!valid ? (
                              <Text style={styles.validation}>
                                Select at least one class with strength greater than 0.
                              </Text>
                            ) : null}

                            {/* p1 → deliverables (when configured for product) */}
                            {deliverableOptions.length > 0 ? (
                              <View style={styles.specsBlock}>
                                <Text style={styles.classesTitle}>Select Deliverables *</Text>
                                <View style={styles.specsRow}>
                                  {deliverableOptions.map((name) => {
                                    const selected = (sp.selectedDeliverables || []).includes(name);
                                    return (
                                      <TouchableOpacity
                                        key={name}
                                        style={[styles.specChip, selected && styles.specChipOn]}
                                        onPress={() => {
                                          const cur = sp.selectedDeliverables || [];
                                          const next = selected
                                            ? cur.filter((d) => d !== name)
                                            : [...cur, name];
                                          updateSectionProduct(section.id, sp.product, {
                                            selectedDeliverables: next,
                                          });
                                        }}
                                      >
                                        <View
                                          style={[styles.checkbox, selected && styles.checkboxOn]}
                                        >
                                          {selected ? (
                                            <Ionicons name="checkmark" size={12} color="#fff" />
                                          ) : null}
                                        </View>
                                        <Text
                                          style={[
                                            styles.specChipText,
                                            selected && styles.specChipTextOn,
                                          ]}
                                        >
                                          {name}
                                        </Text>
                                      </TouchableOpacity>
                                    );
                                  })}
                                </View>
                              </View>
                            ) : null}

                            {/* p2 → subjects */}
                            {subjectOptions.length > 0 ? (
                              <View style={styles.specsBlock}>
                                <Text style={styles.classesTitle}>Select Subjects *</Text>
                                <View style={styles.specsRow}>
                                  {subjectOptions.map((name) => {
                                    const selected = (sp.selectedSubjects || []).includes(name);
                                    return (
                                      <TouchableOpacity
                                        key={name}
                                        style={[styles.specChip, selected && styles.specChipOn]}
                                        onPress={() => {
                                          const cur = sp.selectedSubjects || [];
                                          const next = selected
                                            ? cur.filter((s) => s !== name)
                                            : [...cur, name];
                                          updateSectionProduct(section.id, sp.product, {
                                            selectedSubjects: next,
                                          });
                                        }}
                                      >
                                        <View
                                          style={[styles.checkbox, selected && styles.checkboxOn]}
                                        >
                                          {selected ? (
                                            <Ionicons name="checkmark" size={12} color="#fff" />
                                          ) : null}
                                        </View>
                                        <Text
                                          style={[
                                            styles.specChipText,
                                            selected && styles.specChipTextOn,
                                          ]}
                                        >
                                          {name}
                                        </Text>
                                      </TouchableOpacity>
                                    );
                                  })}
                                </View>
                              </View>
                            ) : null}

                            {/* p3 / p5 → select levels */}
                            {levelOptions.length > 0 ? (
                              <View style={styles.specsBlock}>
                                <Text style={styles.classesTitle}>Select Levels *</Text>
                                <View style={styles.specsRow}>
                                  {levelOptions.map((name) => {
                                    const selected = (sp.selectedLevels || []).includes(name);
                                    return (
                                      <TouchableOpacity
                                        key={name}
                                        style={[styles.specChip, selected && styles.specChipOn]}
                                        onPress={() => {
                                          const cur = sp.selectedLevels || [];
                                          const next = selected
                                            ? cur.filter((l) => l !== name)
                                            : [...cur, name];
                                          if (next.length === 0) {
                                            Alert.alert('Levels', 'Select at least one level');
                                            return;
                                          }
                                          updateSectionProduct(section.id, sp.product, {
                                            selectedLevels: next,
                                          });
                                        }}
                                      >
                                        <View
                                          style={[styles.checkbox, selected && styles.checkboxOn]}
                                        >
                                          {selected ? (
                                            <Ionicons name="checkmark" size={12} color="#fff" />
                                          ) : null}
                                        </View>
                                        <Text
                                          style={[
                                            styles.specChipText,
                                            selected && styles.specChipTextOn,
                                          ]}
                                        >
                                          {name}
                                        </Text>
                                      </TouchableOpacity>
                                    );
                                  })}
                                </View>
                                {(sp.selectedLevels || []).length === 0 ? (
                                  <Text style={styles.validation}>
                                    Select at least one level to generate product rows.
                                  </Text>
                                ) : null}
                              </View>
                            ) : null}

                            {/* p4 / p6 → specs */}
                            {specOptions.length > 0 ? (
                              <View style={styles.specsBlock}>
                                <Text style={styles.classesTitle}>Select Specs *</Text>
                                <View style={styles.specsRow}>
                                  {specOptions.map((spec) => {
                                    const selected = sp.selectedSpec === spec;
                                    return (
                                      <TouchableOpacity
                                        key={spec}
                                        style={[styles.specChip, selected && styles.specChipOn]}
                                        onPress={() =>
                                          updateSectionProduct(section.id, sp.product, {
                                            selectedSpec: spec,
                                          })
                                        }
                                      >
                                        <View
                                          style={[styles.checkbox, selected && styles.checkboxOn]}
                                        >
                                          {selected ? (
                                            <Ionicons name="checkmark" size={12} color="#fff" />
                                          ) : null}
                                        </View>
                                        <Text
                                          style={[
                                            styles.specChipText,
                                            selected && styles.specChipTextOn,
                                          ]}
                                        >
                                          {spec}
                                        </Text>
                                      </TouchableOpacity>
                                    );
                                  })}
                                </View>
                              </View>
                            ) : null}

                            {getProductCategoryOptions(catalogProducts, sp.product).length > 0 ? (
                              <WebSelect
                                label="Product Category *"
                                value={sp.selectedCategory}
                                onValueChange={(v) =>
                                  updateSectionProduct(section.id, sp.product, {
                                    selectedCategory: v,
                                    classes: Object.fromEntries(
                                      Object.entries(sp.classes).map(([cls, entry]) => [
                                        cls,
                                        entry.selected ? { ...entry, category: v } : entry,
                                      ]),
                                    ),
                                  })
                                }
                                items={getProductCategoryOptions(catalogProducts, sp.product).map(
                                  (c) => ({ label: c, value: c }),
                                )}
                                placeholder="Select category"
                              />
                            ) : null}

                            <View style={styles.priceTotalRow}>
                              <View style={styles.priceCol}>
                                <Text style={styles.bulkLabel}>Unit Price *</Text>
                                <TextInput
                                  style={styles.bulkInput}
                                  keyboardType="decimal-pad"
                                  placeholder="0"
                                  placeholderTextColor={colors.textMuted}
                                  value={sp.unitPrice}
                                  onChangeText={(t) =>
                                    updateSectionProduct(section.id, sp.product, {
                                      unitPrice: t.replace(/[^0-9.]/g, ''),
                                    })
                                  }
                                />
                              </View>
                              <View style={styles.priceCol}>
                                <Text style={styles.bulkLabel}>Total</Text>
                                <View style={styles.totalBox}>
                                  <Text style={styles.totalText}>
                                    ₹
                                    {totalAmt.toLocaleString('en-IN', {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}
                                  </Text>
                                </View>
                              </View>
                            </View>

                            <View style={styles.productFooter}>
                              <TouchableOpacity
                                style={styles.checkRow}
                                onPress={() =>
                                  updateSectionProduct(section.id, sp.product, {
                                    sameRateForAllClasses: !sp.sameRateForAllClasses,
                                  })
                                }
                              >
                                <View
                                  style={[
                                    styles.checkbox,
                                    sp.sameRateForAllClasses && styles.checkboxOn,
                                  ]}
                                >
                                  {sp.sameRateForAllClasses ? (
                                    <Ionicons name="checkmark" size={12} color="#fff" />
                                  ) : null}
                                </View>
                                <Text style={styles.checkLabel}>
                                  Same rate for all classes (this level)
                                </Text>
                              </TouchableOpacity>

                              <TouchableOpacity
                                onPress={() => toggleProductInSection(section.id, sp.product)}
                                style={styles.removeLink}
                              >
                                <Ionicons name="close" size={16} color={colors.error} />
                                <Text style={styles.removeLinkText}>Remove product</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              ))
            )}

            {/* Live Product Details preview (matches web close-lead table) */}
            {(() => {
              const previewRows = expandSectionsToRows(sections, catalogProducts);
              if (previewRows.length === 0) return null;
              const qtyTotal = previewRows.reduce((s, r) => s + (Number(r.strength) || 0), 0);
              const amountTotal = previewRows.reduce(
                (s, r) => s + (Number(r.total) || Number(r.strength) * Number(r.price) || 0),
                0,
              );
              const showSpecs = previewRows.some((r) => !!r.specs);
              const showSubjects = previewRows.some((r) => !!r.subject);
              return (
                <View style={styles.detailsPreview}>
                  <Text style={styles.detailsPreviewTitle}>Product Details</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator>
                    <View>
                      <View style={styles.detailsHeaderRow}>
                        <Text style={[styles.dCell, styles.dProduct, styles.dHeader]}>Product</Text>
                        <Text style={[styles.dCell, styles.dLevel, styles.dHeader]}>Level</Text>
                        <Text style={[styles.dCell, styles.dClass, styles.dHeader]}>Class</Text>
                        <Text style={[styles.dCell, styles.dCat, styles.dHeader]}>
                          Product Category
                        </Text>
                        {showSpecs ? (
                          <Text style={[styles.dCell, styles.dSpecs, styles.dHeader]}>Specs</Text>
                        ) : null}
                        {showSubjects ? (
                          <Text style={[styles.dCell, styles.dSpecs, styles.dHeader]}>Subjects</Text>
                        ) : null}
                        <Text style={[styles.dCell, styles.dQty, styles.dHeader]}>
                          Quantity (Strength) *
                        </Text>
                        <Text style={[styles.dCell, styles.dAction, styles.dHeader]}>Action</Text>
                      </View>
                      {previewRows.map((row) => {
                        const catOptions = getProductCategoryOptions(catalogProducts, row.product);
                        return (
                        <View key={row.id} style={styles.detailsRow}>
                          <Text style={[styles.dCell, styles.dProduct]} numberOfLines={1}>
                            {row.product}
                          </Text>
                          <Text style={[styles.dCell, styles.dLevel]}>{row.level || '—'}</Text>
                          <Text style={[styles.dCell, styles.dClass]}>{row.class}</Text>
                          <View style={[styles.dCell, styles.dCat]}>
                            {catOptions.length > 0 ? (
                              <WebSelect
                                value={row.category || catOptions[0]}
                                onValueChange={(v) => {
                                  setSections((prev) =>
                                    prev.map((sec) => ({
                                      ...sec,
                                      products: sec.products.map((p) => {
                                        if (p.product !== row.product) return p;
                                        const entry = p.classes[row.class];
                                        if (!entry) return p;
                                        return {
                                          ...p,
                                          classes: {
                                            ...p.classes,
                                            [row.class]: { ...entry, category: v },
                                          },
                                        };
                                      }),
                                    })),
                                  );
                                }}
                                items={catOptions.map((c) => ({ label: c, value: c }))}
                                placeholder="Category"
                              />
                            ) : (
                              <Text style={styles.dCatText} numberOfLines={1}>
                                {row.category || '—'}
                              </Text>
                            )}
                          </View>
                          {showSpecs ? (
                            <Text style={[styles.dCell, styles.dSpecs]} numberOfLines={1}>
                              {row.specs || '—'}
                            </Text>
                          ) : null}
                          {showSubjects ? (
                            <Text style={[styles.dCell, styles.dSpecs]} numberOfLines={1}>
                              {row.subject || '—'}
                            </Text>
                          ) : null}
                          <Text style={[styles.dCell, styles.dQty]}>{row.strength}</Text>
                          <TouchableOpacity
                            style={styles.dActionBtn}
                            onPress={() => {
                              setSections((prev) =>
                                prev.map((sec) => ({
                                  ...sec,
                                  products: sec.products.map((p) => {
                                    if (p.product !== row.product) return p;
                                    const entry = p.classes[row.class];
                                    if (!entry) return p;
                                    return {
                                      ...p,
                                      classes: {
                                        ...p.classes,
                                        [row.class]: { ...entry, selected: false, strength: 0 },
                                      },
                                    };
                                  }),
                                })),
                              );
                            }}
                          >
                            <Ionicons name="close" size={18} color={colors.error} />
                          </TouchableOpacity>
                        </View>
                        );
                      })}
                      <View style={[styles.detailsRow, styles.detailsTotalRow]}>
                        <Text style={[styles.dCell, styles.dProduct, styles.dTotalLabel]}>
                          Total:
                        </Text>
                        <Text style={[styles.dCell, styles.dLevel]} />
                        <Text style={[styles.dCell, styles.dClass]} />
                        <Text style={[styles.dCell, styles.dCat]} />
                        {showSpecs ? <Text style={[styles.dCell, styles.dSpecs]} /> : null}
                        {showSubjects ? <Text style={[styles.dCell, styles.dSpecs]} /> : null}
                        <Text style={[styles.dCell, styles.dQty, styles.dTotalValue]}>
                          {qtyTotal}
                        </Text>
                        <Text style={[styles.dCell, styles.dAction, styles.dTotalValue]}>
                          ₹
                          {amountTotal.toLocaleString('en-IN', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </Text>
                      </View>
                    </View>
                  </ScrollView>
                </View>
              );
            })()}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.doneBtn} onPress={handleDone}>
              <Text style={styles.doneText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.backgroundLight,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '94%',
    minHeight: '70%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { ...typography.heading.h2, color: colors.textPrimary },
  body: { flexGrow: 1 },
  bodyContent: { padding: 16, paddingBottom: 24 },
  instructions: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
    marginBottom: 14,
  },
  sectionsHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundMuted,
  },
  sectionsTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  sectionsHint: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
  addSectionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.info,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addSectionText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  centerBox: { alignItems: 'center', padding: 20, gap: 8 },
  muted: { fontSize: 13, color: colors.textSecondary },
  warnBox: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#FEF3C7',
    marginBottom: 12,
  },
  warnText: { color: '#92400E', fontSize: 13 },
  refreshBtn: { marginTop: 8 },
  refreshText: { color: colors.info, fontWeight: '600' },
  emptyBox: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundMuted,
  },
  sectionCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    backgroundColor: '#fff',
  },
  sectionTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionLabel: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  removeLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  removeLinkText: { color: colors.error, fontSize: 13, fontWeight: '600' },
  subHeading: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  productChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundMuted,
  },
  chipSelected: {
    borderColor: colors.info,
    backgroundColor: colors.infoLight,
  },
  chipText: { fontSize: 13, color: colors.textPrimary, fontWeight: '600' },
  chipTextOn: { color: colors.info },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  checkboxOn: {
    backgroundColor: colors.info,
    borderColor: colors.info,
  },
  productPanel: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    marginTop: 8,
    overflow: 'hidden',
    backgroundColor: colors.backgroundMuted,
  },
  productPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: '#fff',
  },
  productPanelTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, flex: 1 },
  productPanelMeta: { fontWeight: '500', color: colors.textSecondary },
  productPanelBody: { padding: 12, borderTopWidth: 1, borderTopColor: colors.border },
  classesTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  classesHint: { fontSize: 12, color: colors.textSecondary, marginTop: 2, marginBottom: 10 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  checkLabel: { fontSize: 13, color: colors.textPrimary, flexShrink: 1 },
  bulkStrengthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    marginBottom: 10,
  },
  bulkLabel: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  bulkInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minWidth: 90,
    backgroundColor: '#fff',
    color: colors.textPrimary,
  },
  classGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  classCell: {
    width: '31%',
    marginBottom: 10,
  },
  classCheckRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  classLabel: { fontSize: 12, color: colors.textPrimary, fontWeight: '600' },
  classStrengthInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: '#fff',
    fontSize: 12,
    color: colors.textPrimary,
  },
  inputDisabled: {
    backgroundColor: '#E5E7EB',
    color: colors.textMuted,
  },
  validation: {
    color: '#C2410C',
    fontSize: 12,
    marginBottom: 8,
  },
  specsBlock: {
    marginTop: 8,
    marginBottom: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  specsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  specChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundMuted,
  },
  specChipOn: {
    borderColor: colors.info,
    backgroundColor: colors.infoLight,
  },
  specChipText: { fontSize: 12, color: colors.textPrimary },
  specChipTextOn: { color: colors.info, fontWeight: '600' },
  priceTotalRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    marginBottom: 8,
  },
  priceCol: { flex: 1 },
  totalBox: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: colors.backgroundMuted,
  },
  totalText: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  productFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cancelBtn: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#fff',
  },
  cancelText: { color: colors.textPrimary, fontWeight: '600' },
  doneBtn: {
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: colors.info,
  },
  doneText: { color: '#fff', fontWeight: '700' },
  detailsPreview: {
    marginTop: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#fff',
  },
  detailsPreviewTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 10,
  },
  detailsHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 8,
    marginBottom: 4,
    backgroundColor: colors.backgroundMuted,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 10,
  },
  detailsTotalRow: {
    borderBottomWidth: 0,
    marginTop: 4,
    backgroundColor: colors.backgroundMuted,
    borderRadius: 8,
    paddingHorizontal: 4,
  },
  dCell: { fontSize: 12, color: colors.textPrimary, paddingHorizontal: 6 },
  dHeader: { fontWeight: '700', color: colors.textSecondary, fontSize: 11 },
  dProduct: { width: 90 },
  dLevel: { width: 50, textAlign: 'center' },
  dClass: { width: 44, textAlign: 'center' },
  dCat: { width: 160, justifyContent: 'center' },
  dCatText: { fontSize: 12, color: colors.textPrimary },
  dSpecs: { width: 90 },
  dQty: { width: 90, textAlign: 'center' },
  dAction: { width: 70, textAlign: 'right' },
  dActionBtn: { width: 70, alignItems: 'center', justifyContent: 'center' },
  dTotalLabel: { fontWeight: '700' },
  dTotalValue: { fontWeight: '700' },
});
