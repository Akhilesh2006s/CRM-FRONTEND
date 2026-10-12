const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

const file = path.join(__dirname, '..', 'lib', 'closeLeadProductConfig.ts')
const source = fs.readFileSync(file, 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText
const loaded = { exports: {} }
new Function('require', 'module', 'exports', compiled)(
  () => ({ normalizeProductTerm: (value) => value, termFromLevelLabel: () => 'Term 1' }),
  loaded,
  loaded.exports,
)
const { pickGridProductCategory, computeLineDisplayTotal, expandSectionsToProductDetails } = loaded.exports

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
