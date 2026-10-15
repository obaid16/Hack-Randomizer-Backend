import { Mentor } from '../models/Mentor.js';
import { TeamGeneration } from '../models/TeamGeneration.js';
import { ApiError } from '../utils/apiError.js';
import { parseCsv } from '../utils/csvHelper.js';
import { STATUS } from '../constants/status.js';

export class MentorService {
  /**
   * Create a single mentor
   * @param {object} mentorData
   */
  static async createMentor(mentorData) {
    const existing = await Mentor.findOne({ mentorId: mentorData.mentorId.trim().toUpperCase() });
    if (existing) {
      throw ApiError.conflict(`Mentor with mentorId '${mentorData.mentorId}' already exists.`);
    }

    if (mentorData.email) {
      const emailExisting = await Mentor.findOne({ email: mentorData.email.trim().toLowerCase() });
      if (emailExisting) {
        throw ApiError.conflict(`Mentor with email '${mentorData.email}' already exists.`);
      }
    }

    const mentor = await Mentor.create({
      ...mentorData,
      mentorId: mentorData.mentorId.trim().toUpperCase(),
      email: mentorData.email ? mentorData.email.trim().toLowerCase() : null
    });

    return mentor;
  }

  /**
   * Get paginated mentors with search and filter
   */
  static async getMentors(queryParams) {
    const {
      page = 1,
      limit = 20,
      search,
      status,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = queryParams;

    const filter = {};

    if (status) {
      filter.status = status;
    }

    if (search) {
      const searchRegex = { $regex: search, $options: 'i' };
      filter.$or = [
        { fullName: searchRegex },
        { mentorId: searchRegex },
        { email: searchRegex },
        { expertise: searchRegex }
      ];
    }

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [mentors, total] = await Promise.all([
      Mentor.find(filter).sort(sort).skip(skip).limit(limit),
      Mentor.countDocuments(filter)
    ]);

    return {
      mentors,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1
      }
    };
  }

  /**
   * Get mentor by ID
   * @param {string} id
   */
  static async getMentorById(id) {
    const mentor = await Mentor.findById(id);
    if (!mentor) {
      throw ApiError.notFound(`Mentor with ID '${id}' not found.`);
    }
    return mentor;
  }

  /**
   * Update mentor
   * @param {string} id
   * @param {object} updateData
   */
  static async updateMentor(id, updateData) {
    const mentor = await Mentor.findById(id);
    if (!mentor) {
      throw ApiError.notFound(`Mentor with ID '${id}' not found.`);
    }

    if (updateData.mentorId && updateData.mentorId.trim().toUpperCase() !== mentor.mentorId) {
      const existing = await Mentor.findOne({
        mentorId: updateData.mentorId.trim().toUpperCase(),
        _id: { $ne: id }
      });
      if (existing) {
        throw ApiError.conflict(`Mentor with mentorId '${updateData.mentorId}' already exists.`);
      }
      mentor.mentorId = updateData.mentorId.trim().toUpperCase();
    }

    if (updateData.email !== undefined) {
      const newEmail = updateData.email ? updateData.email.trim().toLowerCase() : null;
      if (newEmail && newEmail !== mentor.email) {
        const existing = await Mentor.findOne({
          email: newEmail,
          _id: { $ne: id }
        });
        if (existing) {
          throw ApiError.conflict(`Mentor with email '${updateData.email}' already exists.`);
        }
      }
      mentor.email = newEmail;
    }

    if (updateData.fullName) mentor.fullName = updateData.fullName.trim();
    if (updateData.expertise) mentor.expertise = updateData.expertise;
    if (updateData.status) mentor.status = updateData.status;

    await mentor.save();
    return mentor;
  }

  /**
   * Safe delete mentor
   * @param {string} id
   */
  static async deleteMentor(id) {
    const mentor = await Mentor.findById(id);
    if (!mentor) {
      throw ApiError.notFound(`Mentor with ID '${id}' not found.`);
    }

    const referencedCount = await TeamGeneration.countDocuments({
      'teams.mentor.mentorRef': id
    });

    if (referencedCount > 0) {
      mentor.status = STATUS.INACTIVE;
      await mentor.save();
      return {
        deleted: false,
        deactivated: true,
        message: 'Mentor is referenced in historical team generations. Marked status as INACTIVE to preserve record integrity.'
      };
    }

    await Mentor.findByIdAndDelete(id);
    return {
      deleted: true,
      deactivated: false,
      message: 'Mentor deleted successfully.'
    };
  }

  /**
   * Bulk import mentors with row-level validation
   * @param {Array<object>} rawList
   */
  static async bulkImport(rawList) {
    if (!Array.isArray(rawList) || rawList.length === 0) {
      throw ApiError.badRequest('No mentor records provided for bulk import.');
    }

    const validMentorsToInsert = [];
    const invalidRows = [];
    const seenMentorIdsInBatch = new Set();
    const seenEmailsInBatch = new Set();

    const existingMentors = await Mentor.find({}, { mentorId: 1, email: 1 }).lean();
    const existingDbMentorIds = new Set(existingMentors.map(m => m.mentorId.toUpperCase()));
    const existingDbEmails = new Set(
      existingMentors.filter(m => m.email).map(m => m.email.toLowerCase())
    );

    for (let index = 0; index < rawList.length; index++) {
      const row = rawList[index];
      const rowNum = index + 1;
      const rowErrors = [];

      const fullName = (row.fullName || row['Full Name'] || '').toString().trim();
      if (!fullName || fullName.length < 2) {
        rowErrors.push('fullName is required and must be at least 2 characters');
      }

      const mentorIdRaw = (row.mentorId || row['Mentor ID'] || row['mentor_id'] || '').toString().trim().toUpperCase();
      if (!mentorIdRaw || mentorIdRaw.length < 2) {
        rowErrors.push('mentorId is required and must be at least 2 characters');
      } else {
        if (seenMentorIdsInBatch.has(mentorIdRaw)) {
          rowErrors.push(`Duplicate mentorId '${mentorIdRaw}' in this import file`);
        } else if (existingDbMentorIds.has(mentorIdRaw)) {
          rowErrors.push(`Mentor ID '${mentorIdRaw}' already exists in the database`);
        }
      }

      let emailRaw = (row.email || row['Email'] || '').toString().trim().toLowerCase();
      if (emailRaw) {
        const emailRegex = /^\S+@\S+\.\S+$/;
        if (!emailRegex.test(emailRaw)) {
          rowErrors.push(`Invalid email format: '${emailRaw}'`);
        } else if (seenEmailsInBatch.has(emailRaw)) {
          rowErrors.push(`Duplicate email '${emailRaw}' in this import file`);
        } else if (existingDbEmails.has(emailRaw)) {
          rowErrors.push(`Email '${emailRaw}' already exists in the database`);
        }
      } else {
        emailRaw = null;
      }

      let expertise = row.expertise || row['Expertise'] || [];
      if (typeof expertise === 'string') {
        expertise = expertise.split(/[,;|]/).map(s => s.trim()).filter(Boolean);
      } else if (!Array.isArray(expertise)) {
        expertise = [];
      }

      let status = (row.status || row['Status'] || STATUS.ACTIVE).toString().trim().toUpperCase();
      if (![STATUS.ACTIVE, STATUS.INACTIVE].includes(status)) {
        status = STATUS.ACTIVE;
      }

      if (rowErrors.length > 0) {
        invalidRows.push({
          row: rowNum,
          mentorId: mentorIdRaw || 'UNKNOWN',
          errors: rowErrors
        });
      } else {
        seenMentorIdsInBatch.add(mentorIdRaw);
        if (emailRaw) seenEmailsInBatch.add(emailRaw);

        validMentorsToInsert.push({
          fullName,
          mentorId: mentorIdRaw,
          email: emailRaw,
          expertise,
          status
        });
      }
    }

    let insertedRecords = [];
    if (validMentorsToInsert.length > 0) {
      insertedRecords = await Mentor.insertMany(validMentorsToInsert, { ordered: false });
    }

    return {
      totalProcessed: rawList.length,
      successCount: insertedRecords.length,
      failedCount: invalidRows.length,
      createdMentors: insertedRecords,
      errors: invalidRows
    };
  }

  /**
   * Import mentors from CSV text or buffer
   * @param {Buffer|string} fileContent
   */
  static async bulkImportCsv(fileContent) {
    const csvString = typeof fileContent === 'string' ? fileContent : fileContent.toString('utf-8');
    const parsedRows = parseCsv(csvString);
    if (!parsedRows.length) {
      throw ApiError.badRequest('CSV file is empty or headers could not be found.');
    }
    return this.bulkImport(parsedRows);
  }
}
