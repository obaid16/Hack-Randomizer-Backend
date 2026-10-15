import mongoose from 'mongoose';
import { STATUS, VALID_STATUSES } from '../constants/status.js';

const mentorSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, 'Mentor full name is required'],
      trim: true,
      minlength: [2, 'Full name must be at least 2 characters'],
      maxlength: [120, 'Full name cannot exceed 120 characters']
    },
    mentorId: {
      type: String,
      required: [true, 'Mentor ID is required'],
      unique: true,
      trim: true,
      uppercase: true,
      minlength: [2, 'Mentor ID must be at least 2 characters'],
      maxlength: [50, 'Mentor ID cannot exceed 50 characters']
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: null,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address']
    },
    expertise: {
      type: [String],
      default: []
    },
    status: {
      type: String,
      enum: VALID_STATUSES,
      default: STATUS.ACTIVE
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret.__v;
        return ret;
      }
    }
  }
);

// Unique index only when email is an actual string (ignores null/undefined)
mentorSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: 'string' } } }
);
mentorSchema.index({ status: 1 });
mentorSchema.index({ fullName: 'text', mentorId: 'text' });

export const Mentor = mongoose.model('Mentor', mentorSchema);
