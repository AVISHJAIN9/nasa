import mongoose from 'mongoose';

const TelemetryReadingSchema = new mongoose.Schema(
  {
    reading_id: { type: String, required: true, unique: true, index: true },
    crew_id: { type: String, required: true, index: true },
    metric: {
      type: String,
      required: true,
      enum: ['heart_rate', 'spo2', 'sys_bp', 'dia_bp', 'temperature', 'hrv', 'respiration_rate'],
      index: true
    },
    value: { type: Number, required: true },
    unit: { type: String, required: true },
    timestamp: { type: Date, required: true, index: true },
    provenance: {
      type: String,
      enum: ['SIMULATED', 'REPLAY', 'REAL_DEVICE'],
      default: 'SIMULATED',
      index: true
    },
    dataset_id: { type: String, default: 'SYNTHETIC_MARS_01' },
    is_anomaly: { type: Boolean, default: false },
    quality_score: { type: Number, default: 1.0, min: 0.0, max: 1.0 },
    quality_status: {
      type: String,
      enum: ['GOOD', 'DEGRADED', 'DROPOUT', 'ARTIFACT', 'INTERPOLATED'],
      default: 'GOOD',
      index: true
    },
    is_alertable: { type: Boolean, default: true }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
  }
);

TelemetryReadingSchema.index({ crew_id: 1, timestamp: -1 });
TelemetryReadingSchema.index({ crew_id: 1, metric: 1, timestamp: -1 });

TelemetryReadingSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  }
});

export const TelemetryReading =
  mongoose.models.TelemetryReading ||
  mongoose.model('TelemetryReading', TelemetryReadingSchema);
