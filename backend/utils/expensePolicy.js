const AppSettings = require('../models/AppSettings');

const SETTINGS_KEY = 'global';

const DEFAULT_EXPENSE_POLICY = {
  skipFinanceStage: false,
  foodBillMandatoryAbove: 500,
  requireTicketForModes: ['Bus', 'Train', 'Flight', 'Other'],
};

async function getExpensePolicy() {
  const doc = await AppSettings.findOne({ key: SETTINGS_KEY }).lean();
  const fromDb = doc?.expense && typeof doc.expense === 'object' ? doc.expense : {};
  return {
    ...DEFAULT_EXPENSE_POLICY,
    ...fromDb,
    requireTicketForModes: Array.isArray(fromDb.requireTicketForModes)
      ? fromDb.requireTicketForModes
      : DEFAULT_EXPENSE_POLICY.requireTicketForModes,
  };
}

module.exports = { DEFAULT_EXPENSE_POLICY, getExpensePolicy };
