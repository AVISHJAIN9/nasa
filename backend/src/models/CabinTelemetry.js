import mongoose from 'mongoose';

const CabinTelemetrySchema = new mongoose.Schema(
  {
    reading_id: { type: String, required: true, unique: true, index: true },
    compartment: {
      type: String,
      default: 'hab_module_alpha',
      enum: ['hab_module_alpha', 'service_module', 'command_deck', 'airlock'],
      index: true
    },
    timestamp: { type: Date, required: true, default: Date.now, index: true },
    co2_percent: { type: Number, required: true },
    o2_percent: { type: Number, required: true },
    cabin_pressure_kpa: { type: Number, required: true },
    temperature_c: { type: Number, required: true },
    humidity_percent: { type: Number, required: true },
    ambient_noise_db: { type: Number, default: 58.5 },
    overall_status: {
      type: String,
      enum: ['NOMINAL', 'CAUTION', 'WARNING'],
      default: 'NOMINAL',
      index: true
    },
    active_alerts: { type: [String], default: [] }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
  }
);

CabinTelemetrySchema.index({ compartment: 1, timestamp: -1 });

CabinTelemetrySchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  }
});

export const CabinTelemetry =
  mongoose.models.CabinTelemetry ||
  mongoose.model('CabinTelemetry', CabinTelemetrySchema);
