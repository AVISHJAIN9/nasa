import mongoose from 'mongoose';

const WatchdogLogSchema = new mongoose.Schema(
  {
    event_id: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    event_type: {
      type: String,
      enum: ['SENSOR_FAILURE', 'DATA_DRIFT', 'CALIBRATION_DROP', 'WATCHDOG_RECOVERED', 'MANUAL_TRIGGER'],
      required: true,
      index: true
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true
    },
    previous_mode: {
      type: String,
      enum: ['ACTIVE_ML', 'DEGRADED_FALLBACK_RULES'],
      required: true
    },
    current_mode: {
      type: String,
      enum: ['ACTIVE_ML', 'DEGRADED_FALLBACK_RULES'],
      required: true
    },
    drift_metrics: {
      psi: Number,
      ks_statistic: Number,
      p_value: Number
    },
    sensor_metrics: {
      dropout_rate: Number,
      failed_sensors: [String]
    },
    reason: {
      type: String,
      required: true
    },
    banner_message: {
      type: String,
      required: true
    },
    recovery_guidance: {
      type: String
    },
    created_by: {
      type: String,
      default: 'system_watchdog'
    }
  },
  {
    timestamps: true
  }
);

WatchdogLogSchema.index({ timestamp: -1 });

export const WatchdogLog = mongoose.models.WatchdogLog || mongoose.model('WatchdogLog', WatchdogLogSchema);
