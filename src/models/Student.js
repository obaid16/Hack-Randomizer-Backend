import mongoose from 'mongoose';
import { ACADEMIC_YEARS, VALID_ACADEMIC_YEARS } from '../constants/academicYears.js';
import { STATUS, VALID_STATUSES } from '../constants/status.js';

const studentSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, 'Student full name is required'],
      trim: true,
      minlength: [2, 'Full name must be at least 2 characters'],
      maxlength: [120, 'Full name cannot exceed 120 characters']
    },
    studentId: {
      type: String,
      required: [true, 'Student ID is required'],
      unique: true,
      trim: true,
      uppercase: true,
      minlength: [2, 'Student ID must be at least 2 characters'],
      maxlength: [50, 'Student ID cannot exceed 50 characters']
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: null,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address']
    },
    academicYear: {
      type: String,
      required: [true, 'Academic year is required'],
      enum: {
        values: VALID_ACADEMIC_YEARS,
        message: '{VALUE} is not a valid academic year (use FIRST_YEAR or SECOND_YEAR)'
      }
    },
    department: {
      type: String,
      trim: true,
      default: ''
    },
    skills: {
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
studentSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: 'string' } } }
);
studentSchema.index({ academicYear: 1, status: 1 });
studentSchema.index({ fullName: 'text', studentId: 'text', department: 'text' });

export const Student = mongoose.model('Student', studentSchema);
