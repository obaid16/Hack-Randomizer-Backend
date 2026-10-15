import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { GenerationService } from '../src/services/generationService.js';
import { ACADEMIC_YEARS } from '../src/constants/academicYears.js';

function createMockStudent(id, academicYear, name = null) {
  return {
    _id: `id_${id}`,
    studentId: id,
    fullName: name || `Student ${id}`,
    academicYear,
    department: 'CS',
    skills: ['JavaScript']
  };
}

function createMockMentor(id, name = null) {
  return {
    _id: `m_id_${id}`,
    mentorId: id,
    fullName: name || `Mentor ${id}`,
    expertise: ['Web Development']
  };
}

describe('Team Generation Algorithm Unit Tests', () => {
  const mentors = [
    createMockMentor('M1'),
    createMockMentor('M2'),
    createMockMentor('M3')
  ];

  test('generates correct 1+2 composition: exactly 1 SY and 2 FY per team', () => {
    const fyStudents = [
      createMockStudent('FY1', ACADEMIC_YEARS.FIRST_YEAR),
      createMockStudent('FY2', ACADEMIC_YEARS.FIRST_YEAR),
      createMockStudent('FY3', ACADEMIC_YEARS.FIRST_YEAR),
      createMockStudent('FY4', ACADEMIC_YEARS.FIRST_YEAR)
    ];
    const syStudents = [
      createMockStudent('SY1', ACADEMIC_YEARS.SECOND_YEAR),
      createMockStudent('SY2', ACADEMIC_YEARS.SECOND_YEAR)
    ];

    const result = GenerationService.runAlgorithm({
      firstYearStudents: fyStudents,
      secondYearStudents: syStudents,
      mentors
    });

    assert.equal(result.teamCount, 2);
    assert.equal(result.teams.length, 2);

    result.teams.forEach(team => {
      // Exactly 1 second-year
      assert.ok(team.secondYearStudent);
      assert.equal(team.secondYearStudent.academicYear, ACADEMIC_YEARS.SECOND_YEAR);

      // Exactly 2 first-years
      assert.equal(team.firstYearStudents.length, 2);
      team.firstYearStudents.forEach(fy => {
        assert.equal(fy.academicYear, ACADEMIC_YEARS.FIRST_YEAR);
      });

      // Distinct first-years
      assert.notEqual(team.firstYearStudents[0].studentId, team.firstYearStudents[1].studentId);

      // Exactly 1 mentor
      assert.ok(team.mentor);
      assert.ok(team.mentor.mentorId);
    });
  });

  test('prevents student duplicates across all generated teams', () => {
    const fyStudents = Array.from({ length: 10 }, (_, i) =>
      createMockStudent(`FY_${i}`, ACADEMIC_YEARS.FIRST_YEAR)
    );
    const syStudents = Array.from({ length: 5 }, (_, i) =>
      createMockStudent(`SY_${i}`, ACADEMIC_YEARS.SECOND_YEAR)
    );

    const result = GenerationService.runAlgorithm({
      firstYearStudents: fyStudents,
      secondYearStudents: syStudents,
      mentors
    });

    const seenStudentIds = new Set();
    result.teams.forEach(team => {
      assert.equal(seenStudentIds.has(team.secondYearStudent.studentId), false);
      seenStudentIds.add(team.secondYearStudent.studentId);

      team.firstYearStudents.forEach(fy => {
        assert.equal(seenStudentIds.has(fy.studentId), false);
        seenStudentIds.add(fy.studentId);
      });
    });

    assert.equal(seenStudentIds.size, 15); // 5 teams * 3 members = 15 unique students
  });

  test('calculates correct leftovers for uneven pools', () => {
    // 7 FY and 5 SY -> max teams = min(floor(7/2), 5) = 3 teams
    // Assigned: 3 SY, 6 FY -> Leftovers: 2 SY, 1 FY
    const fyStudents = Array.from({ length: 7 }, (_, i) =>
      createMockStudent(`FY_${i}`, ACADEMIC_YEARS.FIRST_YEAR)
    );
    const syStudents = Array.from({ length: 5 }, (_, i) =>
      createMockStudent(`SY_${i}`, ACADEMIC_YEARS.SECOND_YEAR)
    );

    const result = GenerationService.runAlgorithm({
      firstYearStudents: fyStudents,
      secondYearStudents: syStudents,
      mentors
    });

    assert.equal(result.teamCount, 3);
    assert.equal(result.leftovers.firstYears.length, 1);
    assert.equal(result.leftovers.secondYears.length, 2);
    assert.equal(result.leftovers.totalLeftovers, 3);

    // Verify leftover students were not assigned to any team
    const assignedIds = new Set();
    result.teams.forEach(t => {
      assignedIds.add(t.secondYearStudent.studentId);
      t.firstYearStudents.forEach(f => assignedIds.add(f.studentId));
    });

    result.leftovers.firstYears.forEach(f => {
      assert.equal(assignedIds.has(f.studentId), false);
    });
    result.leftovers.secondYears.forEach(s => {
      assert.equal(assignedIds.has(s.studentId), false);
    });
  });

  test('respects requestedTeamCount lower than max possible complete teams', () => {
    // 10 FY and 5 SY -> max teams = 5. But admin requests 2 teams.
    const fyStudents = Array.from({ length: 10 }, (_, i) =>
      createMockStudent(`FY_${i}`, ACADEMIC_YEARS.FIRST_YEAR)
    );
    const syStudents = Array.from({ length: 5 }, (_, i) =>
      createMockStudent(`SY_${i}`, ACADEMIC_YEARS.SECOND_YEAR)
    );

    const result = GenerationService.runAlgorithm({
      firstYearStudents: fyStudents,
      secondYearStudents: syStudents,
      mentors,
      requestedTeamCount: 2
    });

    assert.equal(result.teamCount, 2);
    assert.equal(result.teams.length, 2);
    // 2 teams * 2 FY = 4 FY assigned -> 6 FY leftovers
    assert.equal(result.leftovers.firstYears.length, 6);
    // 2 teams * 1 SY = 2 SY assigned -> 3 SY leftovers
    assert.equal(result.leftovers.secondYears.length, 3);
  });

  test('throws validation error when requestedTeamCount exceeds maximum possible teams', () => {
    const fyStudents = [
      createMockStudent('FY1', ACADEMIC_YEARS.FIRST_YEAR),
      createMockStudent('FY2', ACADEMIC_YEARS.FIRST_YEAR)
    ];
    const syStudents = [
      createMockStudent('SY1', ACADEMIC_YEARS.SECOND_YEAR)
    ];

    assert.throws(() => {
      GenerationService.runAlgorithm({
        firstYearStudents: fyStudents,
        secondYearStudents: syStudents,
        mentors,
        requestedTeamCount: 3
      });
    }, /Requested 3 teams, but maximum complete teams possible/);
  });

  test('throws error when active mentor pool is missing or empty', () => {
    const fyStudents = [
      createMockStudent('FY1', ACADEMIC_YEARS.FIRST_YEAR),
      createMockStudent('FY2', ACADEMIC_YEARS.FIRST_YEAR)
    ];
    const syStudents = [
      createMockStudent('SY1', ACADEMIC_YEARS.SECOND_YEAR)
    ];

    assert.throws(() => {
      GenerationService.runAlgorithm({
        firstYearStudents: fyStudents,
        secondYearStudents: syStudents,
        mentors: []
      });
    }, /No active mentors available/);
  });

  test('throws error when first-year students are insufficient (< 2)', () => {
    const fyStudents = [
      createMockStudent('FY1', ACADEMIC_YEARS.FIRST_YEAR)
    ];
    const syStudents = [
      createMockStudent('SY1', ACADEMIC_YEARS.SECOND_YEAR)
    ];

    assert.throws(() => {
      GenerationService.runAlgorithm({
        firstYearStudents: fyStudents,
        secondYearStudents: syStudents,
        mentors
      });
    }, /Cannot generate any valid teams/);
  });

  test('throws error when second-year students are insufficient (< 1)', () => {
    const fyStudents = [
      createMockStudent('FY1', ACADEMIC_YEARS.FIRST_YEAR),
      createMockStudent('FY2', ACADEMIC_YEARS.FIRST_YEAR)
    ];
    const syStudents = [];

    assert.throws(() => {
      GenerationService.runAlgorithm({
        firstYearStudents: fyStudents,
        secondYearStudents: syStudents,
        mentors
      });
    }, /Cannot generate any valid teams/);
  });

  test('distributes teams as evenly as possible across mentors when balancedMentorDistribution is enabled', () => {
    // 7 teams and 3 mentors -> two mentors get 2 teams, one mentor gets 3 teams
    const fyStudents = Array.from({ length: 14 }, (_, i) =>
      createMockStudent(`FY_${i}`, ACADEMIC_YEARS.FIRST_YEAR)
    );
    const syStudents = Array.from({ length: 7 }, (_, i) =>
      createMockStudent(`SY_${i}`, ACADEMIC_YEARS.SECOND_YEAR)
    );

    const result = GenerationService.runAlgorithm({
      firstYearStudents: fyStudents,
      secondYearStudents: syStudents,
      mentors,
      balancedMentorDistribution: true
    });

    const mentorCounts = {};
    result.teams.forEach(t => {
      mentorCounts[t.mentor.mentorId] = (mentorCounts[t.mentor.mentorId] || 0) + 1;
    });

    const counts = Object.values(mentorCounts);
    // Difference between max and min mentor load should be at most 1
    const minCount = Math.min(...counts);
    const maxCount = Math.max(...counts);
    assert.ok(maxCount - minCount <= 1);
    assert.equal(minCount, 2);
    assert.equal(maxCount, 3);
  });

  test('produces randomized allocation on different runs', () => {
    // With 20 students, two shuffle runs should produce different team orderings
    const fyStudents = Array.from({ length: 20 }, (_, i) =>
      createMockStudent(`FY_${i}`, ACADEMIC_YEARS.FIRST_YEAR)
    );
    const syStudents = Array.from({ length: 10 }, (_, i) =>
      createMockStudent(`SY_${i}`, ACADEMIC_YEARS.SECOND_YEAR)
    );

    const run1 = GenerationService.runAlgorithm({
      firstYearStudents: fyStudents,
      secondYearStudents: syStudents,
      mentors
    });

    const run2 = GenerationService.runAlgorithm({
      firstYearStudents: fyStudents,
      secondYearStudents: syStudents,
      mentors
    });

    const run1Sequence = run1.teams.map(t => `${t.secondYearStudent.studentId}-${t.firstYearStudents[0].studentId}`).join('|');
    const run2Sequence = run2.teams.map(t => `${t.secondYearStudent.studentId}-${t.firstYearStudents[0].studentId}`).join('|');

    assert.notEqual(run1Sequence, run2Sequence);
  });
});
