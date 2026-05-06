const ProgramBilling = require('../models/ProgramBilling');
const ProgramLevelDelivery = require('../models/ProgramLevelDelivery');
const ProgramBillingLedger = require('../models/ProgramBillingLedger');
const {
  recordLevelDelivery,
  recomputeProgramPayable,
  roundToTwo,
} = require('../services/programBillingService');

const createProgram = async (req, res) => {
  try {
    const {
      dcOrderId,
      product,
      totalLevels,
      unitPrice,
      currency = 'INR',
      programCode,
    } = req.body;

    if (!dcOrderId || !product || !totalLevels || unitPrice === undefined) {
      return res.status(400).json({ message: 'dcOrderId, product, totalLevels and unitPrice are required' });
    }

    const existing = await ProgramBilling.findOne({ dcOrderId, product });
    if (existing) {
      return res.status(200).json(existing);
    }

    const program = await ProgramBilling.create({
      dcOrderId,
      product,
      totalLevels: Number(totalLevels),
      unitPrice: roundToTwo(unitPrice),
      currency,
      programCode,
    });

    res.status(201).json(program);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getProgram = async (req, res) => {
  try {
    const program = await ProgramBilling.findById(req.params.id).populate('dcOrderId');
    if (!program) {
      return res.status(404).json({ message: 'Program not found' });
    }

    const levels = await ProgramLevelDelivery.find({ programId: program._id }).sort({ levelNumber: 1 }).lean();
    res.json({ program, levels });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const upsertLevelDelivery = async (req, res) => {
  try {
    const programId = req.params.id;
    const { levelNumber, studentsCount, dcId, deliveredAt } = req.body;

    if (!levelNumber || studentsCount === undefined || !dcId) {
      return res.status(400).json({ message: 'levelNumber, studentsCount and dcId are required' });
    }

    const levelDelivery = await recordLevelDelivery({
      programId,
      levelNumber: Number(levelNumber),
      studentsCount: Number(studentsCount),
      dcId,
      deliveredAt,
    });

    const recomputeResult = await recomputeProgramPayable(programId, { sourceDcId: dcId });
    res.json({ levelDelivery, recomputeResult });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const triggerRecompute = async (req, res) => {
  try {
    const result = await recomputeProgramPayable(req.params.id, {
      sourceDcId: req.body?.dcId,
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getProgramLedger = async (req, res) => {
  try {
    const rows = await ProgramBillingLedger.find({ programId: req.params.id }).sort({ createdAt: -1 });
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getProgramStatus = async (req, res) => {
  try {
    const { dcOrderId, product } = req.query;
    if (!dcOrderId || !product) {
      return res.status(400).json({ message: 'dcOrderId and product are required' });
    }

    const program = await ProgramBilling.findOne({ dcOrderId, product }).lean();
    if (!program) {
      return res.json({
        exists: false,
        shouldGenerateInvoice: true,
      });
    }

    const totalLevels = Math.max(1, Number(program.totalLevels || 1));
    const deliveredLevelsCount = Number(program.deliveredLevelsCount || 0);
    const shouldGenerateInvoice = deliveredLevelsCount >= totalLevels;

    res.json({
      exists: true,
      programId: String(program._id),
      totalLevels,
      deliveredLevelsCount,
      shouldGenerateInvoice,
      lastComputedPayable: Number(program.lastComputedPayable || 0),
      lastComputedAt: program.lastComputedAt || null,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createProgram,
  getProgram,
  upsertLevelDelivery,
  triggerRecompute,
  getProgramLedger,
  getProgramStatus,
};
