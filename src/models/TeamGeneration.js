import mongoose from 'mongoose';
import { GENERATION_STATUS, VALID_GENERATION_STATUSES } from '../constants/status.js';
import { ACADEMIC_YEARS } from '../constants/academicYears.js';

// Student snapshot schema for immutable historical integrity
const studentSnapshotSchema = new mongoose.Schema(
  {
    studentRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true
    },
    fullName: { type: String, required: true },
    studentId: { type: String, required: true },
    email: { type: String, default: null },
    academicYear: {
      type: String,
      enum: [ACADEMIC_YEARS.FIRST_YEAR, ACADEMIC_YEARS.SECOND_YEAR],
      required: true
    },
    department: { type: String, default: '' },
    skills: { type: [String], default: [] }
  },
  { _id: false }
);

// Mentor snapshot schema
const mentorSnapshotSchema = new mongoose.Schema(
  {
    mentorRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Mentor',
      required: true
    },
    fullName: { type: String, required: true },
    mentorId: { type: String, required: true },
    email: { type: String, default: null },
    expertise: { type: [String], default: [] }
  },
  { _id: false }
);

// Team embedded schema
const teamSchema = new mongoose.Schema(
  {
    teamName: {
      type: String,
      required: true,
      trim: true
    },
    teamNumber: {
      type: Number,
      required: true
    },
    firstYearStudents: {
      type: [studentSnapshotSchema],
      validate: {
        validator: function (val) {
          return Array.isArray(val) && val.length === 2;
        },
        message: 'A team must have exactly 2 first-year students'
      }
    },
    secondYearStudent: {
      type: studentSnapshotSchema,
      required: [true, 'A team must have exactly 1 second-year student']
    },
    mentor: {
      type: mentorSnapshotSchema,
      required: [true, 'A team must have exactly 1 assigned mentor']
    }
  },
  {
    timestamps: true
  }
);

// TeamGeneration schema
const teamGenerationSchema = new mongoose.Schema(
  {
    generationName: {
      type: String,
      required: [true, 'Generation name is required'],
      trim: true,
      maxlength: [100, 'Generation name cannot exceed 100 characters']
    },
    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      required: [true, 'Admin reference is required']
    },
    teamCount: {
      type: Number,
      required: true,
      min: [1, 'Team count must be at least 1']
    },
    status: {
      type: String,
      enum: VALID_GENERATION_STATUSES,
      default: GENERATION_STATUS.CONFIRMED
    },
    teams: {
      type: [teamSchema],
      default: []
    },
    leftovers: {
      firstYears: {
        type: [studentSnapshotSchema],
        default: []
      },
      secondYears: {
        type: [studentSnapshotSchema],
        default: []
      },
      totalLeftovers: {
        type: Number,
        default: 0
      }
    },
    settings: {
      balancedMentorDistribution: {
        type: Boolean,
        default: true
      },
      requestedTeamCount: {
        type: Number,
        default: null
      },
      excludeAssignedStudents: {
        type: Boolean,
        default: false
      }
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

// Indexes
teamGenerationSchema.index({ createdAt: -1 });
teamGenerationSchema.index({ status: 1 });
teamGenerationSchema.index({ generatedBy: 1 });
teamGenerationSchema.index({ 'teams.firstYearStudents.studentRef': 1 });
teamGenerationSchema.index({ 'teams.secondYearStudent.studentRef': 1 });

export const TeamGeneration = mongoose.model('TeamGeneration', teamGenerationSchema);
