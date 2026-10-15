import mongoose from 'mongoose';
import { Student } from '../models/Student.js';
import { Mentor } from '../models/Mentor.js';
import { TeamGeneration } from '../models/TeamGeneration.js';
import { fisherYatesShuffle } from '../utils/shuffle.js';
import { ApiError } from '../utils/apiError.js';
import { STATUS, GENERATION_STATUS } from '../constants/status.js';
import { ACADEMIC_YEARS } from '../constants/academicYears.js';

export class GenerationService {
  /**
   * Helper to build student snapshot
   */
  static toStudentSnapshot(student) {
    return {
      studentRef: student._id,
      fullName: student.fullName,
      studentId: student.studentId,
      email: student.email || null,
      academicYear: student.academicYear,
      department: student.department || '',
      skills: Array.isArray(student.skills) ? student.skills : []
    };
  }

  /**
   * Helper to build mentor snapshot
   */
  static toMentorSnapshot(mentor) {
    return {
      mentorRef: mentor._id,
      fullName: mentor.fullName,
      mentorId: mentor.mentorId,
      email: mentor.email || null,
      expertise: Array.isArray(mentor.expertise) ? mentor.expertise : []
    };
  }

  /**
   * Core generation algorithm (pure logic)
   * @param {object} params
   */
  static runAlgorithm({
    firstYearStudents,
    secondYearStudents,
    mentors,
    requestedTeamCount = null,
    balancedMentorDistribution = true,
    teamNamePrefix = 'Team'
  }) {
    // 1. Validate mentor pool
    if (!mentors || mentors.length === 0) {
      throw ApiError.badRequest('Cannot generate teams: No active mentors available in the pool.');
    }

    const fyCount = firstYearStudents.length;
    const syCount = secondYearStudents.length;

    // 2. Calculate maximum complete teams possible
    const maxPossibleTeams = Math.min(Math.floor(fyCount / 2), syCount);

    if (maxPossibleTeams === 0) {
      const issues = [];
      if (fyCount < 2) {
        issues.push(`Insufficient first-year students: At least 2 active first-year students are required (found ${fyCount})`);
      }
      if (syCount < 1) {
        issues.push(`Insufficient second-year students: At least 1 active second-year student is required (found ${syCount})`);
      }
      throw ApiError.badRequest('Cannot generate any valid teams with the current pool.', issues);
    }

    // 3. Determine final team count
    let targetTeamCount = maxPossibleTeams;
    if (requestedTeamCount !== null && requestedTeamCount !== undefined) {
      if (requestedTeamCount <= 0) {
        throw ApiError.badRequest('Requested team count must be greater than zero.');
      }
      if (requestedTeamCount > maxPossibleTeams) {
        throw ApiError.badRequest(
          `Requested ${requestedTeamCount} teams, but maximum complete teams possible with current pool is ${maxPossibleTeams} (First-years: ${fyCount}, Second-years: ${syCount}).`
        );
      }
      targetTeamCount = requestedTeamCount;
    }

    // 4. Randomly shuffle FY and SY independently using unbiased Fisher-Yates
    const shuffledFY = fisherYatesShuffle(firstYearStudents);
    const shuffledSY = fisherYatesShuffle(secondYearStudents);

    // 5. Mentor distribution calculation
    let assignedMentors = [];
    if (balancedMentorDistribution) {
      const M = mentors.length;
      const T = targetTeamCount;
      const basePerMentor = Math.floor(T / M);
      const remainder = T % M;

      // Shuffle mentors so tie-breaks for who gets (base + 1) teams are randomized
      const shuffledMentors = fisherYatesShuffle(mentors);
      const mentorSlots = [];

      for (let i = 0; i < M; i++) {
        const teamsForThisMentor = i < remainder ? basePerMentor + 1 : basePerMentor;
        for (let j = 0; j < teamsForThisMentor; j++) {
          mentorSlots.push(shuffledMentors[i]);
        }
      }

      // Shuffle mentor assignments across teams so they aren't assigned in blocks
      assignedMentors = fisherYatesShuffle(mentorSlots);
    } else {
      // Pick random mentor for each team
      const shuffledMentors = fisherYatesShuffle(mentors);
      for (let i = 0; i < targetTeamCount; i++) {
        const randomIdx = Math.floor(Math.random() * shuffledMentors.length);
        assignedMentors.push(shuffledMentors[randomIdx]);
      }
    }

    // 6. Build teams
    const teams = [];
    for (let i = 0; i < targetTeamCount; i++) {
      const teamNumber = i + 1;
      const sy = shuffledSY[i];
      const fy1 = shuffledFY[i * 2];
      const fy2 = shuffledFY[i * 2 + 1];
      const mentor = assignedMentors[i];

      teams.push({
        teamName: `${teamNamePrefix} ${teamNumber}`,
        teamNumber,
        secondYearStudent: this.toStudentSnapshot(sy),
        firstYearStudents: [
          this.toStudentSnapshot(fy1),
          this.toStudentSnapshot(fy2)
        ],
        mentor: this.toMentorSnapshot(mentor)
      });
    }

    // 7. Calculate leftovers
    const syLeftovers = shuffledSY.slice(targetTeamCount).map(s => this.toStudentSnapshot(s));
    const fyLeftovers = shuffledFY.slice(targetTeamCount * 2).map(s => this.toStudentSnapshot(s));

    // 8. Mentor statistics summary
    const mentorStats = {};
    teams.forEach(t => {
      const mId = t.mentor.mentorId;
      if (!mentorStats[mId]) {
        mentorStats[mId] = {
          mentorId: mId,
          fullName: t.mentor.fullName,
          teamsCount: 0
        };
      }
      mentorStats[mId].teamsCount += 1;
    });

    return {
      teamCount: targetTeamCount,
      maxPossibleTeams,
      teams,
      leftovers: {
        firstYears: fyLeftovers,
        secondYears: syLeftovers,
        totalLeftovers: fyLeftovers.length + syLeftovers.length
      },
      summary: {
        totalEligibleFirstYears: fyCount,
        totalEligibleSecondYears: syCount,
        totalEligibleMentors: mentors.length,
        assignedFirstYearsCount: targetTeamCount * 2,
        assignedSecondYearsCount: targetTeamCount,
        totalAssignedStudents: targetTeamCount * 3,
        unassignedFirstYearsCount: fyLeftovers.length,
        unassignedSecondYearsCount: syLeftovers.length,
        totalUnassignedStudents: fyLeftovers.length + syLeftovers.length,
        mentorDistribution: Object.values(mentorStats)
      }
    };
  }

  /**
   * Fetch eligible students and mentors taking excludeAssignedStudents settings into account
   */
  static async fetchEligiblePool({ excludeAssignedStudents = false, selectedGenerationId = null }) {
    let excludedStudentIds = new Set();

    if (excludeAssignedStudents) {
      const query = { status: { $ne: GENERATION_STATUS.ARCHIVED } };
      if (selectedGenerationId) {
        query._id = selectedGenerationId;
      }
      const existingGens = await TeamGeneration.find(query, { teams: 1 }).lean();

      for (const gen of existingGens) {
        if (Array.isArray(gen.teams)) {
          for (const t of gen.teams) {
            if (t.secondYearStudent?.studentRef) {
              excludedStudentIds.add(t.secondYearStudent.studentRef.toString());
            }
            if (Array.isArray(t.firstYearStudents)) {
              for (const fy of t.firstYearStudents) {
                if (fy.studentRef) {
                  excludedStudentIds.add(fy.studentRef.toString());
                }
              }
            }
          }
        }
      }
    }

    const studentFilter = { status: STATUS.ACTIVE };
    if (excludedStudentIds.size > 0) {
      studentFilter._id = { $nin: Array.from(excludedStudentIds).map(id => new mongoose.Types.ObjectId(id)) };
    }

    const [allStudents, mentors] = await Promise.all([
      Student.find(studentFilter).lean(),
      Mentor.find({ status: STATUS.ACTIVE }).lean()
    ]);

    const firstYearStudents = allStudents.filter(s => s.academicYear === ACADEMIC_YEARS.FIRST_YEAR);
    const secondYearStudents = allStudents.filter(s => s.academicYear === ACADEMIC_YEARS.SECOND_YEAR);

    return {
      firstYearStudents,
      secondYearStudents,
      mentors,
      excludedCount: excludedStudentIds.size
    };
  }

  /**
   * Preview proposed generation without saving anything to DB
   */
  static async previewGeneration(options = {}) {
    const {
      requestedTeamCount = null,
      balancedMentorDistribution = true,
      excludeAssignedStudents = false,
      selectedGenerationId = null
    } = options;

    const pool = await this.fetchEligiblePool({ excludeAssignedStudents, selectedGenerationId });

    const result = this.runAlgorithm({
      firstYearStudents: pool.firstYearStudents,
      secondYearStudents: pool.secondYearStudents,
      mentors: pool.mentors,
      requestedTeamCount,
      balancedMentorDistribution
    });

    return {
      preview: true,
      ...result,
      settings: {
        requestedTeamCount,
        balancedMentorDistribution,
        excludeAssignedStudents,
        selectedGenerationId
      }
    };
  }

  /**
   * Create and persist finalized team generation
   */
  static async createGeneration(data, adminId) {
    const {
      generationName,
      requestedTeamCount = null,
      balancedMentorDistribution = true,
      excludeAssignedStudents = false,
      selectedGenerationId = null,
      teamNamePrefix = 'Team'
    } = data;

    const pool = await this.fetchEligiblePool({ excludeAssignedStudents, selectedGenerationId });

    const result = this.runAlgorithm({
      firstYearStudents: pool.firstYearStudents,
      secondYearStudents: pool.secondYearStudents,
      mentors: pool.mentors,
      requestedTeamCount,
      balancedMentorDistribution,
      teamNamePrefix
    });

    const generation = await TeamGeneration.create({
      generationName: generationName.trim(),
      generatedBy: adminId,
      teamCount: result.teamCount,
      status: GENERATION_STATUS.CONFIRMED,
      teams: result.teams,
      leftovers: result.leftovers,
      settings: {
        balancedMentorDistribution,
        requestedTeamCount,
        excludeAssignedStudents
      }
    });

    return {
      generation,
      summary: result.summary
    };
  }

  /**
   * Get list of team generations with pagination
   */
  static async getGenerations(queryParams = {}) {
    const {
      page = 1,
      limit = 10,
      status,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = queryParams;

    const filter = {};
    if (status) {
      filter.status = status;
    }

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [generations, total] = await Promise.all([
      TeamGeneration.find(filter)
        .populate('generatedBy', 'name email role')
        .select('-teams.firstYearStudents.skills -teams.secondYearStudent.skills')
        .sort(sort)
        .skip(skip)
        .limit(limit),
      TeamGeneration.countDocuments(filter)
    ]);

    return {
      generations,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1
      }
    };
  }

  /**
   * Get single generation by ID
   */
  static async getGenerationById(id) {
    const generation = await TeamGeneration.findById(id).populate('generatedBy', 'name email role');
    if (!generation) {
      throw ApiError.notFound(`Team generation with ID '${id}' not found.`);
    }
    return generation;
  }

  /**
   * Update an existing team within a generation
   * Validates:
   * 1. Exact 1+2 composition (1 second-year, 2 first-years)
   * 2. No student duplicated within this generation
   * 3. Mentor must be active
   */
  static async updateTeam(generationId, teamId, updateData) {
    const generation = await TeamGeneration.findById(generationId);
    if (!generation) {
      throw ApiError.notFound(`Team generation with ID '${generationId}' not found.`);
    }

    const team = generation.teams.id(teamId);
    if (!team) {
      throw ApiError.notFound(`Team with ID '${teamId}' not found in this generation.`);
    }

    const { firstYearStudentIds, secondYearStudentId, mentorId, teamName } = updateData;

    // Validate distinct students in the request
    if (firstYearStudentIds[0] === firstYearStudentIds[1]) {
      throw ApiError.badRequest('A team cannot contain the same first-year student twice.');
    }
    if (firstYearStudentIds.includes(secondYearStudentId)) {
      throw ApiError.badRequest('A student cannot be assigned as both first-year and second-year.');
    }

    // Fetch student and mentor records
    const [fy1, fy2, sy, mentor] = await Promise.all([
      Student.findById(firstYearStudentIds[0]),
      Student.findById(firstYearStudentIds[1]),
      Student.findById(secondYearStudentId),
      Mentor.findById(mentorId)
    ]);

    if (!fy1 || !fy2) {
      throw ApiError.notFound('One or both specified first-year students do not exist.');
    }
    if (!sy) {
      throw ApiError.notFound('Specified second-year student does not exist.');
    }
    if (!mentor) {
      throw ApiError.notFound('Specified mentor does not exist.');
    }

    // Verify academic years strictly
    if (fy1.academicYear !== ACADEMIC_YEARS.FIRST_YEAR || fy2.academicYear !== ACADEMIC_YEARS.FIRST_YEAR) {
      throw ApiError.badRequest('Both firstYearStudentIds must belong to FIRST_YEAR students.');
    }
    if (sy.academicYear !== ACADEMIC_YEARS.SECOND_YEAR) {
      throw ApiError.badRequest('secondYearStudentId must belong to a SECOND_YEAR student.');
    }

    // Verify active mentor
    if (mentor.status !== STATUS.ACTIVE) {
      throw ApiError.badRequest(`Mentor '${mentor.fullName}' is currently INACTIVE. Only active mentors can be assigned.`);
    }

    // Check duplicate assignment across other teams in this generation
    const newStudentIds = new Set([fy1._id.toString(), fy2._id.toString(), sy._id.toString()]);
    for (const otherTeam of generation.teams) {
      if (otherTeam._id.toString() === teamId) continue;

      const otherSyId = otherTeam.secondYearStudent?.studentRef?.toString();
      if (otherSyId && newStudentIds.has(otherSyId)) {
        throw ApiError.conflict(
          `Student '${otherTeam.secondYearStudent.fullName}' is already assigned to team '${otherTeam.teamName}'.`
        );
      }

      for (const otherFy of otherTeam.firstYearStudents) {
        const otherFyId = otherFy.studentRef?.toString();
        if (otherFyId && newStudentIds.has(otherFyId)) {
          throw ApiError.conflict(
            `Student '${otherFy.fullName}' is already assigned to team '${otherTeam.teamName}'.`
          );
        }
      }
    }

    // Update snapshots
    team.secondYearStudent = this.toStudentSnapshot(sy);
    team.firstYearStudents = [
      this.toStudentSnapshot(fy1),
      this.toStudentSnapshot(fy2)
    ];
    team.mentor = this.toMentorSnapshot(mentor);
    if (teamName) {
      team.teamName = teamName.trim();
    }

    // Recalculate leftovers for this generation
    const assignedStudentIds = new Set();
    for (const t of generation.teams) {
      if (t.secondYearStudent?.studentRef) assignedStudentIds.add(t.secondYearStudent.studentRef.toString());
      if (Array.isArray(t.firstYearStudents)) {
        for (const f of t.firstYearStudents) {
          if (f.studentRef) assignedStudentIds.add(f.studentRef.toString());
        }
      }
    }

    // Filter out newly assigned from leftovers
    generation.leftovers.firstYears = generation.leftovers.firstYears.filter(
      l => !assignedStudentIds.has(l.studentRef.toString())
    );
    generation.leftovers.secondYears = generation.leftovers.secondYears.filter(
      l => !assignedStudentIds.has(l.studentRef.toString())
    );
    generation.leftovers.totalLeftovers =
      generation.leftovers.firstYears.length + generation.leftovers.secondYears.length;

    await generation.save();
    return generation;
  }

  /**
   * Regenerate teams while preserving previous generation history
   * Archives previous generation and creates a brand-new generation
   */
  static async regenerate(previousGenerationId, options, adminId) {
    const previousGen = await TeamGeneration.findById(previousGenerationId);
    if (!previousGen) {
      throw ApiError.notFound(`Previous generation with ID '${previousGenerationId}' not found.`);
    }

    const generationName =
      options.generationName || `${previousGen.generationName} (Regenerated ${new Date().toLocaleTimeString()})`;

    const requestedTeamCount =
      options.requestedTeamCount !== undefined
        ? options.requestedTeamCount
        : previousGen.settings?.requestedTeamCount;

    const balancedMentorDistribution =
      options.balancedMentorDistribution !== undefined
        ? options.balancedMentorDistribution
        : previousGen.settings?.balancedMentorDistribution;

    const excludeAssignedStudents =
      options.excludeAssignedStudents !== undefined
        ? options.excludeAssignedStudents
        : false;

    // Archive previous generation without mutating its team records or deleting it
    previousGen.status = GENERATION_STATUS.ARCHIVED;
    await previousGen.save();

    // Create new generation
    return this.createGeneration(
      {
        generationName,
        requestedTeamCount,
        balancedMentorDistribution,
        excludeAssignedStudents,
        selectedGenerationId: null,
        teamNamePrefix: 'Team'
      },
      adminId
    );
  }
}
