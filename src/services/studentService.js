import { Student } from '../models/Student.js';
import { TeamGeneration } from '../models/TeamGeneration.js';
import { ApiError } from '../utils/apiError.js';
import { parseCsv } from '../utils/csvHelper.js';
import { STATUS } from '../constants/status.js';
import { ACADEMIC_YEARS } from '../constants/academicYears.js';

export class StudentService {
  /**
   * Create a single student
   * @param {object} studentData
   */
  static async createStudent(studentData) {
    const existing = await Student.findOne({ studentId: studentData.studentId.trim().toUpperCase() });
    if (existing) {
      throw ApiError.conflict(`Student with studentId '${studentData.studentId}' already exists.`);
    }

    if (studentData.email) {
      const emailExisting = await Student.findOne({ email: studentData.email.trim().toLowerCase() });
      if (emailExisting) {
        throw ApiError.conflict(`Student with email '${studentData.email}' already exists.`);
      }
    }

    const student = await Student.create({
      ...studentData,
      studentId: studentData.studentId.trim().toUpperCase(),
      email: studentData.email ? studentData.email.trim().toLowerCase() : null
    });

    return student;
  }

  /**
   * Get paginated students with filters
   */
  static async getStudents(queryParams) {
    const {
      page = 1,
      limit = 20,
      search,
      academicYear,
      status,
      department,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = queryParams;

    const filter = {};

    if (academicYear) {
      filter.academicYear = academicYear;
    }

    if (status) {
      filter.status = status;
    }

    if (department) {
      filter.department = { $regex: department, $options: 'i' };
    }

    if (search) {
      const searchRegex = { $regex: search, $options: 'i' };
      filter.$or = [
        { fullName: searchRegex },
        { studentId: searchRegex },
        { department: searchRegex },
        { email: searchRegex }
      ];
    }

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [students, total] = await Promise.all([
      Student.find(filter).sort(sort).skip(skip).limit(limit),
      Student.countDocuments(filter)
    ]);

    return {
      students,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1
      }
    };
  }

  /**
   * Get student by ID
   * @param {string} id
   */
  static async getStudentById(id) {
    const student = await Student.findById(id);
    if (!student) {
      throw ApiError.notFound(`Student with ID '${id}' not found.`);
    }
    return student;
  }

  /**
   * Update student
   * @param {string} id
   * @param {object} updateData
   */
  static async updateStudent(id, updateData) {
    const student = await Student.findById(id);
    if (!student) {
      throw ApiError.notFound(`Student with ID '${id}' not found.`);
    }

    if (updateData.studentId && updateData.studentId.trim().toUpperCase() !== student.studentId) {
      const existing = await Student.findOne({
        studentId: updateData.studentId.trim().toUpperCase(),
        _id: { $ne: id }
      });
      if (existing) {
        throw ApiError.conflict(`Student with studentId '${updateData.studentId}' already exists.`);
      }
      student.studentId = updateData.studentId.trim().toUpperCase();
    }

    if (updateData.email !== undefined) {
      const newEmail = updateData.email ? updateData.email.trim().toLowerCase() : null;
      if (newEmail && newEmail !== student.email) {
        const existing = await Student.findOne({
          email: newEmail,
          _id: { $ne: id }
        });
        if (existing) {
          throw ApiError.conflict(`Student with email '${updateData.email}' already exists.`);
        }
      }
      student.email = newEmail;
    }

    if (updateData.fullName) student.fullName = updateData.fullName.trim();
    if (updateData.academicYear) student.academicYear = updateData.academicYear;
    if (updateData.department !== undefined) student.department = updateData.department.trim();
    if (updateData.skills) student.skills = updateData.skills;
    if (updateData.status) student.status = updateData.status;

    await student.save();
    return student;
  }

  /**
   * Safe delete student:
   * If student has been referenced in any team generation, mark as INACTIVE to preserve historical integrity.
   * If never referenced, hard-delete.
   * @param {string} id
   */
  static async deleteStudent(id) {
    const student = await Student.findById(id);
    if (!student) {
      throw ApiError.notFound(`Student with ID '${id}' not found.`);
    }

    const referencedCount = await TeamGeneration.countDocuments({
      $or: [
        { 'teams.firstYearStudents.studentRef': id },
        { 'teams.secondYearStudent.studentRef': id },
        { 'leftovers.firstYears.studentRef': id },
        { 'leftovers.secondYears.studentRef': id }
      ]
    });

    if (referencedCount > 0) {
      student.status = STATUS.INACTIVE;
      await student.save();
      return {
        deleted: false,
        deactivated: true,
        message: 'Student is referenced in historical team generations. Marked status as INACTIVE to preserve record integrity.'
      };
    }

    await Student.findByIdAndDelete(id);
    return {
      deleted: true,
      deactivated: false,
      message: 'Student deleted successfully.'
    };
  }

  /**
   * Bulk import students with row-level validation and error reporting
   * @param {Array<object>} rawList
   */
  static async bulkImport(rawList) {
    if (!Array.isArray(rawList) || rawList.length === 0) {
      throw ApiError.badRequest('No student records provided for bulk import.');
    }

    const validStudentsToInsert = [];
    const invalidRows = [];
    const seenStudentIdsInBatch = new Set();
    const seenEmailsInBatch = new Set();

    // Fetch existing studentIds and emails from DB in one query for fast check
    const existingStudents = await Student.find({}, { studentId: 1, email: 1 }).lean();
    const existingDbStudentIds = new Set(existingStudents.map(s => s.studentId.toUpperCase()));
    const existingDbEmails = new Set(
      existingStudents.filter(s => s.email).map(s => s.email.toLowerCase())
    );

    for (let index = 0; index < rawList.length; index++) {
      const row = rawList[index];
      const rowNum = index + 1;
      const rowErrors = [];

      // Validate fullName
      const fullName = (row.fullName || row['Full Name'] || '').toString().trim();
      if (!fullName || fullName.length < 2) {
        rowErrors.push('fullName is required and must be at least 2 characters');
      }

      // Validate studentId
      const studentIdRaw = (row.studentId || row['Student ID'] || row['student_id'] || '').toString().trim().toUpperCase();
      if (!studentIdRaw || studentIdRaw.length < 2) {
        rowErrors.push('studentId is required and must be at least 2 characters');
      } else {
        if (seenStudentIdsInBatch.has(studentIdRaw)) {
          rowErrors.push(`Duplicate studentId '${studentIdRaw}' in this import file`);
        } else if (existingDbStudentIds.has(studentIdRaw)) {
          rowErrors.push(`Student ID '${studentIdRaw}' already exists in the database`);
        }
      }

      // Validate email (optional)
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

      // Validate academicYear
      let academicYearRaw = (row.academicYear || row['Academic Year'] || row['academic_year'] || '').toString().trim().toUpperCase();
      // Normalize common labels: '1', '1ST', 'FIRST', 'FIRST_YEAR', etc.
      if (['1', '1ST', '1ST YEAR', 'FIRST', 'FIRST YEAR', 'FIRST_YEAR'].includes(academicYearRaw)) {
        academicYearRaw = ACADEMIC_YEARS.FIRST_YEAR;
      } else if (['2', '2ND', '2ND YEAR', 'SECOND', 'SECOND YEAR', 'SECOND_YEAR'].includes(academicYearRaw)) {
        academicYearRaw = ACADEMIC_YEARS.SECOND_YEAR;
      }

      if (![ACADEMIC_YEARS.FIRST_YEAR, ACADEMIC_YEARS.SECOND_YEAR].includes(academicYearRaw)) {
        rowErrors.push(`Invalid academicYear '${academicYearRaw}'. Must be FIRST_YEAR or SECOND_YEAR.`);
      }

      // Department & Skills
      const department = (row.department || row['Department'] || '').toString().trim();
      let skills = row.skills || row['Skills'] || [];
      if (typeof skills === 'string') {
        skills = skills.split(/[,;|]/).map(s => s.trim()).filter(Boolean);
      } else if (!Array.isArray(skills)) {
        skills = [];
      }

      // Status
      let status = (row.status || row['Status'] || STATUS.ACTIVE).toString().trim().toUpperCase();
      if (![STATUS.ACTIVE, STATUS.INACTIVE].includes(status)) {
        status = STATUS.ACTIVE;
      }

      if (rowErrors.length > 0) {
        invalidRows.push({
          row: rowNum,
          studentId: studentIdRaw || 'UNKNOWN',
          errors: rowErrors
        });
      } else {
        seenStudentIdsInBatch.add(studentIdRaw);
        if (emailRaw) seenEmailsInBatch.add(emailRaw);

        validStudentsToInsert.push({
          fullName,
          studentId: studentIdRaw,
          email: emailRaw,
          academicYear: academicYearRaw,
          department,
          skills,
          status
        });
      }
    }

    let insertedRecords = [];
    if (validStudentsToInsert.length > 0) {
      insertedRecords = await Student.insertMany(validStudentsToInsert, { ordered: false });
    }

    return {
      totalProcessed: rawList.length,
      successCount: insertedRecords.length,
      failedCount: invalidRows.length,
      createdStudents: insertedRecords,
      errors: invalidRows
    };
  }

  /**
   * Import students from raw CSV text or buffer
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
