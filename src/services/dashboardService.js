import { Student } from '../models/Student.js';
import { Mentor } from '../models/Mentor.js';
import { TeamGeneration } from '../models/TeamGeneration.js';
import { STATUS } from '../constants/status.js';
import { ACADEMIC_YEARS } from '../constants/academicYears.js';

export class DashboardService {
  /**
   * Calculate live hackathon dashboard statistics
   */
  static async getStats() {
    const [
      activeFirstYears,
      activeSecondYears,
      activeMentors,
      totalStudents,
      totalMentors,
      savedGenerationsCount,
      latestGeneration
    ] = await Promise.all([
      Student.countDocuments({ academicYear: ACADEMIC_YEARS.FIRST_YEAR, status: STATUS.ACTIVE }),
      Student.countDocuments({ academicYear: ACADEMIC_YEARS.SECOND_YEAR, status: STATUS.ACTIVE }),
      Mentor.countDocuments({ status: STATUS.ACTIVE }),
      Student.countDocuments({}),
      Mentor.countDocuments({}),
      TeamGeneration.countDocuments({}),
      TeamGeneration.findOne({}).sort({ createdAt: -1 }).populate('generatedBy', 'name email')
    ]);

    // Maximum possible teams from currently active students
    const possibleTeams = Math.min(Math.floor(activeFirstYears / 2), activeSecondYears);

    // Calculate assigned and unassigned students from most recent generation if exists
    let currentlyAssignedStudents = 0;
    let currentlyUnassignedStudents = 0;
    let mostRecentGenerationMeta = null;

    if (latestGeneration) {
      currentlyAssignedStudents = (latestGeneration.teams?.length || 0) * 3;
      currentlyUnassignedStudents = latestGeneration.leftovers?.totalLeftovers || 0;

      mostRecentGenerationMeta = {
        id: latestGeneration._id,
        generationName: latestGeneration.generationName,
        teamCount: latestGeneration.teamCount,
        status: latestGeneration.status,
        createdAt: latestGeneration.createdAt,
        generatedBy: latestGeneration.generatedBy
          ? {
              id: latestGeneration.generatedBy._id,
              name: latestGeneration.generatedBy.name,
              email: latestGeneration.generatedBy.email
            }
          : null,
        leftoversCount: latestGeneration.leftovers?.totalLeftovers || 0
      };
    } else {
      // If no generation yet, unassigned is total active students
      currentlyUnassignedStudents = activeFirstYears + activeSecondYears;
    }

    return {
      activeFirstYearStudents: activeFirstYears,
      activeSecondYearStudents: activeSecondYears,
      totalActiveStudents: activeFirstYears + activeSecondYears,
      activeMentors,
      possibleTeams,
      savedGenerationsCount,
      currentlyAssignedStudents,
      currentlyUnassignedStudents,
      totalStudentsInDatabase: totalStudents,
      totalMentorsInDatabase: totalMentors,
      mostRecentGeneration: mostRecentGenerationMeta
    };
  }
}
