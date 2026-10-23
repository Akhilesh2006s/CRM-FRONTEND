/**
 * Close Lead "Add Products & Details" dialog — mobile port of the web
 * components/leads/CloseLeadProductConfig.tsx. All state lives in the shared
 * useCloseLeadProductConfig hook so the rows sent to the backend equal the web's.
 */
import React, { useState, type ReactNode } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { colors } from '../../theme/colors';
import { WebButton, WebInput, WebLabel, WebSelect } from '../../ui/WebPrimitives';
import CheckRow from '../../components/leads/CheckRow';
import type { CloseLeadProductConfigApi } from '../../components/leads/useCloseLeadProductConfig';
import { CUSTOM_STREAM_SEPARATOR, isCustomStream, matchStream, streamLabel } from '../../lib/crm/iitStreams';
import {
  specsFromCatalog,
  getLineClassSelections,
  computeLineDisplayTotal,
  computeProductDetailsDisplayQuantity,
  computeProductDetailsDisplayTotal,
  lineHasValidClassSelections,
  isIitProduct,
  type IitAssignment,
} from '../../lib/crm/closeLeadProductConfig';

function sanitizeUnitPriceInput(raw: string): string {
  let value = String(raw || '').replace(/[^\d.]/g, '');
  const firstDot = value.indexOf('.');
  if (firstDot !== -1) {
    value = value.slice(0, firstDot + 1) + value.slice(firstDot + 1).replace(/\./g, '');
  }
  if (value.startsWith('.')) value = `0${value}`;
  if (value.includes('.')) {
    const [intPart, decPart = ''] = value.split('.');
    const cleanedInt = intPart.length > 1 ? intPart.replace(/^0+/, '') || '0' : intPart;
    value = `${cleanedInt}.${decPart}`;
  } else if (value.length > 1) {
    value = value.replace(/^0+/, '') || '0';
  }
  return value;
}

function parseUnitPriceInput(value: string): number {
  if (!value || value === '.') return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Same as the web number inputs: strip leading zeros, blank = 0. */
function parseIntInput(raw: string): number {
  let value = String(raw || '').replace(/[^\d]/g, '');
  if (value.length > 1) value = value.replace(/^0+/, '') || '0';
  return value === '' ? 0 : Number(value);
}

const money = (n: number) =>
  `₹${(Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export type CloseLeadProductsModalProps = {
  config: CloseLeadProductConfigApi;
  /** Extra content below the product rows (specimen copies, Abacus materials). */
  dialogExtra?: ReactNode;
  /** Products sent free as Training Material: tagged and left out of the total. */
  freeProducts?: string[];
};

export default function CloseLeadProductsModal({
  config: cfg,
  dialogExtra,
  freeProducts = [],
}: CloseLeadProductsModalProps) {
  const {
    productDialogOpen,
    setProductDialogOpen,
    productSections,
    expandedLineBySection,
    setExpandedLineBySection,
    childProductRows,
    showSpecsColumn,
    showSubjectsColumn,
    filteredProducts,
    catalogProducts,
    getProductLevels,
    getProductClasses,
    getProductSpecs,
    getProductSubjects,
    getProductStreamCombos,
    hasProductSubjects,
    getProductCategories,
    hasProductCategories,
    deliverablesByProduct,
    lineAllowsProductConfig,
    toggleLineClass,
    updateLineClassStrength,
    applyLineBulkStrength,
    setLineSameStrengthForAll,
    lineBulkStrengthValue,
    addEmptyProductSection,
    removeProductSection,
    addProductLineToSection,
    updateProductSectionLine,
    removeProductSectionLine,
    updateLineUnitPrice,
    updateLineClassPrice,
    updateProductDetail,
    removeProductDetail,
    commitProductSections,
  } = cfg;

  const isFreeProduct = (product?: string) => freeProducts.includes(String(product || ''));
  const [unitPriceDraftByLine, setUnitPriceDraftByLine] = useState<Record<string, string>>({});
  /** IIT rows where the BDE chose "Add other combination" (subjects picked by hand). */
  const [customStreamRows, setCustomStreamRows] = useState<Record<string, boolean>>({});
  /** Draft text for per-class rate inputs so decimals can be typed. */
  const [classPriceDraft, setClassPriceDraft] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);

  const handleUnitPriceChange = (sectionId: string, lineId: string, raw: string) => {
    const value = sanitizeUnitPriceInput(raw);
    setUnitPriceDraftByLine((prev) => ({ ...prev, [lineId]: value }));
    updateLineUnitPrice(sectionId, lineId, parseUnitPriceInput(value));
  };

  const onDone = () => {
    const committedRows = commitProductSections();
    if (!committedRows.some((row) => !row.isParentRow)) {
      setMessage('Select at least one product, class, and strength before continuing');
      return;
    }
    setMessage(null);
    setProductDialogOpen(false);
  };

  const loadingCatalog = cfg.catalogLoading;

  return (
    <Modal
      visible={productDialogOpen}
      animationType="slide"
      onRequestClose={() => setProductDialogOpen(false)}
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : undefined}
    >
      <View style={styles.root}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Add Products & Details</Text>
            <Text style={styles.subtitle}>
              Add a section, pick products, then set classes and strength per product. Only one product
              panel is open at a time. DC rows are generated per class for each product.
            </Text>
          </View>
          <TouchableOpacity onPress={() => setProductDialogOpen(false)} hitSlop={12}>
            <Text style={styles.close}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled">
          <View style={styles.sectionsBar}>
            <View style={{ flex: 1 }}>
              <Text style={styles.bold}>Sections</Text>
              <Text style={styles.muted}>
                Products are always edited inside a section. Use the catalog list under each section.
              </Text>
            </View>
            <TouchableOpacity style={styles.addSectionBtn} onPress={addEmptyProductSection}>
              <Text style={styles.addSectionText}>+ Add section</Text>
            </TouchableOpacity>
          </View>

          {loadingCatalog ? <ActivityIndicator color={colors.primary} style={{ marginVertical: 8 }} /> : null}
          {!loadingCatalog && catalogProducts.length === 0 ? (
            <Text style={styles.warnBox}>
              No products available in the database. Please contact admin to add products.
            </Text>
          ) : null}

          {productSections.length === 0 ? (
            <Text style={styles.infoBox}>
              No sections yet. Tap "Add section", choose products, then set classes and strength for each
              product.
            </Text>
          ) : (
            productSections.map((section, sectionIndex) => (
              <View key={section.id} style={styles.sectionCard}>
                <View style={styles.rowBetween}>
                  <Text style={styles.bold}>Section {sectionIndex + 1}</Text>
                  <TouchableOpacity onPress={() => removeProductSection(section.id)}>
                    <Text style={styles.danger}>✕ Remove section</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.smallLabel}>Add products to this section</Text>
                {filteredProducts.length === 0 ? (
                  <Text style={styles.muted}>No products in catalog.</Text>
                ) : (
                  <View style={styles.catalogGrid}>
                    {filteredProducts.map((product) => {
                      const lineForProduct = section.lines.find((l) => l.product === product);
                      return (
                        <CheckRow
                          key={`${section.id}-${product}`}
                          style={styles.catalogItem}
                          checked={Boolean(lineForProduct)}
                          label={product}
                          onChange={(checked) => {
                            if (checked) {
                              if (lineForProduct) {
                                setExpandedLineBySection((prev) => ({ ...prev, [section.id]: lineForProduct.id }));
                              } else {
                                addProductLineToSection(section.id, product);
                              }
                            } else if (lineForProduct) {
                              removeProductSectionLine(section.id, lineForProduct.id);
                            }
                          }}
                        />
                      );
                    })}
                  </View>
                )}

                {section.lines.length === 0 ? (
                  <Text style={styles.amber}>Select at least one product above to set classes and strength.</Text>
                ) : null}

                {section.lines.map((line) => {
                  const isOpen = expandedLineBySection[section.id] === line.id;
                  const lineClasses = getLineClassSelections(line, section);
                  const isIit = isIitProduct(line.product);
                  const streamCombos = isIit ? getProductStreamCombos(line.product) : [];
                  const classSummary = isIit
                    ? (line.iitAssignments || [])
                        .map(
                          (row) =>
                            `Cl ${row.class}${row.section && row.section !== 'ALL' ? row.section : ''} ${row.program} (${row.strength})`,
                        )
                        .join(', ') || 'No IIT assignments'
                    : lineClasses
                        .filter((s) => Number(s.strength) > 0)
                        .map((s) => `Cl ${s.class} (${s.strength})`)
                        .join(', ') || 'No classes selected';
                  const allowLineConfig = lineAllowsProductConfig(section, line);
                  const productSubjects = getProductSubjects(line.product);
                  const hasSubjects = hasProductSubjects(line.product);
                  const selectedSubjects = line.selectedSubjects || [];
                  const productSpecs = getProductSpecs(line.product);
                  const selectedSpecs = specsFromCatalog(productSpecs, line.selectedSpecs);
                  const productLevels = getProductLevels(line.product);
                  const selectedLevels = line.selectedLevels || [];
                  const productCategories = getProductCategories(line.product);
                  const selectedCategories = line.selectedCategories || [];
                  const lineTotalAmount = computeLineDisplayTotal(line, section);
                  const productDeliverables = deliverablesByProduct[line.product] || [];
                  const selectedDeliverables = line.selectedDeliverables || [];

                  const unitPriceBlock = (
                    <View style={styles.borderTop}>
                      <WebLabel>
                        {line.sameRateForAllClasses ? 'Unit Price *' : 'Default Unit Price (optional)'}
                      </WebLabel>
                      <View style={styles.rowGap}>
                        <WebInput
                          style={styles.flexInput}
                          keyboardType="decimal-pad"
                          placeholder="0"
                          value={
                            unitPriceDraftByLine[line.id] !== undefined
                              ? unitPriceDraftByLine[line.id]
                              : line.price
                                ? String(line.price)
                                : ''
                          }
                          onChangeText={(v) => handleUnitPriceChange(section.id, line.id, v)}
                        />
                        <View style={styles.totalPill}>
                          <Text style={styles.totalPillLabel}>Total</Text>
                          <Text style={styles.totalPillValue}>{money(lineTotalAmount)}</Text>
                        </View>
                      </View>
                    </View>
                  );

                  return (
                    <View key={line.id} style={styles.lineCard}>
                      <TouchableOpacity
                        style={styles.lineHeader}
                        onPress={() =>
                          setExpandedLineBySection((prev) => ({ ...prev, [section.id]: isOpen ? null : line.id }))
                        }
                      >
                        <Text style={styles.chevron}>{isOpen ? '▾' : '▸'}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.lineTitle}>{line.product}</Text>
                          <Text style={styles.muted} numberOfLines={2}>
                            {classSummary}
                          </Text>
                        </View>
                        <TouchableOpacity onPress={() => removeProductSectionLine(section.id, line.id)} hitSlop={8}>
                          <Text style={styles.danger}>✕ Remove</Text>
                        </TouchableOpacity>
                      </TouchableOpacity>

                      {isOpen ? (
                        <View style={styles.lineBody}>
                          {isIit ? (
                            <View>
                              <Text style={styles.smallLabel}>IIT school assignments *</Text>
                              <Text style={styles.muted}>
                                Add one row for each class and section. Leave section blank for the whole class.
                                Each row has its own agreed per-student rate.
                              </Text>
                              {(line.iitAssignments || []).map((row) => {
                                const change = (patch: Partial<IitAssignment>) =>
                                  updateProductSectionLine(section.id, line.id, {
                                    iitAssignments: (line.iitAssignments || []).map((item) =>
                                      item.id === row.id ? { ...item, ...patch } : item,
                                    ),
                                  });
                                const custom = customStreamRows[row.id] || isCustomStream(row.stream);
                                const matched = matchStream(row.stream, streamCombos);
                                const picked = custom
                                  ? String(row.stream || '')
                                      .split('+')
                                      .map((x) => x.trim())
                                      .filter(Boolean)
                                  : [];
                                const subjectChoices = productSubjects.length
                                  ? productSubjects
                                  : [...new Set(streamCombos.flatMap((c) => c.subjects))];
                                const classOptions = getProductClasses(line.product);
                                return (
                                  <View key={row.id} style={styles.iitRow}>
                                    <View style={styles.rowGap}>
                                      <View style={styles.half}>
                                        <WebSelect
                                          label="Class *"
                                          value={classOptions.includes(row.class) ? row.class : ''}
                                          onValueChange={(v) => change({ class: v })}
                                          items={classOptions.map((c) => ({ label: c, value: c }))}
                                          placeholder={row.class || 'Class'}
                                        />
                                      </View>
                                      <View style={styles.half}>
                                        <WebLabel>Section</WebLabel>
                                        <WebInput
                                          value={row.section === 'ALL' ? '' : row.section}
                                          onChangeText={(v) => change({ section: v.toUpperCase() })}
                                          placeholder="A / all"
                                          autoCapitalize="characters"
                                        />
                                      </View>
                                    </View>
                                    <WebLabel>Program *</WebLabel>
                                    <WebInput
                                      value={row.program}
                                      onChangeText={(v) => change({ program: v })}
                                      placeholder="Prime"
                                    />
                                    {productCategories.length > 0 ? (
                                      <View style={styles.chipRow}>
                                        {productCategories.map((category) => (
                                          <TouchableOpacity
                                            key={category}
                                            style={[styles.chip, row.program === category && styles.chipOn]}
                                            onPress={() => change({ program: category })}
                                          >
                                            <Text style={[styles.chipText, row.program === category && styles.chipTextOn]}>
                                              {category}
                                            </Text>
                                          </TouchableOpacity>
                                        ))}
                                      </View>
                                    ) : null}
                                    <WebSelect
                                      label="Stream *"
                                      value={custom ? '__other__' : matched || ''}
                                      onValueChange={(value) => {
                                        if (value === '__other__') {
                                          setCustomStreamRows((prev) => ({ ...prev, [row.id]: true }));
                                          change({ stream: '' });
                                        } else {
                                          setCustomStreamRows((prev) => ({ ...prev, [row.id]: false }));
                                          change({ stream: value });
                                        }
                                      }}
                                      items={[
                                        ...streamCombos.map((combo) => ({
                                          label: streamLabel(combo.name, streamCombos),
                                          value: combo.name,
                                        })),
                                        { label: '+ Add other combination', value: '__other__' },
                                      ]}
                                      placeholder="Select stream"
                                    />
                                    {custom ? (
                                      <View style={styles.subjectBox}>
                                        {subjectChoices.map((subject) => (
                                          <CheckRow
                                            key={subject}
                                            checked={picked.includes(subject)}
                                            label={subject}
                                            onChange={(checked) => {
                                              const next = subjectChoices.filter((s) =>
                                                s === subject ? checked : picked.includes(s),
                                              );
                                              change({ stream: next.join(CUSTOM_STREAM_SEPARATOR) });
                                            }}
                                          />
                                        ))}
                                        {subjectChoices.length === 0 ? (
                                          <Text style={styles.amber}>Add subjects to this product first.</Text>
                                        ) : null}
                                      </View>
                                    ) : null}
                                    {!custom && row.stream && !matched ? (
                                      <Text style={styles.errorText}>
                                        "{row.stream}" is not in this product's streams. Select one.
                                      </Text>
                                    ) : null}
                                    <View style={[styles.rowGap, { marginTop: 8 }]}>
                                      <View style={styles.half}>
                                        <WebLabel>Students *</WebLabel>
                                        <WebInput
                                          keyboardType="number-pad"
                                          value={row.strength ? String(row.strength) : ''}
                                          onChangeText={(v) => change({ strength: parseIntInput(v) })}
                                        />
                                      </View>
                                      <View style={styles.half}>
                                        <WebLabel>Rate / student ₹ *</WebLabel>
                                        <WebInput
                                          keyboardType="decimal-pad"
                                          value={
                                            classPriceDraft[`iit_${row.id}`] ?? (row.unitPrice ? String(row.unitPrice) : '')
                                          }
                                          onChangeText={(v) => {
                                            const clean = sanitizeUnitPriceInput(v);
                                            setClassPriceDraft((p) => ({ ...p, [`iit_${row.id}`]: clean }));
                                            change({ unitPrice: parseUnitPriceInput(clean) });
                                          }}
                                        />
                                      </View>
                                    </View>
                                    <View style={styles.rowBetween}>
                                      <Text style={styles.muted}>
                                        Amount: ₹{(Number(row.strength) * Number(row.unitPrice) || 0).toLocaleString('en-IN')}
                                      </Text>
                                      <TouchableOpacity
                                        onPress={() =>
                                          updateProductSectionLine(section.id, line.id, {
                                            iitAssignments: (line.iitAssignments || []).filter((item) => item.id !== row.id),
                                          })
                                        }
                                      >
                                        <Text style={styles.danger}>Remove</Text>
                                      </TouchableOpacity>
                                    </View>
                                  </View>
                                );
                              })}
                              <TouchableOpacity
                                style={styles.outlineBtn}
                                onPress={() =>
                                  updateProductSectionLine(section.id, line.id, {
                                    iitAssignments: [
                                      ...(line.iitAssignments || []),
                                      {
                                        id: `${Date.now()}_${Math.random()}`,
                                        class: '',
                                        section: '',
                                        program: '',
                                        stream: '',
                                        strength: 0,
                                        unitPrice: 0,
                                      },
                                    ],
                                  })
                                }
                              >
                                <Text style={styles.outlineBtnText}>+ Add IIT assignment</Text>
                              </TouchableOpacity>
                              <Text style={styles.bold}>IIT total: {money(lineTotalAmount)}</Text>
                            </View>
                          ) : (
                            <View>
                              <Text style={styles.smallLabel}>Classes for {line.product} *</Text>
                              <Text style={styles.muted}>Strength per class applies only to this product.</Text>
                              <CheckRow
                                checked={Boolean(line.sameStrengthForAllClasses)}
                                label="Same strength for all selected classes"
                                onChange={(c) => setLineSameStrengthForAll(section.id, line.id, c)}
                              />
                              {line.sameStrengthForAllClasses ? (
                                <View style={styles.rowGap}>
                                  <Text style={[styles.muted, { alignSelf: 'center' }]}>Strength for all:</Text>
                                  <WebInput
                                    style={styles.smallInput}
                                    keyboardType="number-pad"
                                    placeholder="Qty"
                                    value={lineBulkStrengthValue(line)}
                                    onChangeText={(v) => applyLineBulkStrength(section.id, line.id, parseIntInput(v))}
                                  />
                                </View>
                              ) : null}
                              {getProductClasses(line.product).map((cls) => {
                                const sel = lineClasses.find((s) => s.class === cls);
                                const checked = Boolean(sel);
                                const draftKey = `${line.id}_${cls}`;
                                return (
                                  <View key={`${line.id}-cls-${cls}`} style={styles.classRow}>
                                    <CheckRow
                                      style={styles.classCheck}
                                      checked={checked}
                                      label={`Class ${cls}`}
                                      onChange={(c) => toggleLineClass(section.id, line.id, cls, c)}
                                    />
                                    <WebInput
                                      style={[styles.classInput, !checked && styles.disabledInput]}
                                      editable={checked}
                                      keyboardType="number-pad"
                                      placeholder="Strength"
                                      value={checked ? (sel?.strength ? String(sel.strength) : '') : ''}
                                      onChangeText={(v) => updateLineClassStrength(section.id, line.id, cls, parseIntInput(v))}
                                    />
                                    {!line.sameRateForAllClasses && checked ? (
                                      <WebInput
                                        style={styles.classInput}
                                        keyboardType="decimal-pad"
                                        placeholder="Rate ₹"
                                        value={
                                          classPriceDraft[draftKey] ??
                                          String(line.priceByClass?.[cls] ?? line.price ?? '')
                                        }
                                        onChangeText={(v) => {
                                          const clean = sanitizeUnitPriceInput(v);
                                          setClassPriceDraft((p) => ({ ...p, [draftKey]: clean }));
                                          updateLineClassPrice(section.id, line.id, cls, parseUnitPriceInput(clean));
                                        }}
                                      />
                                    ) : null}
                                  </View>
                                );
                              })}
                              {!lineHasValidClassSelections(line, section) ? (
                                <Text style={styles.amber}>Select at least one class with strength greater than 0.</Text>
                              ) : null}
                            </View>
                          )}

                          {!isIit && productSpecs.length > 0 ? (
                            <View style={styles.borderTop}>
                              <Text style={styles.smallLabel}>Select Specs:</Text>
                              <View style={styles.wrapRow}>
                                {productSpecs.map((spec) => (
                                  <CheckRow
                                    key={spec}
                                    checked={selectedSpecs.some((item) => item.toLowerCase() === spec.toLowerCase())}
                                    label={spec}
                                    onChange={(checked) => {
                                      const next = checked
                                        ? [...selectedSpecs, spec]
                                        : selectedSpecs.filter((item) => item.toLowerCase() !== spec.toLowerCase());
                                      if (next.length === 0) {
                                        setMessage('Select at least one spec');
                                        return;
                                      }
                                      updateProductSectionLine(section.id, line.id, {
                                        selectedSpecs: next,
                                        specsTouched: true,
                                      });
                                    }}
                                  />
                                ))}
                              </View>
                            </View>
                          ) : null}

                          {!isIit && productLevels.length > 0 ? (
                            <View style={styles.borderTop}>
                              <Text style={styles.smallLabel}>Select Term / Level:</Text>
                              <View style={styles.wrapRow}>
                                {productLevels.map((lvl) => (
                                  <CheckRow
                                    key={lvl}
                                    checked={selectedLevels.includes(lvl)}
                                    label={lvl}
                                    onChange={(checked) => {
                                      const newLevels = checked
                                        ? [...selectedLevels, lvl]
                                        : selectedLevels.filter((l) => l !== lvl);
                                      if (newLevels.length === 0) {
                                        setMessage('Select at least one level');
                                        return;
                                      }
                                      updateProductSectionLine(section.id, line.id, {
                                        selectedLevels: newLevels,
                                        level: newLevels[0],
                                        dispatchMode:
                                          newLevels.length > 1
                                            ? selectedLevels.length > 1
                                              ? line.dispatchMode
                                              : undefined
                                            : 'one_level_at_a_time',
                                      });
                                    }}
                                  />
                                ))}
                              </View>
                              {selectedLevels.length === 0 ? (
                                <Text style={styles.amber}>Select at least one level to generate product rows.</Text>
                              ) : null}
                              {selectedLevels.length > 1 ? (
                                <View style={{ marginTop: 8 }}>
                                  <WebSelect
                                    label="Dispatch levels *"
                                    value={line.dispatchMode || ''}
                                    onValueChange={(value) =>
                                      updateProductSectionLine(section.id, line.id, {
                                        dispatchMode: (value || undefined) as
                                          | 'one_level_at_a_time'
                                          | 'both_levels_together'
                                          | undefined,
                                      })
                                    }
                                    items={[
                                      { label: 'Term 1 only', value: 'one_level_at_a_time' },
                                      { label: 'Both Terms Together', value: 'both_levels_together' },
                                    ]}
                                    placeholder="Select dispatch plan"
                                  />
                                  <Text style={styles.muted}>
                                    Term 1 only keeps the next level in Term-Wise DC. Both Terms Together creates one
                                    current DC.
                                  </Text>
                                </View>
                              ) : null}
                            </View>
                          ) : null}

                          {!isIit ? (
                            <View style={styles.borderTop}>
                              <CheckRow
                                checked={line.sameRateForAllClasses || false}
                                label="Same rate for all classes (this level)"
                                onChange={(checked) =>
                                  updateProductSectionLine(section.id, line.id, { sameRateForAllClasses: checked })
                                }
                              />
                            </View>
                          ) : null}

                          {!isIit && (productSpecs.length === 0 || allowLineConfig) ? unitPriceBlock : null}

                          {productDeliverables.length > 0 ? (
                            <View style={styles.borderTop}>
                              <Text style={styles.smallLabel}>Select Deliverables:</Text>
                              <View style={styles.wrapRow}>
                                {productDeliverables.map((deliverable) => (
                                  <CheckRow
                                    key={deliverable}
                                    checked={selectedDeliverables.includes(deliverable)}
                                    label={deliverable}
                                    onChange={(checked) =>
                                      updateProductSectionLine(section.id, line.id, {
                                        selectedDeliverables: checked
                                          ? [...selectedDeliverables, deliverable]
                                          : selectedDeliverables.filter((d) => d !== deliverable),
                                      })
                                    }
                                  />
                                ))}
                              </View>
                            </View>
                          ) : null}

                          {!isIit && hasSubjects && productSubjects.length > 0 ? (
                            <View style={styles.borderTop}>
                              <Text style={styles.smallLabel}>Select Deliverables:</Text>
                              <View style={styles.wrapRow}>
                                {productSubjects.map((subject) => (
                                  <CheckRow
                                    key={subject}
                                    checked={selectedSubjects.includes(subject)}
                                    label={subject}
                                    onChange={(checked) =>
                                      updateProductSectionLine(section.id, line.id, {
                                        selectedSubjects: checked
                                          ? [...selectedSubjects, subject]
                                          : selectedSubjects.filter((s) => s !== subject),
                                      })
                                    }
                                  />
                                ))}
                              </View>
                            </View>
                          ) : null}

                          {!isIit && hasProductCategories(line.product) && productCategories.length > 0 ? (
                            <View style={styles.borderTop}>
                              <Text style={styles.smallLabel}>Select Series:</Text>
                              <View style={styles.wrapRow}>
                                {productCategories.map((category) => (
                                  <CheckRow
                                    key={category}
                                    checked={selectedCategories.includes(category)}
                                    label={category}
                                    onChange={(checked) =>
                                      updateProductSectionLine(section.id, line.id, {
                                        selectedCategories: checked
                                          ? [...selectedCategories, category]
                                          : selectedCategories.filter((c) => c !== category),
                                      })
                                    }
                                  />
                                ))}
                              </View>
                            </View>
                          ) : null}
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            ))
          )}

          {childProductRows.length > 0 ? (
            <View style={{ marginTop: 12 }}>
              <Text style={styles.bold}>Product Details</Text>
              {childProductRows.map((pd) => {
                const iit = isIitProduct(pd.product);
                const where = `Class ${pd.class}${pd.section && pd.section !== 'ALL' ? ` ${pd.section}` : ''}${pd.stream ? ` · ${pd.stream}` : ''}`;
                return (
                  <View key={pd.id} style={styles.detailCard}>
                    <View style={styles.rowBetween}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.lineTitle}>{pd.product}</Text>
                        {isFreeProduct(pd.product) ? (
                          <Text style={styles.amber}>Training Material · free</Text>
                        ) : null}
                        <Text style={styles.muted}>
                          {where}
                          {getProductLevels(pd.product).length > 0 ? ` · ${pd.level || '-'}` : ''}
                          {showSpecsColumn && pd.specs ? ` · ${pd.specs}` : ''}
                          {showSubjectsColumn ? ` · ${pd.subject || '-'}` : ''}
                        </Text>
                      </View>
                      <TouchableOpacity onPress={() => removeProductDetail(pd.id)} hitSlop={8}>
                        <Text style={styles.danger}>✕</Text>
                      </TouchableOpacity>
                    </View>
                    {iit ? (
                      <Text style={styles.muted}>Program: {pd.program || '-'}</Text>
                    ) : hasProductCategories(pd.product) ? (
                      <WebSelect
                        label="Series"
                        value={(pd.productCategory || pd.category || '').trim()}
                        onValueChange={(v) => v && updateProductDetail(pd.id, 'category', v)}
                        items={getProductCategories(pd.product).map((c) => ({ label: c, value: c }))}
                      />
                    ) : null}
                    <View style={styles.rowGap}>
                      <Text style={[styles.muted, { alignSelf: 'center' }]}>Quantity (Strength) *</Text>
                      {iit ? (
                        <Text style={styles.bold}>{pd.strength}</Text>
                      ) : (
                        <WebInput
                          style={styles.smallInput}
                          keyboardType="number-pad"
                          placeholder="0"
                          value={pd.strength ? String(pd.strength) : ''}
                          onChangeText={(v) => updateProductDetail(pd.id, 'strength', parseIntInput(v))}
                        />
                      )}
                    </View>
                  </View>
                );
              })}
              <View style={styles.totalRow}>
                <Text style={styles.bold}>Total qty: {computeProductDetailsDisplayQuantity(childProductRows)}</Text>
                <Text style={styles.bold}>
                  {money(
                    computeProductDetailsDisplayTotal(
                      childProductRows.filter((row) => !isFreeProduct(row.product)),
                      cfg.groupProductOpts,
                    ),
                  )}
                </Text>
              </View>
            </View>
          ) : null}

          {dialogExtra}
        </ScrollView>

        {message ? <Text style={styles.footerError}>{message}</Text> : null}
        <View style={styles.footer}>
          <View style={{ flex: 1 }}>
            <WebButton title="Cancel" variant="outline" onPress={() => setProductDialogOpen(false)} />
          </View>
          <View style={{ flex: 1 }}>
            <WebButton title="Done" onPress={onDone} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 20 : 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: '#fff',
  },
  title: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  subtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
  close: { fontSize: 22, color: colors.textSecondary },
  body: { flex: 1 },
  bodyContent: { padding: 16, paddingBottom: 40 },
  sectionsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    backgroundColor: colors.backgroundMuted,
    marginBottom: 12,
  },
  addSectionBtn: { backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  addSectionText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  bold: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  muted: { fontSize: 12, color: colors.textSecondary },
  smallLabel: { fontSize: 12, fontWeight: '700', color: colors.textPrimary, marginTop: 8, marginBottom: 4 },
  amber: { fontSize: 12, color: '#B45309', marginTop: 4 },
  errorText: { fontSize: 12, color: colors.error, marginTop: 4 },
  danger: { color: colors.error, fontSize: 13, fontWeight: '600' },
  warnBox: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: colors.warningLight,
    color: '#854D0E',
    fontSize: 13,
    marginBottom: 12,
  },
  infoBox: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: colors.backgroundMuted,
    color: colors.textSecondary,
    fontSize: 13,
  },
  sectionCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#fff',
    marginBottom: 12,
  },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rowGap: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 8 },
  catalogGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 8,
    backgroundColor: colors.backgroundMuted,
    marginBottom: 8,
  },
  catalogItem: { width: '50%' },
  lineCard: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, marginTop: 8, overflow: 'hidden' },
  lineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    backgroundColor: colors.backgroundMuted,
  },
  chevron: { fontSize: 16, color: colors.textSecondary },
  lineTitle: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  lineBody: { padding: 10, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: '#fff' },
  borderTop: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: 8, paddingTop: 8 },
  flexInput: { flex: 1, marginBottom: 0 },
  smallInput: { width: 110, marginBottom: 0 },
  totalPill: {
    backgroundColor: colors.backgroundMuted,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    justifyContent: 'center',
  },
  totalPillLabel: { fontSize: 11, color: colors.textSecondary },
  totalPillValue: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  classRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 4,
    marginTop: 6,
    backgroundColor: colors.backgroundMuted,
  },
  classCheck: { width: 92 },
  classInput: { flex: 1, marginBottom: 0, paddingVertical: 6 },
  disabledInput: { backgroundColor: colors.backgroundMuted },
  iitRow: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 8, marginTop: 8 },
  half: { flex: 1 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: -6, marginBottom: 8 },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4 },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 12, color: colors.textPrimary },
  chipTextOn: { color: '#fff' },
  subjectBox: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    padding: 6,
    marginTop: 4,
    backgroundColor: colors.backgroundMuted,
  },
  outlineBtn: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    marginVertical: 8,
  },
  outlineBtnText: { color: colors.primary, fontWeight: '600' },
  detailCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
    backgroundColor: '#fff',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 10,
    marginTop: 8,
    borderRadius: 8,
    backgroundColor: colors.tableHeader,
  },
  footerError: { color: colors.error, fontSize: 13, paddingHorizontal: 16, paddingTop: 8, backgroundColor: '#fff' },
  footer: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: '#fff',
  },
});
