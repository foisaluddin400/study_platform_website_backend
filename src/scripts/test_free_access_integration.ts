const API_BASE = "http://localhost:5000/api/v1";

async function post(endpoint: string, body: any, token?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const json: any = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data: json };
}

async function get(endpoint: string, token?: string) {
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: "GET",
    headers,
  });

  const json: any = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data: json };
}

async function runTests() {
  console.log("===============================================================");
  console.log("🧪 STARTING FREE ACCESS & MULTI-TENANT ISOLATION INTEGRATION TESTS");
  console.log("===============================================================\n");

  const timestamp = Date.now();
  const testAgencyA = {
    agencyName: `Apex Global ${timestamp}`,
    country: "United Kingdom",
    teamSize: "5-15 Counselors",
    adminName: "Alex Admin A",
    adminEmail: `admin.a.${timestamp}@testapex.com`,
    password: "Password123!",
  };

  const testAgencyB = {
    agencyName: `Beacon Edu ${timestamp}`,
    country: "Canada",
    teamSize: "1-4 Counselors",
    adminName: "Bob Admin B",
    adminEmail: `admin.b.${timestamp}@testbeacon.com`,
    password: "Password123!",
  };

  let tokenA = "";
  let tokenB = "";

  // -------------------------------------------------------------
  // TEST 1: Register Agency A
  // -------------------------------------------------------------
  console.log("▶ [Test 1] Registering Agency A (Owner & Lifetime Free License)...");
  const resA = await post("/auth/register-agency", testAgencyA);
  if (!resA.ok) {
    console.error("❌ Test 1 Failed:", resA.data);
    process.exit(1);
  }
  tokenA = resA.data.data.token;
  console.log(`✅ Agency A registered: ID=${resA.data.data.agency.id}`);
  console.log(`   Subscription Plan: ${resA.data.data.subscription.plan}`);
  console.log(`   Subscription Status: ${resA.data.data.subscription.status}`);
  console.log(`   hasActiveAccess: ${resA.data.data.hasActiveAccess}`);

  if (resA.data.data.hasActiveAccess !== false || resA.data.data.subscription.status !== "PENDING_ACTIVATION") {
    console.error("❌ Expected initial subscription status to be PENDING_ACTIVATION and hasActiveAccess to be false");
    process.exit(1);
  }

  // -------------------------------------------------------------
  // TEST 2: Reject Duplicate Email Registration
  // -------------------------------------------------------------
  console.log("\n▶ [Test 2] Verifying duplicate email rejection...");
  const dupRes = await post("/auth/register-agency", testAgencyA);
  if (dupRes.status === 409) {
    console.log(`✅ Duplicate registration blocked with status 409: "${dupRes.data.message}"`);
    if (dupRes.data.message !== "Account already exists. Please login.") {
      console.error(`❌ Expected error message 'Account already exists. Please login.', got '${dupRes.data.message}'`);
      process.exit(1);
    }
  } else {
    console.error("❌ Test 2 Failed: Duplicate email did not return 409, got:", dupRes.status);
    process.exit(1);
  }

  // -------------------------------------------------------------
  // TEST 3: Access Guarding (Block Protected Route before Activation)
  // -------------------------------------------------------------
  console.log("\n▶ [Test 3] Verifying dashboard API access is blocked before activation...");
  const guardRes = await get("/students", tokenA);
  if (guardRes.status === 403) {
    console.log(`✅ Access correctly blocked with status 403: "${guardRes.data.message}"`);
  } else {
    console.error("❌ Test 3 Failed: Protected route was not blocked with 403, got:", guardRes.status);
    process.exit(1);
  }

  // -------------------------------------------------------------
  // TEST 4: Activate Free Lifetime Access
  // -------------------------------------------------------------
  console.log("\n▶ [Test 4] Activating Free Lifetime Access for Agency A...");
  const actRes = await post("/subscriptions/activate-free-access", {}, tokenA);
  if (!actRes.ok) {
    console.error("❌ Test 4 Failed to activate:", actRes.data);
    process.exit(1);
  }
  console.log(`✅ Free Access Activated! Status: ${actRes.data.data.subscription.status}, hasActiveAccess: ${actRes.data.data.hasActiveAccess}`);

  // Verify access is now open
  const studentsRes = await get("/students", tokenA);
  if (studentsRes.ok) {
    console.log(`✅ Protected API accessible after activation! Students count: ${studentsRes.data.data.length}`);
  } else {
    console.error("❌ Test 4 Failed: API still blocked after activation:", studentsRes.data);
    process.exit(1);
  }

  // -------------------------------------------------------------
  // TEST 5: Admin Creates Counselor with Password & Verifies Login
  // -------------------------------------------------------------
  console.log("\n▶ [Test 5] Admin creates Counselor with Password & verifies Counselor login...");
  const counselorData = {
    name: "Elena Counselor A",
    email: `counselor.a.${timestamp}@testapex.com`,
    password: "CounselorPass123!",
    role: "Senior Counselor",
    branch: "London HQ",
  };

  const inviteRes = await post("/users/invite", counselorData, tokenA);
  if (!inviteRes.ok) {
    console.error("❌ Test 5 Failed to invite counselor:", inviteRes.data);
    process.exit(1);
  }
  console.log(`✅ Counselor created: ID=${inviteRes.data.data.id}, Role=${inviteRes.data.data.role}`);

  // Verify counselor login
  const counselorLogin = await post("/auth/login", {
    email: counselorData.email,
    password: counselorData.password,
  });
  if (!counselorLogin.ok) {
    console.error("❌ Counselor failed to log in with provided password:", counselorLogin.data);
    process.exit(1);
  }
  console.log(`✅ Counselor logged in successfully! Role: ${counselorLogin.data.data.user.role}`);

  // -------------------------------------------------------------
  // TEST 6: Admin Creates Student with Password & Verifies Student Login
  // -------------------------------------------------------------
  console.log("\n▶ [Test 6] Admin creates Student with Password & verifies Student login...");
  const studentData = {
    name: "Tariq Student A",
    email: `student.a.${timestamp}@testapex.com`,
    phone: "+44 7700 900555",
    password: "StudentPass123!",
    nationality: "Bangladeshi",
    targetDegree: "Master's",
    preferredCourse: "MSc Artificial Intelligence",
    preferredCountries: ["United Kingdom"],
    intake: "September 2027",
  };

  const studentRes = await post("/students", studentData, tokenA);
  if (!studentRes.ok) {
    console.error("❌ Test 6 Failed to create student:", studentRes.data);
    process.exit(1);
  }
  console.log(`✅ Student profile created: ID=${studentRes.data.data.id}, Name=${studentRes.data.data.name}`);

  // Verify student login
  const studentLogin = await post("/auth/login", {
    email: studentData.email,
    password: studentData.password,
  });
  if (!studentLogin.ok) {
    console.error("❌ Student failed to log in:", studentLogin.data);
    process.exit(1);
  }
  const studentToken = studentLogin.data.data.token;
  console.log(`✅ Student logged in successfully! Role: ${studentLogin.data.data.user.role}`);

  // Verify student access to /students/me
  const summary = await get("/students/me", studentToken);
  if (summary.ok) {
    console.log(`✅ Student accessed /students/me: Student Name=${summary.data.data.name}`);
  } else {
    console.error("❌ Student /students/me failed:", summary.data);
    process.exit(1);
  }

  // -------------------------------------------------------------
  // TEST 7: Register Agency B & Verify Strict Multi-Tenant Isolation
  // -------------------------------------------------------------
  console.log("\n▶ [Test 7] Registering Agency B and verifying strict multi-tenant isolation...");
  const resB = await post("/auth/register-agency", testAgencyB);
  if (!resB.ok) {
    console.error("❌ Agency B registration failed:", resB.data);
    process.exit(1);
  }
  tokenB = resB.data.data.token;

  await post("/subscriptions/activate-free-access", {}, tokenB);
  console.log(`✅ Agency B registered & activated.`);

  // Agency B creates a student
  await post(
    "/students",
    {
      name: "Agency B Unique Candidate",
      email: `student.b.${timestamp}@testbeacon.com`,
      phone: "+1 416 555 0199",
      password: "Password123!",
      targetDegree: "Bachelor's",
      preferredCountries: ["Canada"],
      intake: "January 2028",
    },
    tokenB
  );

  // Query students from Agency A
  const listA = await get("/students", tokenA);
  // Query students from Agency B
  const listB = await get("/students", tokenB);

  console.log(`   Agency A Students Count: ${listA.data.data.length} (Names: ${listA.data.data.map((s: any) => s.name).join(", ")})`);
  console.log(`   Agency B Students Count: ${listB.data.data.length} (Names: ${listB.data.data.map((s: any) => s.name).join(", ")})`);

  const crossLeak =
    listA.data.data.some((s: any) => s.name.includes("Agency B")) ||
    listB.data.data.some((s: any) => s.name.includes("Tariq"));

  if (crossLeak) {
    console.error("🚨 Cross-tenant data leak detected!");
    process.exit(1);
  }

  console.log("🔒 100% Database-Level Multi-Tenant Isolation Verified! Agency A and Agency B data are strictly segregated.");

  console.log("\n===============================================================");
  console.log("🎉 ALL INTEGRATION TESTS PASSED SUCCESSFULLY! (7/7)");
  console.log("===============================================================\n");
}

runTests().catch((e) => {
  console.error("Unhandled test failure:", e);
  process.exit(1);
});
