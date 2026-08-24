import mongoose from "mongoose";
import { University } from "../models/University";
import { Course } from "../models/Course";

export const seedInitialAgencyCatalog = async (agencyId: mongoose.Types.ObjectId): Promise<void> => {
  try {
    const existingCount = await University.countDocuments({ agencyId });
    if (existingCount > 0) return;

    // 1. University of Manchester (UK)
    const uniManchester = new University({
      agencyId,
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
      overview: "A world-renowned research red-brick institution in science, medicine, and technology.",
      requirementsSummary: "Min 65% in Bachelor's or 3.2 CGPA; IELTS 6.5-7.0.",
      avgTuition: "£26,500 - £34,000 / year",
      intakes: ["September 2027", "January 2028"],
      scholarshipsSummary: "Global Futures Scholarship (£5,000 - £10,000).",
      commissionRate: "12.5% of Year 1 Tuition",
    });
    await uniManchester.save();

    await Course.create([
      {
        agencyId,
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
        description: "Cutting-edge curriculum covering machine learning, neural networks, and scalable distributed systems.",
        careerOutcomes: ["AI Research Scientist", "Cloud Systems Architect", "Lead Machine Learning Engineer"],
      },
      {
        agencyId,
        university: uniManchester._id,
        universityName: uniManchester.name,
        universityLogo: uniManchester.logo,
        courseName: "MSc Data Science & Analytics",
        country: "United Kingdom",
        studyLevel: "Master's",
        subjectArea: "Data & Artificial Intelligence",
        duration: "1 Year Full-Time",
        tuitionFee: 29500,
        currency: "GBP",
        ieltsRequirement: "6.5 overall (min 6.0 each band)",
        gpaRequirement: "3.0 / 4.0",
        intakes: ["September 2027"],
        deadline: "June 30, 2027",
        scholarshipAvailable: true,
        scholarshipDetails: "£4,000 Faculty of Science and Engineering Award.",
        description: "Comprehensive training in statistical modeling, big data pipelines, and business intelligence architectures.",
        careerOutcomes: ["Data Scientist", "Business Intelligence Consultant", "Quantitative Analyst"],
      },
    ]);

    // 2. University of Toronto (Canada)
    const uniToronto = new University({
      agencyId,
      name: "University of Toronto",
      logo: "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=100&auto=format&fit=crop&q=80",
      country: "Canada",
      city: "Toronto, Ontario",
      website: "https://www.utoronto.ca",
      ranking: "QS #21 / U15 Canada",
      agentStatus: "Direct Partner",
      activeCoursesCount: 2,
      applicationFee: 125,
      currency: "CAD",
      status: "Active",
      overview: "Canada's leading research intensive university located in downtown Toronto.",
      requirementsSummary: "Min 80% secondary aggregate / 3.4 CGPA in Bachelor's; IELTS 6.5 (no band < 6.0).",
      avgTuition: "CAD $42,000 - $60,000 / year",
      intakes: ["September 2027", "January 2028"],
      scholarshipsSummary: "Lester B. Pearson International Scholarship (Full Ride).",
      commissionRate: "10% of Year 1 Tuition",
    });
    await uniToronto.save();

    await Course.create([
      {
        agencyId,
        university: uniToronto._id,
        universityName: uniToronto.name,
        universityLogo: uniToronto.logo,
        courseName: "Bachelor of Applied Science in Computer Engineering",
        country: "Canada",
        studyLevel: "Bachelor's",
        subjectArea: "Engineering & Technology",
        duration: "4 Years (Co-op Included)",
        tuitionFee: 58000,
        currency: "CAD",
        ieltsRequirement: "6.5 overall (no band < 6.0)",
        gpaRequirement: "85% High School Average in Math/Physics",
        intakes: ["September 2027"],
        deadline: "January 15, 2027",
        scholarshipAvailable: true,
        scholarshipDetails: "President's Scholars of Excellence Program ($10,000).",
        description: "Accredited engineering degree combining computer hardware systems, embedded robotics, and software engineering.",
        careerOutcomes: ["Embedded Systems Engineer", "Robotics Specialist", "Firmware Architect"],
      },
      {
        agencyId,
        university: uniToronto._id,
        universityName: uniToronto.name,
        universityLogo: uniToronto.logo,
        courseName: "Master of Financial Risk Management (MFRM)",
        country: "Canada",
        studyLevel: "Master's",
        subjectArea: "Finance & Economics",
        duration: "10 Months Intensive",
        tuitionFee: 64000,
        currency: "CAD",
        ieltsRequirement: "7.0 overall (no band < 6.5)",
        gpaRequirement: "3.3 / 4.0 with quantitative background",
        intakes: ["September 2027"],
        deadline: "February 28, 2027",
        scholarshipAvailable: true,
        scholarshipDetails: "Rotman Entrance Merit Awards ($5,000 - $20,000).",
        description: "Specialized risk modeling, derivatives valuation, and algorithmic asset management at Rotman School of Management.",
        careerOutcomes: ["Financial Risk Analyst", "Quantitative Trader", "Portfolio Risk Officer"],
      },
    ]);

    // 3. University of Melbourne (Australia)
    const uniMelbourne = new University({
      agencyId,
      name: "University of Melbourne",
      logo: "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=100&auto=format&fit=crop&q=80",
      country: "Australia",
      city: "Melbourne, Victoria",
      website: "https://www.unimelb.edu.au",
      ranking: "QS #14 / Group of Eight",
      agentStatus: "Direct Partner",
      activeCoursesCount: 2,
      applicationFee: 100,
      currency: "AUD",
      status: "Active",
      overview: "Australia's top ranked global research university featuring the Melbourne Curriculum.",
      requirementsSummary: "Min 65% in Bachelor's or 75% in High School; IELTS 6.5 (no band < 6.0).",
      avgTuition: "AUD $44,000 - $52,000 / year",
      intakes: ["February 2027", "July 2027"],
      scholarshipsSummary: "Melbourne International Undergraduate & Graduate Scholarships (up to 100% fee remission).",
      commissionRate: "15% of Year 1 Tuition",
    });
    await uniMelbourne.save();

    await Course.create([
      {
        agencyId,
        university: uniMelbourne._id,
        universityName: uniMelbourne.name,
        universityLogo: uniMelbourne.logo,
        courseName: "Master of Information Technology",
        country: "Australia",
        studyLevel: "Master's",
        subjectArea: "Computer Science & IT",
        duration: "2 Years Full-Time",
        tuitionFee: 49500,
        currency: "AUD",
        ieltsRequirement: "6.5 overall (no band < 6.0)",
        gpaRequirement: "65% Australian equivalent Bachelor's",
        intakes: ["February 2027", "July 2027"],
        deadline: "November 30, 2026",
        scholarshipAvailable: true,
        scholarshipDetails: "Melbourne Graduate Scholarship (AUD $10,000 - $20,000).",
        description: "Specializations in Cyber Security, Artificial Intelligence, Software Engineering, and Distributed Computing.",
        careerOutcomes: ["Full Stack Developer", "Cybersecurity Specialist", "IT Solutions Architect"],
      },
      {
        agencyId,
        university: uniMelbourne._id,
        universityName: uniMelbourne.name,
        universityLogo: uniMelbourne.logo,
        courseName: "Master of International Business",
        country: "Australia",
        studyLevel: "Master's",
        subjectArea: "Business & Management",
        duration: "1.5 - 2 Years",
        tuitionFee: 47800,
        currency: "AUD",
        ieltsRequirement: "6.5 overall (no band < 6.0)",
        gpaRequirement: "65% in undergraduate degree",
        intakes: ["February 2027", "July 2027"],
        deadline: "October 31, 2026",
        scholarshipAvailable: true,
        scholarshipDetails: "Faculty of Business & Economics Global Scholarship.",
        description: "Global strategy, cross-border supply chain management, emerging market expansion, and international negotiations.",
        careerOutcomes: ["Global Trade Manager", "International Management Consultant", "Supply Chain Director"],
      },
    ]);

    // 4. Technical University of Munich (Germany)
    const uniTUM = new University({
      agencyId,
      name: "Technical University of Munich (TUM)",
      logo: "https://images.unsplash.com/photo-1592280771190-3e2e4d571952?w=100&auto=format&fit=crop&q=80",
      country: "Germany",
      city: "Munich, Bavaria",
      website: "https://www.tum.de",
      ranking: "QS #37 / TU9 Germany",
      agentStatus: "Direct Partner",
      activeCoursesCount: 1,
      applicationFee: 0,
      currency: "EUR",
      status: "Active",
      overview: "One of Europe's top technological institutions known for engineering and strong industry ties with BMW, Siemens, and SAP.",
      requirementsSummary: "Bachelor's in relevant STEM field with GRE / Aptitude assessment; IELTS 6.5.",
      avgTuition: "€4,000 - €6,000 / semester",
      intakes: ["Winter (October 2027)", "Summer (April 2028)"],
      scholarshipsSummary: "DAAD Scholarships & TUM Merit Grants.",
      commissionRate: "Fixed €1,200 Placement Assistance Fee",
    });
    await uniTUM.save();

    await Course.create([
      {
        agencyId,
        university: uniTUM._id,
        universityName: uniTUM.name,
        universityLogo: uniTUM.logo,
        courseName: "MSc Robotics, Cognition, Intelligence",
        country: "Germany",
        studyLevel: "Master's",
        subjectArea: "Robotics & AI",
        duration: "2 Years (English Taught)",
        tuitionFee: 6000,
        currency: "EUR",
        ieltsRequirement: "6.5 overall",
        gpaRequirement: "High 2:1 or equivalent STEM Bachelor",
        intakes: ["Winter (October 2027)"],
        deadline: "May 31, 2027",
        scholarshipAvailable: true,
        scholarshipDetails: "DAAD Study Scholarship for Foreign Graduates.",
        description: "Interdisciplinary degree bridging computer vision, cognitive systems, motion planning, and autonomous robotics.",
        careerOutcomes: ["Autonomous Vehicle Engineer", "Computer Vision Specialist", "Robotics Research Scientist"],
      },
    ]);

    console.log(`✅ [Catalog] Seeded initial 4 partner universities and 7 degree programs for agency: ${agencyId}`);
  } catch (err) {
    console.error("Failed to seed initial catalog for agency:", err);
  }
};
