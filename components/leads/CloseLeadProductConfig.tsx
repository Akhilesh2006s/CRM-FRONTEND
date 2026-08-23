'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Package, PlusCircle, X, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import {
  SELECTABLE_CLOSE_CLASSES,
  getLineClassSelections,
  computeLineDisplayTotal,
  computeProductDetailsDisplayQuantity,
  computeProductDetailsDisplayTotal,
  lineHasValidClassSelections,
  type ProductDetailRow,
  type CloseProductSection,
} from '@/lib/closeLeadProductConfig'
import {
  useCloseLeadProductConfig,
  type CloseLeadProductConfigApi,
} from '@/hooks/useCloseLeadProductConfig'

const UNIT_PRICE_INPUT_CLASS =
  'h-8 w-28 [appearance:textfield] [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-inner-spin-button]:m-0'

function sanitizeUnitPriceInput(raw: string): string {
  let value = String(raw || '').replace(/[^\d.]/g, '')
  const firstDot = value.indexOf('.')
  if (firstDot !== -1) {
    value = value.slice(0, firstDot + 1) + value.slice(firstDot + 1).replace(/\./g, '')
  }
  if (value.startsWith('.')) value = `0${value}`
  if (value.includes('.')) {
    const [intPart, decPart = ''] = value.split('.')
    const cleanedInt = intPart.length > 1 ? intPart.replace(/^0+/, '') || '0' : intPart
    value = `${cleanedInt}.${decPart}`
  } else if (value.length > 1) {
    value = value.replace(/^0+/, '') || '0'
  }
  return value
}

function parseUnitPriceInput(value: string): number {
  if (!value || value === '.') return 0
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

export type CloseLeadProductConfigProps = {
  schoolType?: string
  /** Controlled mode: pass hook return from parent (Close Lead). */
  config?: CloseLeadProductConfigApi
  onChange?: (details: ProductDetailRow[], sections: CloseProductSection[]) => void
  onReady?: (api: CloseLeadProductConfigApi) => void
  /** Hide the ADD PRODUCTS trigger button (dialog can still be opened via config). */
  hideTrigger?: boolean
  className?: string
}

function CloseLeadProductConfigView({
  cfg,
  onChange,
  onReady,
  hideTrigger = false,
  className,
}: {
  cfg: CloseLeadProductConfigApi
  onChange?: (details: ProductDetailRow[], sections: CloseProductSection[]) => void
  onReady?: (api: CloseLeadProductConfigApi) => void
  hideTrigger?: boolean
  className?: string
}) {
  useEffect(() => {
    onReady?.(cfg)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    onChange?.(cfg.productDetails, cfg.productSections)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg.productDetails, cfg.productSections])

  const {
    productDialogOpen,
    setProductDialogOpen,
    productDetails,
    productSections,
    expandedLineBySection,
    setExpandedLineBySection,
    childProductRows,
    showSpecsColumn,
    showSubjectsColumn,
    filteredProducts,
    getProductLevels,
    getProductSpecs,
    getProductSubjects,
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
    updateProductDetail,
    removeProductDetail,
  } = cfg

  const [unitPriceDraftByLine, setUnitPriceDraftByLine] = useState<Record<string, string>>({})

  const handleUnitPriceChange = (sectionId: string, lineId: string, raw: string) => {
    const value = sanitizeUnitPriceInput(raw)
    setUnitPriceDraftByLine((prev) => ({ ...prev, [lineId]: value }))
    updateLineUnitPrice(sectionId, lineId, parseUnitPriceInput(value))
  }

  return (
    <div className={className}>
      {!hideTrigger && (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => setProductDialogOpen(true)}
        >
          <Package className="w-4 h-4 mr-2" />
          ADD PRODUCTS{' '}
          {productDetails.filter((pd) => !pd.isParentRow).length > 0 &&
            `(${productDetails.filter((pd) => !pd.isParentRow).length})`}
        </Button>
      )}

      <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
        <DialogContent className="sm:max-w-[95vw] lg:max-w-[1200px] max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Products & Details</DialogTitle>
            <DialogDescription>
              Add a section, pick products, then set classes and strength per product. Only one
              product panel is open at a time. DC rows are generated per class for each product.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border rounded p-3 bg-neutral-50">
              <div>
                <Label className="text-sm font-semibold">Sections</Label>
                <p className="text-xs text-neutral-500 mt-1">
                  Products are always edited inside a section. Use the catalog buttons under each
                  section.
                </p>
              </div>
              <Button type="button" size="sm" onClick={addEmptyProductSection}>
                <PlusCircle className="w-4 h-4 mr-1" />
                Add section
              </Button>
            </div>

            {filteredProducts.length === 0 && (
              <div className="p-4 border rounded bg-yellow-50 text-yellow-800 text-sm">
                No products available in the database. Please contact admin to add products.
              </div>
            )}

            {productSections.length === 0 ? (
              <div className="p-4 border rounded bg-neutral-50 text-sm text-neutral-600">
                No sections yet. Click &quot;Add section&quot;, choose products, then set classes and
                strength for each product.
              </div>
            ) : (
              <div className="space-y-4">
                {productSections.map((section) => {
                  return (
                    <div key={section.id} className="border rounded p-4 space-y-3 bg-white">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Label className="text-sm font-semibold">Section</Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeProductSection(section.id)}
                          className="text-red-600 shrink-0"
                        >
                          <X className="w-4 h-4 mr-1" />
                          Remove section
                        </Button>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-semibold">Add products to this section</Label>
                        {filteredProducts.length === 0 ? (
                          <p className="text-xs text-neutral-500">No products in catalog.</p>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[140px] overflow-y-auto border rounded p-3 bg-neutral-50/80">
                            {filteredProducts.map((product) => {
                              const lineForProduct = section.lines.find((l) => l.product === product)
                              const isSelected = Boolean(lineForProduct)
                              const checkboxId = `catalog-${section.id}-${product.replace(/\s+/g, '-')}`
                              return (
                                <div
                                  key={`${section.id}-${product}`}
                                  className="flex items-center gap-2 min-w-0"
                                >
                                  <Checkbox
                                    className="border-neutral-400"
                                    id={checkboxId}
                                    checked={isSelected}
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        if (lineForProduct) {
                                          setExpandedLineBySection((prev) => ({
                                            ...prev,
                                            [section.id]: lineForProduct.id,
                                          }))
                                        } else {
                                          addProductLineToSection(section.id, product)
                                        }
                                      } else if (lineForProduct) {
                                        removeProductSectionLine(section.id, lineForProduct.id)
                                      }
                                    }}
                                  />
                                  <Label
                                    htmlFor={checkboxId}
                                    className="text-xs cursor-pointer font-normal truncate"
                                  >
                                    {product}
                                  </Label>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>

                      {section.lines.length === 0 && (
                        <p className="text-xs text-amber-700">
                          Select at least one product above to set classes and strength.
                        </p>
                      )}

                      {section.lines.map((line) => {
                        const isOpen = expandedLineBySection[section.id] === line.id
                        const lineClasses = getLineClassSelections(line, section)
                        const classSummary =
                          lineClasses
                            .filter((s) => Number(s.strength) > 0)
                            .map((s) => `Cl ${s.class} (${s.strength})`)
                            .join(', ') || 'No classes selected'
                        const allowLineConfig = lineAllowsProductConfig(section, line)
                        const productSubjects = getProductSubjects(line.product)
                        const hasSubjects = hasProductSubjects(line.product)
                        const selectedSubjects = line.selectedSubjects || []
                        const productSpecs = getProductSpecs(line.product)
                        const selectedSpecs = line.selectedSpecs || []
                        const productLevels = getProductLevels(line.product)
                        const selectedLevels = line.selectedLevels || []
                        // Display total = Σ (class strength × selected subjects × unit price).
                        const lineTotalAmount = computeLineDisplayTotal(line, section)

                        return (
                          <Collapsible
                            key={line.id}
                            open={isOpen}
                            onOpenChange={(open) =>
                              setExpandedLineBySection((prev) => ({
                                ...prev,
                                [section.id]: open ? line.id : null,
                              }))
                            }
                            className="border rounded overflow-hidden"
                          >
                            <CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-2.5 bg-neutral-50 hover:bg-neutral-100 text-left">
                              <ChevronDown
                                className={`h-4 w-4 shrink-0 text-neutral-600 transition-transform ${
                                  isOpen ? 'rotate-180' : ''
                                }`}
                              />
                              <span className="font-medium text-sm">{line.product}</span>
                              <span className="text-xs text-neutral-500 truncate flex-1">
                                {classSummary}
                              </span>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="space-y-3 p-3 border-t bg-white">
                              <div className="space-y-2">
                                <Label className="text-xs font-semibold">
                                  Classes for {line.product} *
                                </Label>
                                <p className="text-xs text-neutral-500">
                                  Strength per class applies only to this product.
                                </p>
                                <div className="flex flex-wrap items-center gap-3 py-1">
                                  <Checkbox
                                    className="border-neutral-400"
                                    id={`line-${line.id}-same-strength`}
                                    checked={Boolean(line.sameStrengthForAllClasses)}
                                    onCheckedChange={(c) =>
                                      setLineSameStrengthForAll(section.id, line.id, c === true)
                                    }
                                  />
                                  <Label
                                    htmlFor={`line-${line.id}-same-strength`}
                                    className="text-xs font-medium cursor-pointer"
                                  >
                                    Same strength for all selected classes
                                  </Label>
                                  {line.sameStrengthForAllClasses && (
                                    <div className="flex items-center gap-2">
                                      <Label className="text-xs text-neutral-600 shrink-0">
                                        Strength for all:
                                      </Label>
                                      <Input
                                        type="number"
                                        min={1}
                                        className="h-8 w-28"
                                        placeholder="Qty"
                                        value={lineBulkStrengthValue(line)}
                                        onChange={(e) => {
                                          let value = e.target.value
                                          if (value.length > 1) {
                                            value = value.replace(/^0+/, '') || '0'
                                          }
                                          const num = value === '' ? 0 : Number(value)
                                          applyLineBulkStrength(section.id, line.id, num)
                                        }}
                                      />
                                    </div>
                                  )}
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                  {SELECTABLE_CLOSE_CLASSES.map((cls) => {
                                    const sel = lineClasses.find((s) => s.class === cls)
                                    const checked = Boolean(sel)
                                    return (
                                      <div
                                        key={`${line.id}-cls-${cls}`}
                                        className="flex items-center gap-2 rounded border border-neutral-200 bg-neutral-50/80 px-2 py-1.5"
                                      >
                                        <Checkbox
                                          className="border-neutral-400"
                                          id={`line-${line.id}-class-${cls}`}
                                          checked={checked}
                                          onCheckedChange={(c) =>
                                            toggleLineClass(section.id, line.id, cls, c === true)
                                          }
                                        />
                                        <Label
                                          htmlFor={`line-${line.id}-class-${cls}`}
                                          className="text-xs font-medium cursor-pointer shrink-0 w-14"
                                        >
                                          Class {cls}
                                        </Label>
                                        <Input
                                          type="number"
                                          min={1}
                                          className="h-8 flex-1 min-w-[4rem]"
                                          disabled={!checked}
                                          placeholder="Strength"
                                          value={checked ? sel?.strength || '' : ''}
                                          onChange={(e) => {
                                            let value = e.target.value
                                            if (value.length > 1)
                                              value = value.replace(/^0+/, '') || '0'
                                            const num = value === '' ? 0 : Number(value)
                                            updateLineClassStrength(section.id, line.id, cls, num)
                                          }}
                                        />
                                      </div>
                                    )
                                  })}
                                </div>
                                {!lineHasValidClassSelections(line, section) && (
                                  <p className="text-xs text-amber-700">
                                    Select at least one class with strength greater than 0.
                                  </p>
                                )}
                              </div>

                              {productLevels.length > 0 && (
                                <div className="space-y-2 border-t pt-2">
                                  <Label className="text-xs font-semibold">Select Levels:</Label>
                                  <div className="flex flex-wrap gap-2">
                                    {productLevels.map((lvl) => (
                                      <div key={lvl} className="flex items-center space-x-1">
                                        <Checkbox
                                          className="border-neutral-400"
                                          id={`level-${line.id}-${lvl}`}
                                          checked={selectedLevels.includes(lvl)}
                                          onCheckedChange={(checked) => {
                                            const newLevels = checked
                                              ? [...selectedLevels, lvl]
                                              : selectedLevels.filter((l) => l !== lvl)
                                            if (newLevels.length === 0) {
                                              toast.error('Select at least one level')
                                              return
                                            }
                                            updateProductSectionLine(section.id, line.id, {
                                              selectedLevels: newLevels,
                                              level: newLevels[0],
                                            })
                                          }}
                                        />
                                        <Label
                                          htmlFor={`level-${line.id}-${lvl}`}
                                          className="text-xs cursor-pointer"
                                        >
                                          {lvl}
                                        </Label>
                                      </div>
                                    ))}
                                  </div>
                                  {selectedLevels.length === 0 && (
                                    <p className="text-xs text-amber-700">
                                      Select at least one level to generate product rows.
                                    </p>
                                  )}
                                </div>
                              )}

                              <div className="flex flex-wrap items-center gap-3 justify-between border-t pt-2">
                                <div className="flex items-center gap-2">
                                  <Checkbox
                                    className="border-neutral-400"
                                    id={`same-rate-${line.id}`}
                                    checked={line.sameRateForAllClasses || false}
                                    onCheckedChange={(checked) =>
                                      updateProductSectionLine(section.id, line.id, {
                                        sameRateForAllClasses: !!checked,
                                      })
                                    }
                                  />
                                  <Label
                                    htmlFor={`same-rate-${line.id}`}
                                    className="text-xs cursor-pointer"
                                  >
                                    Same rate for all classes (this level)
                                  </Label>
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeProductSectionLine(section.id, line.id)}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <X className="w-4 h-4 mr-1" />
                                  Remove product
                                </Button>
                              </div>

                              {allowLineConfig && productSpecs.length > 0 && (
                                <div className="mt-2 pt-2 border-t">
                                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                                    <div>
                                      <Label className="text-xs font-semibold mb-2 block">
                                        Select Specs:
                                      </Label>
                                      <div className="flex flex-wrap gap-2">
                                        {productSpecs.map((spec) => (
                                          <div key={spec} className="flex items-center space-x-1">
                                            <Checkbox
                                              className="border-neutral-400"
                                              id={`spec-${line.id}-${spec}`}
                                              checked={selectedSpecs.includes(spec)}
                                              onCheckedChange={(checked) => {
                                                const newSpecs = checked
                                                  ? [spec]
                                                  : selectedSpecs.length > 0
                                                    ? selectedSpecs
                                                    : [spec]
                                                updateProductSectionLine(section.id, line.id, {
                                                  selectedSpecs: newSpecs,
                                                })
                                              }}
                                            />
                                            <Label
                                              htmlFor={`spec-${line.id}-${spec}`}
                                              className="text-xs cursor-pointer"
                                            >
                                              {spec}
                                            </Label>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                    <div className="flex flex-col md:flex-row gap-3 md:items-end">
                                      <div>
                                        <Label className="text-xs font-semibold mb-1 block">
                                          Unit Price *
                                        </Label>
                                        <Input
                                          type="text"
                                          inputMode="decimal"
                                          autoComplete="off"
                                          value={
                                            unitPriceDraftByLine[line.id] !== undefined
                                              ? unitPriceDraftByLine[line.id]
                                              : line.price
                                                ? String(line.price)
                                                : ''
                                          }
                                          onChange={(e) =>
                                            handleUnitPriceChange(
                                              section.id,
                                              line.id,
                                              e.target.value
                                            )
                                          }
                                          className={UNIT_PRICE_INPUT_CLASS}
                                          placeholder="0"
                                          required
                                        />
                                      </div>
                                      <div>
                                        <Label className="text-xs font-semibold mb-1 block">
                                          Total
                                        </Label>
                                        <Input
                                          type="text"
                                          value={`₹${lineTotalAmount.toLocaleString('en-IN', {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                          })}`}
                                          readOnly
                                          className="h-8 w-32 bg-neutral-50"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {productSpecs.length === 0 && (
                                <div className="mt-2 pt-2 border-t flex flex-col md:flex-row gap-3 md:items-end">
                                  <div>
                                    <Label className="text-xs font-semibold mb-1 block">
                                      Unit Price *
                                    </Label>
                                    <Input
                                      type="text"
                                      inputMode="decimal"
                                      autoComplete="off"
                                      value={
                                        unitPriceDraftByLine[line.id] !== undefined
                                          ? unitPriceDraftByLine[line.id]
                                          : line.price
                                            ? String(line.price)
                                            : ''
                                      }
                                      onChange={(e) =>
                                        handleUnitPriceChange(section.id, line.id, e.target.value)
                                      }
                                      className={UNIT_PRICE_INPUT_CLASS}
                                      placeholder="0"
                                      required
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-xs font-semibold mb-1 block">Total</Label>
                                    <Input
                                      type="text"
                                      value={`₹${lineTotalAmount.toLocaleString('en-IN', {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      })}`}
                                      readOnly
                                      className="h-8 w-32 bg-neutral-50"
                                    />
                                  </div>
                                </div>
                              )}

                              {(() => {
                                const productDeliverables =
                                  deliverablesByProduct[line.product] || []
                                const selectedDeliverables = line.selectedDeliverables || []
                                if (productDeliverables.length === 0) return null
                                return (
                                  <div className="mt-2 pt-2 border-t">
                                    <Label className="text-xs font-semibold mb-2 block">
                                      Select Deliverables:
                                    </Label>
                                    <div className="flex flex-wrap gap-2">
                                      {productDeliverables.map((deliverable) => (
                                        <div
                                          key={deliverable}
                                          className="flex items-center space-x-1"
                                        >
                                          <Checkbox
                                            className="border-neutral-400"
                                            id={`deliverable-${line.id}-${deliverable}`}
                                            checked={selectedDeliverables.includes(deliverable)}
                                            onCheckedChange={(checked) => {
                                              const newDeliverables = checked
                                                ? [...selectedDeliverables, deliverable]
                                                : selectedDeliverables.filter(
                                                    (d) => d !== deliverable
                                                  )
                                              updateProductSectionLine(section.id, line.id, {
                                                selectedDeliverables: newDeliverables,
                                              })
                                            }}
                                          />
                                          <Label
                                            htmlFor={`deliverable-${line.id}-${deliverable}`}
                                            className="text-xs cursor-pointer"
                                          >
                                            {deliverable}
                                          </Label>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )
                              })()}

                              {hasSubjects && productSubjects.length > 0 && (
                                <div className="mt-2 pt-2 border-t">
                                  <Label className="text-xs font-semibold mb-2 block">
                                    Select Subjects:
                                  </Label>
                                  <div className="flex flex-wrap gap-2">
                                    {productSubjects.map((subject) => (
                                      <div key={subject} className="flex items-center space-x-1">
                                        <Checkbox
                                          className="border-neutral-400"
                                          id={`subject-${line.id}-${subject}`}
                                          checked={selectedSubjects.includes(subject)}
                                          onCheckedChange={(checked) => {
                                            const newSubjects = checked
                                              ? [...selectedSubjects, subject]
                                              : selectedSubjects.filter((s) => s !== subject)
                                            updateProductSectionLine(section.id, line.id, {
                                              selectedSubjects: newSubjects,
                                            })
                                          }}
                                        />
                                        <Label
                                          htmlFor={`subject-${line.id}-${subject}`}
                                          className="text-xs cursor-pointer"
                                        >
                                          {subject}
                                        </Label>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </CollapsibleContent>
                          </Collapsible>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            )}

            {productDetails.filter((pd) => !pd.isParentRow).length > 0 && (
              <div>
                <Label className="text-sm font-semibold mb-2 block">Product Details</Label>
                <div className="border rounded overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-neutral-100">
                      <tr>
                        <th className="px-3 py-2 text-left">Product</th>
                        <th className="px-3 py-2 text-left">Level</th>
                        <th className="px-3 py-2 text-left">Class</th>
                        <th className="px-3 py-2 text-left">Product Category</th>
                        {showSpecsColumn && <th className="px-3 py-2 text-left">Specs</th>}
                        {showSubjectsColumn && <th className="px-3 py-2 text-left">Subjects</th>}
                        <th className="px-3 py-2 text-left">Quantity (Strength) *</th>
                        <th className="px-3 py-2 text-left">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {childProductRows.map((pd) => (
                        <tr key={pd.id} className="border-t">
                          <td className="px-3 py-2 font-medium">{pd.product}</td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {getProductLevels(pd.product).length > 0 ? pd.level || '-' : '-'}
                          </td>
                          <td className="px-3 py-2">{pd.class}</td>
                          <td className="px-3 py-2">
                            {hasProductCategories(pd.product) ? (
                              <Select
                                value={
                                  (pd.productCategory || pd.category || '').trim() || undefined
                                }
                                onValueChange={(v) => updateProductDetail(pd.id, 'category', v)}
                              >
                                <SelectTrigger className="w-32 h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {getProductCategories(pd.product).map((c) => (
                                    <SelectItem key={c} value={c}>
                                      {c}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <span className="text-neutral-500">-</span>
                            )}
                          </td>
                          {showSpecsColumn && <td className="px-3 py-2">{pd.specs}</td>}
                          {showSubjectsColumn && (
                            <td className="px-3 py-2">{pd.subject || '-'}</td>
                          )}
                          <td className="px-3 py-2">
                            <Input
                              type="number"
                              value={pd.strength || ''}
                              onChange={(e) => {
                                let value = e.target.value
                                if (value.length > 1) {
                                  value = value.replace(/^0+/, '') || '0'
                                }
                                const numValue = value === '' ? 0 : Number(value)
                                updateProductDetail(pd.id, 'strength', numValue)
                              }}
                              onBlur={(e) => {
                                const numValue = Number(e.target.value) || 0
                                if (numValue !== pd.strength) {
                                  updateProductDetail(pd.id, 'strength', numValue)
                                }
                              }}
                              className="w-20 h-8"
                              min="1"
                              placeholder="0"
                              required
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeProductDetail(pd.id)}
                            >
                              <X className="w-4 h-4 text-red-500" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-neutral-300 bg-neutral-100 font-semibold">
                        <td
                          colSpan={3 + (showSpecsColumn ? 1 : 0) + (showSubjectsColumn ? 1 : 0)}
                          className="px-3 py-3 text-right"
                        >
                          <span className="text-neutral-700">Total:</span>
                        </td>
                        <td className="px-3 py-3 text-right">
                          {computeProductDetailsDisplayQuantity(childProductRows)}
                        </td>
                        <td className="px-3 py-3 text-right">
                          ₹
                          {computeProductDetailsDisplayTotal(childProductRows).toLocaleString(
                            'en-IN',
                            {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }
                          )}
                        </td>
                        <td className="px-3 py-3"></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setProductDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setProductDialogOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function CloseLeadProductConfigInternal({
  schoolType,
  onChange,
  onReady,
  hideTrigger,
  className,
}: Omit<CloseLeadProductConfigProps, 'config'>) {
  const cfg = useCloseLeadProductConfig({ schoolType })
  return (
    <CloseLeadProductConfigView
      cfg={cfg}
      onChange={onChange}
      onReady={onReady}
      hideTrigger={hideTrigger}
      className={className}
    />
  )
}

/**
 * Close Lead class-wise product configuration UI.
 * Pass `config` from `useCloseLeadProductConfig` (Close Lead), or omit it to own the hook
 * via `schoolType` (Create Sale).
 */
export function CloseLeadProductConfig({
  schoolType,
  config,
  onChange,
  onReady,
  hideTrigger,
  className,
}: CloseLeadProductConfigProps) {
  if (config) {
    return (
      <CloseLeadProductConfigView
        cfg={config}
        onChange={onChange}
        onReady={onReady}
        hideTrigger={hideTrigger}
        className={className}
      />
    )
  }
  return (
    <CloseLeadProductConfigInternal
      schoolType={schoolType}
      onChange={onChange}
      onReady={onReady}
      hideTrigger={hideTrigger}
      className={className}
    />
  )
}
