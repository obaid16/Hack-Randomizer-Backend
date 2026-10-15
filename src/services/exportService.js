import { TeamGeneration } from '../models/TeamGeneration.js';
import { ApiError } from '../utils/apiError.js';
import { generateCsv } from '../utils/csvHelper.js';

export class ExportService {
  /**
   * Export team generation and leftovers to CSV format
   * @param {string} generationId
   */
  static async exportGenerationToCsv(generationId) {
    const generation = await TeamGeneration.findById(generationId);
    if (!generation) {
      throw ApiError.notFound(`Team generation with ID '${generationId}' not found.`);
    }

    // 1. Team assignments rows
    const teamRows = (generation.teams || []).map(t => {
      const fy1 = t.firstYearStudents?.[0] || {};
      const fy2 = t.firstYearStudents?.[1] || {};
      const sy = t.secondYearStudent || {};
      const mentor = t.mentor || {};

      return {
        section: 'TEAM_ASSIGNMENT',
        teamNumber: t.teamNumber,
        teamName: t.teamName,
        secondYearStudentName: sy.fullName || '',
        secondYearStudentId: sy.studentId || '',
        secondYearDepartment: sy.department || '',
        firstYearStudent1Name: fy1.fullName || '',
        firstYearStudent1Id: fy1.studentId || '',
        firstYearStudent1Department: fy1.department || '',
        firstYearStudent2Name: fy2.fullName || '',
        firstYearStudent2Id: fy2.studentId || '',
        firstYearStudent2Department: fy2.department || '',
        mentorName: mentor.fullName || '',
        mentorId: mentor.mentorId || '',
        mentorExpertise: Array.isArray(mentor.expertise) ? mentor.expertise.join('; ') : ''
      };
    });

    // 2. Leftovers rows
    const leftoverRows = [];

    (generation.leftovers?.secondYears || []).forEach(sy => {
      leftoverRows.push({
        section: 'LEFTOVER_STUDENT',
        teamNumber: 'N/A',
        teamName: 'Unassigned (Second Year)',
        secondYearStudentName: sy.fullName,
        secondYearStudentId: sy.studentId,
        secondYearDepartment: sy.department || '',
        firstYearStudent1Name: '',
        firstYearStudent1Id: '',
        firstYearStudent1Department: '',
        firstYearStudent2Name: '',
        firstYearStudent2Id: '',
        firstYearStudent2Department: '',
        mentorName: '',
        mentorId: '',
        mentorExpertise: ''
      });
    });

    (generation.leftovers?.firstYears || []).forEach(fy => {
      leftoverRows.push({
        section: 'LEFTOVER_STUDENT',
        teamNumber: 'N/A',
        teamName: 'Unassigned (First Year)',
        secondYearStudentName: '',
        secondYearStudentId: '',
        secondYearDepartment: '',
        firstYearStudent1Name: fy.fullName,
        firstYearStudent1Id: fy.studentId,
        firstYearStudent1Department: fy.department || '',
        firstYearStudent2Name: '',
        firstYearStudent2Id: '',
        firstYearStudent2Department: '',
        mentorName: '',
        mentorId: '',
        mentorExpertise: ''
      });
    });

    const columns = [
      { key: 'section', label: 'Record Type' },
      { key: 'teamNumber', label: 'Team #' },
      { key: 'teamName', label: 'Team Name' },
      { key: 'secondYearStudentName', label: 'Second Year Name' },
      { key: 'secondYearStudentId', label: 'Second Year ID' },
      { key: 'secondYearDepartment', label: 'Second Year Dept' },
      { key: 'firstYearStudent1Name', label: 'First Year 1 Name' },
      { key: 'firstYearStudent1Id', label: 'First Year 1 ID' },
      { key: 'firstYearStudent1Department', label: 'First Year 1 Dept' },
      { key: 'firstYearStudent2Name', label: 'First Year 2 Name' },
      { key: 'firstYearStudent2Id', label: 'First Year 2 ID' },
      { key: 'firstYearStudent2Department', label: 'First Year 2 Dept' },
      { key: 'mentorName', label: 'Mentor Name' },
      { key: 'mentorId', label: 'Mentor ID' },
      { key: 'mentorExpertise', label: 'Mentor Expertise' }
    ];

    const allData = [...teamRows, ...leftoverRows];
    const csvContent = generateCsv(allData, columns);

    const safeFilename = `${generation.generationName.replace(/[^a-zA-Z0-9_-]/g, '_')}_export.csv`;

    return {
      csvContent,
      filename: safeFilename
    };
  }
}
