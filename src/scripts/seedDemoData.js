import { connectDB, disconnectDB } from '../config/db.js';
import { Student } from '../models/Student.js';
import { Mentor } from '../models/Mentor.js';
import { ACADEMIC_YEARS } from '../constants/academicYears.js';
import { STATUS } from '../constants/status.js';
import { logger } from '../utils/logger.js';

const DEMO_STUDENTS = [
  // Second-Year Students (8 students)
  { fullName: 'Aarav Sharma', studentId: 'SY-CS-001', academicYear: ACADEMIC_YEARS.SECOND_YEAR, department: 'Computer Science', skills: ['React', 'Node.js', 'System Design'] },
  { fullName: 'Diya Patel', studentId: 'SY-CS-002', academicYear: ACADEMIC_YEARS.SECOND_YEAR, department: 'Computer Science', skills: ['Python', 'Django', 'PostgreSQL'] },
  { fullName: 'Rohan Gupta', studentId: 'SY-IT-003', academicYear: ACADEMIC_YEARS.SECOND_YEAR, department: 'Information Tech', skills: ['Java', 'Spring Boot', 'Docker'] },
  { fullName: 'Ananya Iyer', studentId: 'SY-EC-004', academicYear: ACADEMIC_YEARS.SECOND_YEAR, department: 'Electronics', skills: ['C++', 'Embedded Systems', 'IoT'] },
  { fullName: 'Vikram Singh', studentId: 'SY-CS-005', academicYear: ACADEMIC_YEARS.SECOND_YEAR, department: 'Computer Science', skills: ['Flutter', 'Firebase', 'GraphQL'] },
  { fullName: 'Pooja Reddy', studentId: 'SY-AI-006', academicYear: ACADEMIC_YEARS.SECOND_YEAR, department: 'AI & Data Science', skills: ['PyTorch', 'TensorFlow', 'Data Science'] },
  { fullName: 'Kabir Mehta', studentId: 'SY-IT-007', academicYear: ACADEMIC_YEARS.SECOND_YEAR, department: 'Information Tech', skills: ['Go', 'Kubernetes', 'Microservices'] },
  { fullName: 'Sneha Roy', studentId: 'SY-CS-008', academicYear: ACADEMIC_YEARS.SECOND_YEAR, department: 'Computer Science', skills: ['Vue.js', 'TailwindCSS', 'TypeScript'] },

  // First-Year Students (15 students)
  { fullName: 'Aryan Nair', studentId: 'FY-CS-101', academicYear: ACADEMIC_YEARS.FIRST_YEAR, department: 'Computer Science', skills: ['HTML', 'CSS', 'JavaScript'] },
  { fullName: 'Ishita Sen', studentId: 'FY-CS-102', academicYear: ACADEMIC_YEARS.FIRST_YEAR, department: 'Computer Science', skills: ['Python', 'Basics of Web'] },
  { fullName: 'Aditya Verma', studentId: 'FY-IT-103', academicYear: ACADEMIC_YEARS.FIRST_YEAR, department: 'Information Tech', skills: ['C', 'Data Structures'] },
  { fullName: 'Meera Rao', studentId: 'FY-AI-104', academicYear: ACADEMIC_YEARS.FIRST_YEAR, department: 'AI & Data Science', skills: ['Python', 'Math', 'Pandas'] },
  { fullName: 'Karan Joshi', studentId: 'FY-EC-105', academicYear: ACADEMIC_YEARS.FIRST_YEAR, department: 'Electronics', skills: ['Arduino', 'C++'] },
  { fullName: 'Tanvi Deshmukh', studentId: 'FY-CS-106', academicYear: ACADEMIC_YEARS.FIRST_YEAR, department: 'Computer Science', skills: ['Figma', 'UI/UX', 'HTML'] },
  { fullName: 'Siddharth Pillai', studentId: 'FY-IT-107', academicYear: ACADEMIC_YEARS.FIRST_YEAR, department: 'Information Tech', skills: ['Java', 'SQL'] },
  { fullName: 'Riya Banerjee', studentId: 'FY-CS-108', academicYear: ACADEMIC_YEARS.FIRST_YEAR, department: 'Computer Science', skills: ['JavaScript', 'React Basics'] },
  { fullName: 'Harsh Vardhan', studentId: 'FY-AI-109', academicYear: ACADEMIC_YEARS.FIRST_YEAR, department: 'AI & Data Science', skills: ['Python', 'NumPy'] },
  { fullName: 'Zara Khan', studentId: 'FY-CS-110', academicYear: ACADEMIC_YEARS.FIRST_YEAR, department: 'Computer Science', skills: ['Web Development', 'Git'] },
  { fullName: 'Devansh Pandey', studentId: 'FY-IT-111', academicYear: ACADEMIC_YEARS.FIRST_YEAR, department: 'Information Tech', skills: ['C++', 'Algorithms'] },
  { fullName: 'Sanya Kapoor', studentId: 'FY-CS-112', academicYear: ACADEMIC_YEARS.FIRST_YEAR, department: 'Computer Science', skills: ['JavaScript', 'Express'] },
  { fullName: 'Nikhil Saxena', studentId: 'FY-EC-113', academicYear: ACADEMIC_YEARS.FIRST_YEAR, department: 'Electronics', skills: ['Robotics', 'Python'] },
  { fullName: 'Bhavna Menon', studentId: 'FY-AI-114', academicYear: ACADEMIC_YEARS.FIRST_YEAR, department: 'AI & Data Science', skills: ['Data Analysis', 'SQL'] },
  { fullName: 'Pranav Kulkarni', studentId: 'FY-CS-115', academicYear: ACADEMIC_YEARS.FIRST_YEAR, department: 'Computer Science', skills: ['Frontend', 'CSS Grid'] }
];

const DEMO_MENTORS = [
  { fullName: 'Dr. Ramesh Kumar', mentorId: 'MTR-001', email: 'ramesh.kumar@college.edu', expertise: ['Cloud Architecture', 'DevOps', 'AWS'] },
  { fullName: 'Prof. Sunita Sharma', mentorId: 'MTR-002', email: 'sunita.sharma@college.edu', expertise: ['AI & Machine Learning', 'Computer Vision'] },
  { fullName: 'Dr. Arjun Balakrishnan', mentorId: 'MTR-003', email: 'arjun.b@college.edu', expertise: ['Full Stack Web', 'Cybersecurity'] },
  { fullName: 'Er. Priya Swaminathan', mentorId: 'MTR-004', email: 'priya.s@college.edu', expertise: ['Mobile Development', 'Distributed Systems'] }
];

async function seedDemoData() {
  try {
    await connectDB();

    logger.info('Seeding demo data...');

    // Clear existing demo records if any
    await Student.deleteMany({});
    await Mentor.deleteMany({});

    // Insert demo students
    const createdStudents = await Student.insertMany(DEMO_STUDENTS);
    logger.info(`Successfully seeded ${createdStudents.length} students (8 Second-Year, 15 First-Year).`);

    // Insert demo mentors
    const createdMentors = await Mentor.insertMany(DEMO_MENTORS);
    logger.info(`Successfully seeded ${createdMentors.length} mentors.`);

    logger.info('Demo data seed completed successfully!');
    logger.info('Expected generation capability:');
    logger.info('- Max complete teams: 7 teams (7 SY + 14 FY)');
    logger.info('- Leftovers: 1 SY student, 1 FY student');
  } catch (error) {
    logger.error('Failed to seed demo data:', error);
    process.exit(1);
  } finally {
    await disconnectDB();
    process.exit(0);
  }
}

seedDemoData();
