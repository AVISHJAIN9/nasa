import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true
    },
    password_hash: {
      type: String,
      required: true
    },
    role: {
      type: String,
      enum: ['astronaut', 'flight_surgeon', 'mission_control', 'admin'],
      default: 'astronaut',
      required: true,
      index: true
    },
    crew_id: {
      type: String,
      default: null,
      index: true
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        delete ret.password_hash;
        return ret;
      }
    }
  }
);

export const User = mongoose.models.User || mongoose.model('User', userSchema);
