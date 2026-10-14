const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

function loadSource(name, dependencies = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', 'lib', name), 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText
  const loaded = { exports: {} }
  new Function('require', 'module', 'exports', compiled)(
    (moduleName) => {
      if (!Object.hasOwn(dependencies, moduleName)) throw Error(`Unexpected import: ${moduleName}`)
      return dependencies[moduleName]
    }, loaded, loaded.exports,
  )
  return loaded.exports
}
const paymentDivisor = loadSource('paymentDivisor.ts')
const invoice = loadSource('dcPaymentDivisors.ts', { '@/lib/paymentDivisor': paymentDivisor })
const config = loadSource('closeLeadProductConfig.ts', {
  '@/lib/paymentDivisor': paymentDivisor,
  '@/lib/dcPaymentDivisors': invoice,
  '@/lib/productTerm': { normalizeProductTerm: (value) => value, termFromLevelLabel: () => 'Term 1' },
})
const { pickGridProductCategory, computeLineDisplayTotal, expandSectionsToProductDetails,
  computeProductDetailsDisplayTotal, buildDcOrderProductsFromDetails, billedProductDetailRows } = config

test('entry categories follow the shared Abacus and Spelling Bee class grid', () => {
  const abacus = ['Star Junior', 'Junior', 'Senior']
  assert.equal(pickGridProductCategory('Abacus', '1', abacus), 'Star Junior')
  assert.equal(pickGridProductCategory('Abacus', '2', abacus), 'Star Junior')
  assert.equal(pickGridProductCategory('Abacus', '3', abacus), 'Junior')
  assert.equal(pickGridProductCategory('Abacus', '4', abacus), 'Junior')
  assert.equal(pickGridProductCategory('Abacus', '5', abacus), 'Senior')
  const spelling = ['Category 1', 'Category 2', 'Category 3']
  assert.equal(pickGridProductCategory('Spelling Bee', '3', spelling), 'Category 1')
  assert.equal(pickGridProductCategory('Spelling Bee', '4', spelling), 'Category 2')
  assert.equal(pickGridProductCategory('Spelling Bee', '7', spelling), 'Category 3')
})

test('shared and individual class rates produce distinct totals and ascending DC classes', () => {
  const line = {
    id: 'line', parentRowId: 'parent', product: 'Abacus', level: 'Level 1',
    selectedLevels: ['Level 1'], selectedSpecs: [], selectedSubjects: [],
    selectedDeliverables: [], selectedCategories: ['Star Junior', 'Junior'],
    classSelections: [{ class: '4', strength: 10 }, { class: '1', strength: 20 }],
    sameRateForAllClasses: false, price: 0, priceByClass: { 1: 100, 4: 250 },
  }
  assert.equal(computeLineDisplayTotal(line), 4500)
  const context = {
    schoolType: 'New', hasProductSubjects: () => false,
    hasProductCategories: () => true,
    getProductCategories: () => ['Star Junior', 'Junior'],
  }
  const rows = expandSectionsToProductDetails([{ id: 'section', lines: [line] }], context)
    .filter((row) => !row.isParentRow)
  assert.deepEqual(rows.map((row) => row.class), ['1', '4'])
  assert.deepEqual(rows.map((row) => row.price), [100, 250])
  assert.deepEqual(rows.map((row) => row.category), ['Star Junior', 'Junior'])
  line.sameRateForAllClasses = true
  line.price = 100
  assert.equal(computeLineDisplayTotal(line), 3000)
})

test('two terms and CW/HW books do not quadruple the student package price', () => {
  const line = {
    id: 'line', parentRowId: 'parent', product: 'Abacus p2', level: 'Term 1',
    selectedLevels: ['Term 1', 'Term 2'], selectedSpecs: ['CW', 'HW'],
    selectedSubjects: [], selectedDeliverables: [],
    classSelections: ['1', '2', '3', '4'].map((value) => ({ class: value, strength: 250 })),
    sameRateForAllClasses: true, price: 250, dispatchMode: 'both_levels_together',
  }
  const ctx = {
    schoolType: 'New', hasProductSubjects: () => false,
    hasProductCategories: () => true,
    getProductCategories: () => ['Star Junior L1', 'Star Junior L2', 'Junior L1', 'Junior L2'],
    getProductSpecs: () => ['CW', 'HW'],
  }
  const details = expandSectionsToProductDetails([{ id: 'section', lines: [line] }], ctx)
  const children = details.filter((row) => !row.isParentRow)
  const billing = { getCalculationType: () => 'level_based', getCatalogFallbackCount: () => 2 }
  assert.equal(children.length, 16)
  assert.equal(computeProductDetailsDisplayTotal(children, billing), 250000)
  const orderRows = buildDcOrderProductsFromDetails(children, {
    ...billing, productDetails: details, hasProductCategories: ctx.hasProductCategories,
    getProductCategories: ctx.getProductCategories,
  })
  assert.equal(orderRows.reduce((sum, row) => sum + row.total, 0), 250000)
  const invoiceAmount = invoice.applyPaymentDivisorsToBreakdown(
    children.map((row) => ({ product: row.product, class: row.class, strength: row.strength,
      unitPrice: row.price, level: row.level, specs: row.specs })),
    billing.getCalculationType, billing.getCatalogFallbackCount,
  ).totalAmount
  assert.equal(invoiceAmount, 250000)
  assert.equal(billedProductDetailRows(children, billing.getCalculationType,
    billing.getCatalogFallbackCount).reduce((sum, row) => sum + row.total, 0), 250000)
})
