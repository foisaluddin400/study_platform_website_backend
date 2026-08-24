import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { env } from "../config/env";
import { Agency } from "../models/Agency";
import { Subscription } from "../models/Subscription";
import { User } from "../models/User";
import { Lead } from "../models/Lead";
import { Student } from "../models/Student";
import { DocumentModel } from "../models/Document";
import { University } from "../models/University";
import { Course } from "../models/Course";
import { Application } from "../models/Application";
import { Offer } from "../models/Offer";
import { VisaCase } from "../models/VisaCase";
import { Task } from "../models/Task";
import { Appointment } from "../models/Appointment";
import { Payment } from "../models/Payment";
import { Commission } from "../models/Commission";
import { Message } from "../models/Message";
import { Notification } from "../models/Notification";

export const seedDatabase = async () => {
  try {
    console.log("🌱 Connecting to database for seeding...");
    await mongoose.connect(env.mongoUri);
    console.log("🧹 Cleaning up old database collections...");

    await Promise.all([
      Agency.deleteMany({}),
      Subscription.deleteMany({}),
      User.deleteMany({}),
      Lead.deleteMany({}),
      Student.deleteMany({}),
      DocumentModel.deleteMany({}),
      University.deleteMany({}),
      Course.deleteMany({}),
      Application.deleteMany({}),
      Offer.deleteMany({}),
      VisaCase.deleteMany({}),
      Task.deleteMany({}),
      Appointment.deleteMany({}),
      Payment.deleteMany({}),
      Commission.deleteMany({}),
      Message.deleteMany({}),
      Notification.deleteMany({}),
    ]);

    console.log("🏢 Creating Primary Agency: GlobalEd Consulting Partners...");
    const globalEd = new Agency({
      name: "GlobalEd Consulting Partners LLC",
      displayName: "AbroadPath Global Admissions",
      email: "admissions@globaled.com",
      phone: "+44 20 7946 0912",
      address: "88 Kingsway, Holborn, London WC2B 6AA",
      website: "https://www.globaledpartners.com",
      country: "United Kingdom",
      teamSize: "5-15 Counselors",
      baseCurrency: "USD",
      branches: [
        {
          id: "b1",
          name: "London HQ",
          type: "Primary Hub",
          address: "88 Kingsway, Holborn, London WC2B 6AA",
          staffCount: 14,
          activeStudents: 48,
        },
        {
          id: "b2",
          name: "Dubai Regional Hub",
          type: "Regional",
          address: "Office 1402, Al Saada Tower, Business Bay, Dubai",
          staffCount: 8,
          activeStudents: 26,
        },
      ],
    });
    await globalEd.save();

    const sub1 = new Subscription({
      agencyId: globalEd._id,
      plan: "LIFETIME_FREE",
      status: "ACTIVE",
      subscriptionStart: new Date(),
      maxStudents: 999999,
      maxCounselors: 999999,
      maxStorageMb: 102400,
    });
    await sub1.save();

    console.log("👥 Creating Users for GlobalEd...");
    const hashedPassword = await bcrypt.hash("password123", 10);

    const adminUser = new User({
      name: "Alexandria Vance",
      email: "alexandria.v@abroadpath.com",
      password: "password123",
      role: "AGENCY_ADMIN",
      roleTitle: "Agency Director",
      agencyId: globalEd._id,
      branch: "London HQ",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    });
    await adminUser.save();

    const counselor1 = new User({
      name: "Marcus Holloway",
      email: "marcus.h@abroadpath.com",
      password: "password123",
      role: "COUNSELOR",
      roleTitle: "Senior Lead Counselor",
      agencyId: globalEd._id,
      branch: "London HQ",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
    });
    await counselor1.save();

    const counselor2 = new User({
      name: "Sophia Chen",
      email: "sophia.c@abroadpath.com",
      password: "password123",
      role: "COUNSELOR",
      roleTitle: "Senior Counselor",
      agencyId: globalEd._id,
      branch: "Dubai Regional Hub",
      avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80",
    });
    await counselor2.save();

    const studentUser = new User({
      name: "Farhan Tanvir",
      email: "student@abroadpath.com",
      password: "password123",
      role: "STUDENT",
      roleTitle: "Applicant (Master's UK)",
      agencyId: globalEd._id,
      avatar: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80",
    });
    await studentUser.save();

    console.log("🎓 Creating Student Profile...");
    const student1 = new Student({
      agencyId: globalEd._id,
      user: studentUser._id,
      name: "Farhan Tanvir",
      email: "student@abroadpath.com",
      phone: "+44 7700 900142",
      avatar: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80",
      dateOfBirth: "2002-04-12",
      nationality: "Bangladeshi",
      currentAddress: "Flat 4B, 12 Elm Grove, London W5 3JH",
      passportNumber: "A08941298",
      passportExpiry: "2032-08-15",
      targetDegree: "Master's",
      preferredCountries: ["United Kingdom", "Canada"],
      preferredCourse: "MSc Advanced Computer Science & AI",
      intake: "September 2027",
      budgetRange: "£28,000 - £35,000 / year",
      assignedCounselor: counselor1._id,
      currentStage: "Offer",
      journeyProgress: 75,
      applicationStatus: "Conditional Offer",
      visaStatus: "Document Preparation",
      enrollmentYear: 2027,
      academicHistory: [
        {
          degree: "Bachelor of Science in Computer Science",
          institution: "University of Dhaka",
          passingYear: 2025,
          gpa: "3.78 / 4.0",
          country: "Bangladesh",
        },
      ],
      englishProficiency: {
        testType: "IELTS",
        overallScore: "7.5",
        reading: "8.0",
        writing: "7.0",
        listening: "7.5",
        speaking: "7.5",
        testDate: "2026-03-20",
      },
      workExperience: [
        {
          title: "Junior Software Engineer",
          company: "Pathao Technologies",
          duration: "1.5 Years (2025-2026)",
          roleSummary: "Backend microservices in Node.js and distributed cloud databases.",
        },
      ],
      sponsorDetails: {
        name: "Tanvir Ahmed (Father)",
        relationship: "Father",
        occupation: "Managing Director, Textile Export Ltd",
        estimatedFunds: "£42,000",
        bankName: "HSBC UK / Standard Chartered",
      },
    });
    await student1.save();

    console.log("🏛️ Creating Partner Universities & Courses...");
    const uniManchester = new University({
      agencyId: globalEd._id,
      name: "University of Manchester",
      logo: "https://images.unsplash.com/photo-1562774053-701939374585?w=100&auto=format&fit=crop&q=80",
      country: "United Kingdom",
      city: "Manchester",
      website: "https://www.manchester.ac.uk",
      ranking: "QS #32 / Russell Group",
      agentStatus: "Direct Partner",
      activeCoursesCount: 2,
      applicationFee: 60,
      currency: "GBP",
      status: "Active",
      overview: "A world-renowned research red-brick institution in science and technology.",
      requirementsSummary: "Min 65% in Bachelor's or 3.2 CGPA; IELTS 6.5-7.0.",
      avgTuition: "£26,500 - £34,000 / year",
      intakes: ["September 2027", "January 2028"],
      scholarshipsSummary: "Global Futures Scholarship (£5,000 - £10,000).",
      commissionRate: "12.5% of Year 1 Tuition",
    });
    await uniManchester.save();

    const courseCS = new Course({
      agencyId: globalEd._id,
      university: uniManchester._id,
      universityName: uniManchester.name,
      universityLogo: uniManchester.logo,
      courseName: "MSc Advanced Computer Science & AI",
      country: "United Kingdom",
      studyLevel: "Master's",
      subjectArea: "Computer Science & IT",
      duration: "1 Year Full-Time",
      tuitionFee: 31000,
      currency: "GBP",
      ieltsRequirement: "7.0 overall (no band < 6.5)",
      gpaRequirement: "3.2 / 4.0",
      intakes: ["September 2027", "January 2028"],
      deadline: "July 31, 2027",
      scholarshipAvailable: true,
      scholarshipDetails: "£5,000 Merit Award based on undergraduate transcript.",
      description: "Cutting-edge curriculum covering machine learning, deep neural networks, and scalable distributed systems.",
      careerOutcomes: ["AI Research Scientist", "Cloud Systems Architect", "Lead Machine Learning Engineer"],
    });
    await courseCS.save();

    console.log("📝 Creating CRM Leads...");
    const lead1 = new Lead({
      agencyId: globalEd._id,
      name: "Tanzim Hasan",
      email: "tanzim.h@gmail.com",
      phone: "+880 1711 982341",
      avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80",
      countryInterest: ["United Kingdom", "Canada"],
      studyLevel: "Master's",
      preferredCourse: "MSc Data Science & Analytics",
      intake: "September 2027",
      assignedCounselor: counselor1._id,
      status: "Counselling",
      leadSource: "Website Form",
      gpa: "3.65 / 4.0",
      ieltsScore: "7.0",
      notes: [
        {
          id: "n1",
          author: "Marcus Holloway",
          date: "2026-08-22 14:30",
          text: "Student has £30k liquid funds, evaluated Manchester and Birmingham courses.",
        },
      ],
      timeline: [
        {
          id: "t1",
          title: "In-Person Counselling Session",
          description: "Met at London desk for course shortlisting.",
          timestamp: "2026-08-22 14:00",
          type: "meeting",
        },
      ],
    });
    await lead1.save();

    console.log("📋 Creating Applications & Offers...");
    const app1 = new Application({
      agencyId: globalEd._id,
      student: student1._id,
      studentName: student1.name,
      studentAvatar: student1.avatar,
      studentEmail: student1.email,
      university: uniManchester._id,
      universityName: uniManchester.name,
      universityLogo: uniManchester.logo,
      course: courseCS._id,
      courseName: courseCS.courseName,
      country: "United Kingdom",
      intake: "September 2027",
      studyLevel: "Master's",
      applicationFee: 60,
      currency: "GBP",
      feePaid: true,
      status: "Conditional Offer",
      counselor: counselor1._id,
      counselorName: counselor1.name,
      trackingNumber: "APP-MAN-89214",
      notes: "Conditional offer issued awaiting deposit payment.",
      timeline: [
        { title: "Application Submitted to Portal", date: "2026-07-10", completed: true },
        { title: "Departmental Academic Review", date: "2026-07-28", completed: true },
        { title: "Conditional Offer Letter Issued", date: "2026-08-15", completed: true },
      ],
    });
    await app1.save();

    const offer1 = new Offer({
      agencyId: globalEd._id,
      application: app1._id,
      student: student1._id,
      studentName: student1.name,
      studentAvatar: student1.avatar,
      universityName: uniManchester.name,
      universityLogo: uniManchester.logo,
      courseName: courseCS.courseName,
      country: "United Kingdom",
      intake: "September 2027",
      offerType: "Conditional",
      deadline: "October 15, 2026",
      tuitionFee: 31000,
      currency: "GBP",
      depositAmount: 2000,
      depositPaid: false,
      conditions: [
        { id: "c1", text: "Submit final official BSc degree certificate with embossed seal", fulfilled: false },
        { id: "c2", text: "Deposit confirmation of £2,000 to university accounts", fulfilled: false },
      ],
      acceptanceStatus: "Pending",
      offerLetterUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    });
    await offer1.save();

    console.log("🛂 Creating Visa Case...");
    const visa1 = new VisaCase({
      agencyId: globalEd._id,
      student: student1._id,
      studentName: student1.name,
      studentAvatar: student1.avatar,
      country: "United Kingdom",
      visaType: "Student Visa (UK Student Route / Tier 4)",
      targetIntake: "September 2027",
      institutionName: "University of Manchester",
      casOrCoeNumber: "CAS-MAN-902381",
      counselorName: "David Kimani",
      status: "Document Preparation",
      checklist: [
        { id: "v1", item: "Valid Passport", completed: true, required: true },
        { id: "v2", item: "CAS Confirmation Statement", completed: true, required: true },
        { id: "v3", item: "28-Day Bank Statement Audit (£32,500)", completed: false, required: true },
        { id: "v4", item: "Tuberculosis (TB) Test Certificate", completed: false, required: true },
      ],
      timeline: [
        { stage: "Document Preparation", date: "2026-08-20", status: "current", notes: "Awaiting bank statement 28-day holding maturity." },
        { stage: "Visa Submission", date: "Pending", status: "upcoming" },
        { stage: "Biometrics Appointment", date: "Pending", status: "upcoming" },
      ],
      notes: "Student funds are currently holding in Standard Chartered account.",
    });
    await visa1.save();

    console.log("📁 Creating Documents, Tasks, Appointments, Payments & Messages...");
    const doc1 = new DocumentModel({
      agencyId: globalEd._id,
      student: student1._id,
      studentName: student1.name,
      uploadedBy: studentUser._id,
      name: "BSc Official Transcript.pdf",
      fileName: "bsc_transcript_official.pdf",
      storagePath: "uploads/general/dummy.pdf",
      fileUrl: "/api/v1/documents/stream/bsc_transcript.pdf",
      fileSize: "2.4 MB",
      fileType: "PDF",
      category: "Academic",
      status: "Approved",
      reviewer: "Elena Rostova",
    });
    await doc1.save();

    const task1 = new Task({
      agencyId: globalEd._id,
      title: "Verify Manchester deposit receipt",
      description: "Confirm £2,000 bank wire once student completes payment.",
      student: student1._id,
      studentName: student1.name,
      assignedTo: "Marcus Holloway",
      priority: "High",
      dueDate: "Tomorrow",
      category: "Financial",
    });
    await task1.save();

    const appt1 = new Appointment({
      agencyId: globalEd._id,
      title: "Pre-Visa Financial Solvency Review",
      student: student1._id,
      studentName: student1.name,
      counselorName: "Marcus Holloway",
      date: "Tomorrow",
      time: "03:00 PM",
      duration: "45 mins",
      type: "Visa Consultation",
      location: "Zoom Video Call",
      status: "Scheduled",
    });
    await appt1.save();

    const pay1 = new Payment({
      agencyId: globalEd._id,
      invoiceNumber: "INV-2027-0891",
      student: student1._id,
      studentName: student1.name,
      type: "Consultancy Fee",
      amount: 1500,
      currency: "USD",
      dueDate: "2026-09-01",
      paidDate: "2026-08-15",
      status: "Paid",
      paymentMethod: "Credit Card",
      transactionRef: "TXN_8923749812",
    });
    await pay1.save();

    const comm1 = new Commission({
      agencyId: globalEd._id,
      student: student1._id,
      studentName: student1.name,
      universityName: uniManchester.name,
      applicationId: app1.trackingNumber,
      country: "United Kingdom",
      intake: "September 2027",
      tuitionFee: 31000,
      expectedCommission: 3875,
      receivedCommission: 0,
      agencySharePercentage: 70,
      counselorSharePercentage: 30,
      counselorName: "Marcus Holloway",
      status: "Expected",
    });
    await comm1.save();

    const msg1 = new Message({
      agencyId: globalEd._id,
      sender: counselor1._id,
      senderName: "Marcus Holloway",
      senderRole: "counselor",
      student: student1._id,
      text: "Hi Farhan! Manchester released your conditional offer letter. Please review the £2,000 deposit condition due by Oct 15.",
      read: true,
      timestamp: "10:30 AM",
    });
    await msg1.save();

    const notif1 = new Notification({
      agencyId: globalEd._id,
      user: adminUser._id,
      title: "New University Offer Received",
      message: "University of Manchester issued conditional offer for Farhan Tanvir.",
      type: "offer",
      link: "/dashboard/offers",
    });
    await notif1.save();

    // -------------------------------------------------------------
    // Tenant 2: Apex Global Admissions (For Cross-Tenant Isolation)
    // -------------------------------------------------------------
    console.log("🏢 Creating Tenant 2: Apex Global Admissions Ltd...");
    const apexAgency = new Agency({
      name: "Apex Global Admissions Ltd",
      displayName: "Apex Overseas",
      email: "contact@apexadmissions.com",
      phone: "+1 416 555 0199",
      country: "Canada",
    });
    await apexAgency.save();

    const apexAdmin = new User({
      name: "Carlos Mendez",
      email: "apex.admin@apexadmissions.com",
      password: "password123",
      role: "AGENCY_ADMIN",
      roleTitle: "Managing Director",
      agencyId: apexAgency._id,
    });
    await apexAdmin.save();

    const sub2 = new Subscription({
      agencyId: apexAgency._id,
      plan: "LIFETIME_FREE",
      status: "ACTIVE",
      subscriptionStart: new Date(),
      maxStudents: 999999,
      maxCounselors: 999999,
      maxStorageMb: 102400,
    });
    await sub2.save();

    const apexStudent = new Student({
      agencyId: apexAgency._id,
      name: "Sarah Jenkins (Apex Private Student)",
      email: "sarah.j@apexstudent.com",
      phone: "+1 416 555 0122",
      preferredCourse: "MBA Global Management",
      intake: "January 2028",
      targetDegree: "Master's",
      preferredCountries: ["Canada"],
      currentStage: "Lead",
      journeyProgress: 10,
    });
    await apexStudent.save();

    console.log("✅ Seed database finished successfully!");
    console.log("-----------------------------------------------------");
    console.log("🔑 Demo Credentials (Password for all: password123):");
    console.log("1. Agency Admin: alexandria.v@abroadpath.com");
    console.log("2. Counselor:    marcus.h@abroadpath.com");
    console.log("3. Student:      student@abroadpath.com");
    console.log("4. Tenant B:     apex.admin@apexadmissions.com");
    console.log("-----------------------------------------------------");
  } catch (error) {
    console.error("❌ Seeding failed:", error);
  } finally {
    await mongoose.connection.close();
  }
};

if (require.main === module) {
  seedDatabase().then(() => process.exit(0));
}
