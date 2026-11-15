import mongoose from 'mongoose';

const AlertSchema = new mongoose.Schema(
  {
    alert_id: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    crew_id: {
      type: String,
      required: true,
      index: true
    },
    source: {
      type: String,
      set: (v) => (v ? String(v).toUpperCase() : 'RULE'),
      default: 'RULE',
      index: true
    },
    category: {
      type: String,
      default: 'PHYSIOLOGY',
      index: true
    },
    metric: {
      type: String,
      default: 'vitals',
      index: true
    },
    severity: {
      type: String,
      set: (v) => {
        if (!v) return 'WARNING';
        const up = String(v).toUpperCase();
        if (up === 'WATCH') return 'WARNING';
        return up;
      },
      default: 'WARNING',
      index: true
    },
    title: {
      type: String,
      required: true
    },
    message: {
      type: String,
      required: true
    },
    value: {
      type: mongoose.Schema.Types.Mixed
    },
    threshold: {
      type: mongoose.Schema.Types.Mixed
    },
    status: {
      type: String,
      set: (v) => {
        if (!v) return 'ACTIVE';
        const up = String(v).toUpperCase();
        if (up === 'NEW') return 'ACTIVE';
        if (up === 'ACK') return 'ACKNOWLEDGED';
        return up;
      },
      default: 'ACTIVE',
      index: true
    },
    assigned_to: {
      type: String,
      default: null
    },
    snoozed_until: {
      type: Date,
      default: null
    },
    acknowledged_at: {
      type: Date,
      default: null
    },
    acknowledged_by: {
      type: String,
      default: null
    },
    resolved_at: {
      type: Date,
      default: null
    },
    resolved_by: {
      type: String,
      default: null
    },
    resolution_notes: {
      type: String,
      default: null
    },
    group_id: {
      type: String,
      default: null,
      index: true
    },
    dedup_count: {
      type: Number,
      default: 1
    },
    raw_alert_ids: {
      type: [String],
      default: []
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
  }
);

AlertSchema.index({ crew_id: 1, metric: 1, status: 1 });
AlertSchema.index({ status: 1, severity: 1, created_at: -1 });

export const Alert = mongoose.models.Alert || mongoose.model('Alert', AlertSchema);
