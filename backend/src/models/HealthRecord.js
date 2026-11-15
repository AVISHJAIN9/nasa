import mongoose from 'mongoose';

const ConditionSchema = new mongoose.Schema(
  {
    code: { type: String, default: null },
    name: { type: String, required: true },
    diagnosed_date: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ['active', 'resolved', 'monitoring'],
      default: 'active'
    },
    severity: {
      type: String,
      enum: ['mild', 'moderate', 'severe'],
      default: 'mild'
    }
  },
  { _id: false }
);

const AllergySchema = new mongoose.Schema(
  {
    allergen: { type: String, required: true },
    reaction: { type: String, default: 'unknown' },
    severity: {
      type: String,
      enum: ['mild', 'moderate', 'severe', 'anaphylaxis'],
      default: 'mild'
    },
    confirmed_date: { type: Date, default: Date.now }
  },
  { _id: false }
);

const MedicationSchema = new mongoose.Schema(
  {
    medication_name: { type: String, required: true },
    dose: { type: String, required: true },
    frequency: { type: String, required: true },
    route: { type: String, default: 'oral' },
    started_date: { type: Date, default: Date.now },
    ended_date: { type: Date, default: null },
    status: {
      type: String,
      enum: ['active', 'discontinued'],
      default: 'active'
    }
  },
  { _id: false }
);

const ImmunizationSchema = new mongoose.Schema(
  {
    vaccine: { type: String, required: true },
    administered_date: { type: Date, default: Date.now },
    lot_number: { type: String, default: null }
  },
  { _id: false }
);

const ClinicalNoteSchema = new mongoose.Schema(
  {
    note_id: { type: String, required: true },
    author_id: { type: String, required: true },
    author_role: { type: String, default: 'flight_surgeon' },
    note_type: {
      type: String,
      enum: ['soap', 'encounter', 'progress', 'eva_debrief'],
      default: 'soap'
    },
    date: { type: Date, default: Date.now },
    subjective: { type: String, default: '' },
    objective: { type: String, default: '' },
    assessment: { type: String, default: '' },
    plan: { type: String, default: '' }
  },
  { _id: false }
);

const MedicalClearanceSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ['cleared', 'restricted', 'grounded'],
      default: 'cleared'
    },
    certified_by: { type: String, default: 'NASA Chief Medical Officer' },
    certified_date: { type: Date, default: Date.now },
    restrictions: [{ type: String }]
  },
  { _id: false }
);

const HealthRecordSchema = new mongoose.Schema(
  {
    record_id: { type: String, required: true, unique: true, index: true },
    crew_id: { type: String, required: true, unique: true, index: true },
    blood_type: {
      type: String,
      enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
      default: 'O+'
    },
    conditions: [ConditionSchema],
    allergies: [AllergySchema],
    medications: [MedicationSchema],
    immunizations: [ImmunizationSchema],
    clinical_notes: [ClinicalNoteSchema],
    medical_clearance: {
      type: MedicalClearanceSchema,
      default: () => ({ status: 'cleared', restrictions: [] })
    }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
  }
);

HealthRecordSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  }
});

export const HealthRecord =
  mongoose.models.HealthRecord || mongoose.model('HealthRecord', HealthRecordSchema);
