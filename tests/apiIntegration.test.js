import test, { describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/app.js';
import { setupTestDB, teardownTestDB, clearTestDB, createTestAdmin } from './testSetup.js';
import { Student } from '../src/models/Student.js';
import { Mentor } from '../src/models/Mentor.js';
import { TeamGeneration } from '../src/models/TeamGeneration.js';
import { ACADEMIC_YEARS } from '../src/constants/academicYears.js';
import { STATUS, GENERATION_STATUS } from '../src/constants/status.js';

describe('API Integration Tests', () => {
  let authToken;
  let adminEmail;
  let currentAdmin;

  before(async () => {
    await setupTestDB();
  });

  after(async () => {
    await teardownTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
    const { token, email, admin } = await createTestAdmin();
    authToken = token;
    adminEmail = email;
    currentAdmin = admin;
  });

  describe('Authentication & Authorization', () => {
    test('rejects unauthenticated request to protected route with 401', async () => {
      const res = await request(app).get('/api/v1/students');
      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /token is required/i);
    });

    test('rejects invalid credentials with 401', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: adminEmail, password: 'WrongPassword' });

      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
    });

    test('successfully logs in with valid credentials', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: adminEmail, password: 'Admin123456!' });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data.token);
      assert.equal(res.body.data.admin.email, adminEmail);
      // Password hash must never be returned!
      assert.equal(res.body.data.admin.passwordHash, undefined);
    });

    test('retrieves current authenticated admin profile (/auth/me)', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${authToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.admin.email, adminEmail);
    });

    test('changes admin password successfully', async () => {
      const res = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ currentPassword: 'Admin123456!', newPassword: 'NewSecurePassword789!' });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);

      // Verify old password fails
      const loginOld = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: adminEmail, password: 'Admin123456!' });
      assert.equal(loginOld.status, 401);

      // Verify new password succeeds
      const loginNew = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: adminEmail, password: 'NewSecurePassword789!' });
      assert.equal(loginNew.status, 200);
    });
  });

  describe('Student Management & Bulk Import', () => {
    test('creates a student and enforces studentId uniqueness', async () => {
      const res = await request(app)
        .post('/api/v1/students')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          fullName: 'Test Student',
          studentId: 'STU-001',
          academicYear: ACADEMIC_YEARS.FIRST_YEAR,
          department: 'CSE'
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.student.studentId, 'STU-001');

      // Attempt duplicate
      const duplicateRes = await request(app)
        .post('/api/v1/students')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          fullName: 'Duplicate Student',
          studentId: 'STU-001',
          academicYear: ACADEMIC_YEARS.FIRST_YEAR
        });

      assert.equal(duplicateRes.status, 409);
      assert.equal(duplicateRes.body.success, false);
    });

    test('bulk import reports invalid rows and duplicates without crashing', async () => {
      // First insert an existing student in DB
      await Student.create({
        fullName: 'Existing Person',
        studentId: 'EXISTING_1',
        academicYear: ACADEMIC_YEARS.FIRST_YEAR
      });

      const bulkPayload = {
        students: [
          {
            fullName: 'Valid One',
            studentId: 'STU-VAL-1',
            academicYear: ACADEMIC_YEARS.FIRST_YEAR,
            department: 'CS'
          },
          {
            fullName: 'Valid Two',
            studentId: 'STU-VAL-2',
            academicYear: ACADEMIC_YEARS.SECOND_YEAR
          },
          {
            fullName: 'Duplicate in DB',
            studentId: 'EXISTING_1',
            academicYear: ACADEMIC_YEARS.FIRST_YEAR
          },
          {
            fullName: 'Invalid Year',
            studentId: 'STU-INV',
            academicYear: 'THIRD_YEAR'
          },
          {
            fullName: 'Duplicate In Batch',
            studentId: 'STU-VAL-1',
            academicYear: ACADEMIC_YEARS.FIRST_YEAR
          }
        ]
      };

      const res = await request(app)
        .post('/api/v1/students/bulk')
        .set('Authorization', `Bearer ${authToken}`)
        .send(bulkPayload);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.totalProcessed, 5);
      assert.equal(res.body.data.successCount, 2);
      assert.equal(res.body.data.failedCount, 3);
      assert.equal(res.body.data.errors.length, 3);
    });

    test('supports CSV file upload for bulk import', async () => {
      const csvContent =
        'Full Name,Student ID,Academic Year,Department,Skills\n' +
        'CSV Student 1,CSV-001,FIRST_YEAR,Computer Science,React; Node\n' +
        'CSV Student 2,CSV-002,SECOND_YEAR,IT,Python';

      const res = await request(app)
        .post('/api/v1/students/bulk')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', Buffer.from(csvContent), 'students.csv');

      assert.equal(res.status, 200);
      assert.equal(res.body.data.successCount, 2);
      assert.equal(res.body.data.failedCount, 0);
    });

    test('safe deletion deactivates student if referenced in generation', async () => {
      const student = await Student.create({
        fullName: 'Historic Student',
        studentId: 'HIST_1',
        academicYear: ACADEMIC_YEARS.SECOND_YEAR
      });

      // Create dummy generation referencing this student
      await TeamGeneration.create({
        generationName: 'Hist Gen',
        generatedBy: currentAdmin._id,
        teamCount: 1,
        teams: [
          {
            teamName: 'Team 1',
            teamNumber: 1,
            secondYearStudent: {
              studentRef: student._id,
              fullName: student.fullName,
              studentId: student.studentId,
              academicYear: student.academicYear
            },
            firstYearStudents: [
              {
                studentRef: student._id,
                fullName: 'Dummy 1',
                studentId: 'DUMMY_1',
                academicYear: ACADEMIC_YEARS.FIRST_YEAR
              },
              {
                studentRef: student._id,
                fullName: 'Dummy 2',
                studentId: 'DUMMY_2',
                academicYear: ACADEMIC_YEARS.FIRST_YEAR
              }
            ],
            mentor: {
              mentorRef: student._id,
              fullName: 'Dummy Mentor',
              mentorId: 'DM_1'
            }
          }
        ]
      });

      const delRes = await request(app)
        .delete(`/api/v1/students/${student._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      assert.equal(delRes.status, 200);
      assert.equal(delRes.body.data.deactivated, true);
      assert.equal(delRes.body.data.deleted, false);

      const refreshed = await Student.findById(student._id);
      assert.equal(refreshed.status, STATUS.INACTIVE);
    });
  });

  describe('Mentor Management', () => {
    test('creates and retrieves active mentors', async () => {
      const res = await request(app)
        .post('/api/v1/mentors')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          fullName: 'Prof. Ada Lovelace',
          mentorId: 'MTR-ADA',
          expertise: ['Algorithms', 'Math']
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.data.mentor.mentorId, 'MTR-ADA');

      const listRes = await request(app)
        .get('/api/v1/mentors')
        .set('Authorization', `Bearer ${authToken}`);

      assert.equal(listRes.status, 200);
      assert.equal(listRes.body.data.mentors.length, 1);
    });
  });

  describe('Team Generation, Regeneration & Team Editing', () => {
    async function seedStudentsAndMentors() {
      // 4 FY, 2 SY, 2 Mentors -> Exactly 2 complete teams
      const fy1 = await Student.create({ fullName: 'FY One', studentId: 'F1', academicYear: ACADEMIC_YEARS.FIRST_YEAR });
      const fy2 = await Student.create({ fullName: 'FY Two', studentId: 'F2', academicYear: ACADEMIC_YEARS.FIRST_YEAR });
      const fy3 = await Student.create({ fullName: 'FY Three', studentId: 'F3', academicYear: ACADEMIC_YEARS.FIRST_YEAR });
      const fy4 = await Student.create({ fullName: 'FY Four', studentId: 'F4', academicYear: ACADEMIC_YEARS.FIRST_YEAR });
      const sy1 = await Student.create({ fullName: 'SY One', studentId: 'S1', academicYear: ACADEMIC_YEARS.SECOND_YEAR });
      const sy2 = await Student.create({ fullName: 'SY Two', studentId: 'S2', academicYear: ACADEMIC_YEARS.SECOND_YEAR });
      const m1 = await Mentor.create({ fullName: 'Mentor One', mentorId: 'M1', status: STATUS.ACTIVE });
      const m2 = await Mentor.create({ fullName: 'Mentor Two', mentorId: 'M2', status: STATUS.ACTIVE });

      return { fy: [fy1, fy2, fy3, fy4], sy: [sy1, sy2], mentors: [m1, m2] };
    }

    test('previews proposed generation without saving to database', async () => {
      await seedStudentsAndMentors();

      const previewRes = await request(app)
        .post('/api/v1/generations/preview')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      assert.equal(previewRes.status, 200);
      assert.equal(previewRes.body.data.preview, true);
      assert.equal(previewRes.body.data.teamCount, 2);

      // Verify no records were saved
      const savedCount = await TeamGeneration.countDocuments();
      assert.equal(savedCount, 0);
    });

    test('generates and persists teams with snapshot preservation', async () => {
      await seedStudentsAndMentors();

      const genRes = await request(app)
        .post('/api/v1/generations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          generationName: 'Annual Hackathon 2026'
        });

      assert.equal(genRes.status, 201);
      assert.equal(genRes.body.success, true);
      assert.equal(genRes.body.data.generation.teamCount, 2);
      assert.equal(genRes.body.data.generation.teams.length, 2);

      const genId = genRes.body.data.generation._id;

      // Edit a student profile directly in Student collection
      await Student.findOneAndUpdate({ studentId: 'S1' }, { fullName: 'MODIFIED NAME' });

      // Retrieve generation: snapshot must retain original historical name!
      const fetched = await request(app)
        .get(`/api/v1/generations/${genId}`)
        .set('Authorization', `Bearer ${authToken}`);

      assert.equal(fetched.status, 200);
      const teamWithS1 = fetched.body.data.generation.teams.find(
        t => t.secondYearStudent.studentId === 'S1'
      );
      assert.equal(teamWithS1.secondYearStudent.fullName, 'SY One');
    });

    test('team editing validates 1+2 composition and duplicate prevention', async () => {
      const data = await seedStudentsAndMentors();

      const genRes = await request(app)
        .post('/api/v1/generations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ generationName: 'Test Gen' });

      const gen = genRes.body.data.generation;
      const teamToEdit = gen.teams[0];
      const otherTeam = gen.teams[1];

      // Attempt invalid composition (e.g. putting a second-year as a first-year)
      const invalidCompRes = await request(app)
        .patch(`/api/v1/generations/${gen._id}/teams/${teamToEdit._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          firstYearStudentIds: [data.sy[0]._id.toString(), data.fy[0]._id.toString()],
          secondYearStudentId: data.sy[1]._id.toString(),
          mentorId: data.mentors[0]._id.toString()
        });

      assert.equal(invalidCompRes.status, 400);
      assert.match(invalidCompRes.body.message, /must belong to FIRST_YEAR/);

      // Attempt duplicate student assignment from other team:
      // Assign otherTeam's second-year student as the second-year of this team
      const dupRes = await request(app)
        .patch(`/api/v1/generations/${gen._id}/teams/${teamToEdit._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          firstYearStudentIds: [
            teamToEdit.firstYearStudents[0].studentRef.toString(),
            teamToEdit.firstYearStudents[1].studentRef.toString()
          ],
          secondYearStudentId: otherTeam.secondYearStudent.studentRef.toString(),
          mentorId: data.mentors[0]._id.toString()
        });

      assert.equal(dupRes.status, 409);
      assert.match(dupRes.body.message, /already assigned to team/);
    });

    test('regeneration archives previous generation and creates a new one', async () => {
      await seedStudentsAndMentors();

      const initialGen = await request(app)
        .post('/api/v1/generations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ generationName: 'Gen 1' });

      const genId = initialGen.body.data.generation._id;

      const regenRes = await request(app)
        .post(`/api/v1/generations/${genId}/regenerate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ confirm: true });

      assert.equal(regenRes.status, 201);
      assert.equal(regenRes.body.success, true);

      // Verify previous generation was preserved with ARCHIVED status
      const oldGen = await TeamGeneration.findById(genId);
      assert.equal(oldGen.status, GENERATION_STATUS.ARCHIVED);

      // Total saved generations is now 2
      const totalGens = await TeamGeneration.countDocuments();
      assert.equal(totalGens, 2);
    });

    test('exports generation and leftovers to CSV format', async () => {
      await seedStudentsAndMentors();

      const genRes = await request(app)
        .post('/api/v1/generations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ generationName: 'Export Test' });

      const genId = genRes.body.data.generation._id;

      const exportRes = await request(app)
        .get(`/api/v1/generations/${genId}/export`)
        .set('Authorization', `Bearer ${authToken}`);

      assert.equal(exportRes.status, 200);
      assert.match(exportRes.headers['content-type'], /text\/csv/);
      assert.match(exportRes.text, /Record Type/);
      assert.match(exportRes.text, /Team Name/);
      assert.match(exportRes.text, /TEAM_ASSIGNMENT/);
    });
  });

  describe('Dashboard Statistics', () => {
    test('calculates live stats accurately', async () => {
      // 5 FY, 3 SY, 2 Mentors -> possible teams = min(floor(5/2), 3) = 2
      await Student.create([
        { fullName: 'F1', studentId: 'F1', academicYear: ACADEMIC_YEARS.FIRST_YEAR },
        { fullName: 'F2', studentId: 'F2', academicYear: ACADEMIC_YEARS.FIRST_YEAR },
        { fullName: 'F3', studentId: 'F3', academicYear: ACADEMIC_YEARS.FIRST_YEAR },
        { fullName: 'F4', studentId: 'F4', academicYear: ACADEMIC_YEARS.FIRST_YEAR },
        { fullName: 'F5', studentId: 'F5', academicYear: ACADEMIC_YEARS.FIRST_YEAR },
        { fullName: 'S1', studentId: 'S1', academicYear: ACADEMIC_YEARS.SECOND_YEAR },
        { fullName: 'S2', studentId: 'S2', academicYear: ACADEMIC_YEARS.SECOND_YEAR },
        { fullName: 'S3', studentId: 'S3', academicYear: ACADEMIC_YEARS.SECOND_YEAR }
      ]);
      await Mentor.create([
        { fullName: 'M1', mentorId: 'M1', status: STATUS.ACTIVE },
        { fullName: 'M2', mentorId: 'M2', status: STATUS.ACTIVE }
      ]);

      const res = await request(app)
        .get('/api/v1/dashboard/stats')
        .set('Authorization', `Bearer ${authToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.data.activeFirstYearStudents, 5);
      assert.equal(res.body.data.activeSecondYearStudents, 3);
      assert.equal(res.body.data.activeMentors, 2);
      assert.equal(res.body.data.possibleTeams, 2);
    });
  });
});
