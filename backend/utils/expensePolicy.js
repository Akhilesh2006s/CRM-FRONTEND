const AppSettings = require('../models/AppSettings');

const SETTINGS_KEY = 'global';

const DEFAULT_EXPENSE_POLICY = {
  skipFinanceStage: false,
  foodBillMandatoryAbove: 500,
  requireTicketForModes: ['Bus', 'Train', 'Flight'],
  bikeRatePerKm: 2.8,
  carRatePerKm: 8,
};

async function getExpensePolicy() {
  const doc = await AppSettings.findOne({ key: SETTINGS_KEY }).lean();
  const fromDb = doc?.expense && typeof doc.expense === 'object' ? doc.expense : {};
  const bike = Number(fromDb.bikeRatePerKm);
  const car = Number(fromDb.carRatePerKm);
  return {
    ...DEFAULT_EXPENSE_POLICY,
    ...fromDb,
    requireTicketForModes: Array.isArray(fromDb.requireTicketForModes)
      ? fromDb.requireTicketForModes
      : DEFAULT_EXPENSE_POLICY.requireTicketForModes,
    bikeRatePerKm: bike > 0 ? bike : DEFAULT_EXPENSE_POLICY.bikeRatePerKm,
    carRatePerKm: car > 0 ? car : DEFAULT_EXPENSE_POLICY.carRatePerKm,
  };
}

module.exports = { DEFAULT_EXPENSE_POLICY, getExpensePolicy };
