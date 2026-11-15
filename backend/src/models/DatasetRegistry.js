import mongoose from 'mongoose';

const DatasetRegistrySchema = new mongoose.Schema(
  {
    dataset_id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    provenance_type: {
      type: String,
      enum: ['SIMULATED', 'REPLAY', 'REAL_DEVICE'],
      required: true,
      index: true
    },
    source_url: { type: String, default: 'https://data.nasa.gov' },
    license: { type: String, required: true },
    citation: { type: String, default: '' },
    version: { type: String, default: '1.0.0' }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
  }
);

DatasetRegistrySchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  }
});

export const DatasetRegistry =
  mongoose.models.DatasetRegistry ||
  mongoose.model('DatasetRegistry', DatasetRegistrySchema);
