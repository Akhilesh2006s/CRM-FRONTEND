const CATEGORY_ALIASES = {
  Travel: 'travel',
  travel: 'travel',
  Food: 'food',
  food: 'food',
  Accommodation: 'accommodation',
  Accomodation: 'accommodation',
  accommodation: 'accommodation',
  Other: 'other',
  Others: 'other',
  others: 'other',
  other: 'other',
};

function normalizeCategory(raw) {
  if (!raw) return null;
  return CATEGORY_ALIASES[String(raw).trim()] || null;
}

function parseNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function hasReceipt(body, files) {
  if (body.receipt && String(body.receipt).trim()) return true;
  if (files?.bill?.[0] || files?.bill) return true;
  return false;
}

function hasTicket(body, files) {
  if (body.ticketReceipt && String(body.ticketReceipt).trim()) return true;
  if (files?.ticket?.[0] || files?.ticket) return true;
  return false;
}

function validateExpensePayload(body, policy, fileInfo = {}) {
  const errors = [];
  const category = normalizeCategory(body.category);
  if (!category) {
    errors.push('Valid expense category is required (travel, food, accommodation, other).');
    return { errors, category: null, data: null };
  }

  const amount = parseNum(body.amount);
  if (amount == null || amount <= 0) {
    errors.push('Amount must be greater than 0.');
  }

  const date = body.date ? new Date(body.date) : new Date();
  if (Number.isNaN(date.getTime())) {
    errors.push('Valid expense date is required.');
  }

  const data = {
    category,
    amount,
    employeeAmount: amount,
    date,
    title: body.title || `${category.charAt(0).toUpperCase() + category.slice(1)} expense`,
    description: body.description || body.employeeRemarks || '',
    employeeRemarks: body.employeeRemarks || body.remarks || '',
    receiptNumber: body.receiptNumber || '',
    submissionBatchId: body.submissionBatchId || undefined,
    dcId: body.dcId || undefined,
  };

  const receiptOk = hasReceipt(body, fileInfo);
  const ticketOk = hasTicket(body, fileInfo);
  const ticketModes = policy.requireTicketForModes || ['Bus', 'Train', 'Flight', 'Other'];

  if (category === 'travel') {
    const transportType = String(body.transportType || '').trim();
    if (!transportType) errors.push('Travel mode is required.');
    if (!String(body.travelFrom || '').trim()) errors.push('From location is required.');
    if (!String(body.travelTo || '').trim()) errors.push('To location is required.');

    const claimed = parseNum(body.approxKms ?? body.claimedDistanceKm);
    if (claimed == null || claimed <= 0) {
      errors.push('Total distance claimed (km) is required and must be greater than 0.');
    }

    data.transportType = transportType;
    data.travelFrom = String(body.travelFrom || '').trim();
    data.travelTo = String(body.travelTo || '').trim();
    data.approxKms = claimed;
    data.claimedDistanceKm = claimed;
    if (body.travelDate) data.travelDate = new Date(body.travelDate);
    if (body.gpsDistance != null) {
      data.gpsDistance = parseNum(body.gpsDistance) || 0;
      if (!body.gpsCalculatedAt && data.gpsDistance > 0) {
        data.gpsCalculatedAt = new Date();
      }
    }
    if (body.gpsProvider) data.gpsProvider = body.gpsProvider;
    if (body.gpsCalculatedAt) data.gpsCalculatedAt = new Date(body.gpsCalculatedAt);

    if (ticketModes.includes(transportType) && !ticketOk) {
      errors.push(`Ticket/proof upload is required for travel mode: ${transportType}.`);
    }
    if (transportType === 'Other' && !ticketOk) {
      errors.push('Ticket upload is mandatory when travel mode is Other.');
    }
  }

  if (category === 'accommodation') {
    if (!String(body.lodgeName || body.hotelName || '').trim()) {
      errors.push('Lodge/Hotel name is required.');
    }
    if (!String(body.city || '').trim()) errors.push('City is required.');
    const stayDate = body.stayDate || body.accommodationDate;
    if (!stayDate) errors.push('Stay date is required.');
    if (!receiptOk) errors.push('Bill photo upload is required for accommodation.');
    data.lodgeName = String(body.lodgeName || body.hotelName || '').trim();
    data.city = String(body.city || '').trim();
    data.stayDate = stayDate ? new Date(stayDate) : date;
    data.hotelAddress = body.hotelAddress || '';
  }

  if (category === 'food') {
    if (!String(body.restaurantName || '').trim()) {
      errors.push('Restaurant name is required.');
    }
    const mealDate = body.mealDate || body.foodDate || body.accommodationDate;
    if (!mealDate) errors.push('Meal date is required.');
    const threshold = Number(policy.foodBillMandatoryAbove) || 500;
    if (amount != null && amount >= threshold && !receiptOk) {
      errors.push(`Bill upload is required for food expenses of ₹${threshold} or more.`);
    }
    data.restaurantName = String(body.restaurantName || '').trim();
    data.mealDate = mealDate ? new Date(mealDate) : date;
  }

  if (category === 'other') {
    const otherType = String(body.otherExpenseType || 'Miscellaneous').trim();
    if (!otherType) errors.push('Other expense type is required.');
    if (!String(body.expenseName || body.title || '').trim() && otherType === 'Other') {
      errors.push('Expense name is required when type is Other.');
    }
    if (!String(body.description || '').trim() && ['Other', 'Miscellaneous'].includes(otherType)) {
      errors.push('Description is required.');
    }
    const proofRequired = ['Parking', 'Toll', 'Courier', 'Printing'].includes(otherType);
    if (proofRequired && !receiptOk) {
      errors.push(`Proof upload is required for ${otherType} expenses.`);
    }
    data.otherExpenseType = otherType;
    data.expenseName = String(body.expenseName || body.title || otherType).trim();
    data.description = String(body.description || data.description || '').trim();
    if (body.otherDate) data.otherDate = new Date(body.otherDate);
  }

  return { errors, category, data };
}

function summarizeBatchTotals(expenses) {
  const totals = { travel: 0, accommodation: 0, food: 0, other: 0, grandTotal: 0 };
  for (const exp of expenses) {
    const cat = normalizeCategory(exp.category) || 'other';
    const amt = Number(exp.amount) || 0;
    if (cat === 'travel') totals.travel += amt;
    else if (cat === 'accommodation') totals.accommodation += amt;
    else if (cat === 'food') totals.food += amt;
    else totals.other += amt;
    totals.grandTotal += amt;
  }
  return totals;
}

module.exports = {
  normalizeCategory,
  validateExpensePayload,
  summarizeBatchTotals,
  CATEGORY_ALIASES,
};
