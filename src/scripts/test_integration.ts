import mongoose from "mongoose";
import http from "http";
import app from "../app";
import { env } from "../config/env";

const PORT = 5055;

async function runTests() {
  console.log("==================================================");
  console.log("🧪 RUNNING COMPREHENSIVE INTEGRATION & SECURITY AUDIT");
  console.log("==================================================");

  await mongoose.connect(env.mongoUri);
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(PORT, resolve));
  console.log(`🚀 Test Express server running on port ${PORT}`);

  const baseUrl = `http://localhost:${PORT}/api/v1`;

  const request = async (endpoint: string, options: any = {}, token?: string) => {
    const headers: any = {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    const res = await fetch(`${baseUrl}${endpoint}`, {
      ...options,
      headers,
    });
    const data = await res.json();
    return { status: res.status, data };
  };

  let passed = 0;
  let failed = 0;

  const assert = (condition: boolean, testName: string) => {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      failed++;
    }
  };

  try {
    // 1. Authenticate Tenant 1 Admin
    console.log("\n[Test 1] Tenant 1 Admin Login & Session");
    const adminLogin = await request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "alexandria.v@abroadpath.com", password: "password123" }),
    });
    assert(adminLogin.status === 200 && !!adminLogin.data?.data?.token, "Tenant 1 Admin logs in successfully");
    const adminToken = adminLogin.data?.data?.token;

    const meRes = await request("/auth/me", {}, adminToken);
    assert(meRes.status === 200 && meRes.data?.data?.user?.email === "alexandria.v@abroadpath.com", "Get /auth/me returns admin user");

    // 2. Authenticate Tenant 2 Admin
    console.log("\n[Test 2] Tenant 2 Admin Login & Scoping");
    const apexLogin = await request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "apex.admin@apexadmissions.com", password: "password123" }),
    });
    assert(apexLogin.status === 200 && !!apexLogin.data?.data?.token, "Tenant 2 Admin logs in successfully");
    const apexToken = apexLogin.data?.data?.token;

    // 3. Multi-Tenant Isolation Tests
    console.log("\n[Test 3] Multi-Tenant Data Isolation Audit");
    const t1Students = await request("/students", {}, adminToken);
    const t2Students = await request("/students", {}, apexToken);

    assert(t1Students.status === 200 && Array.isArray(t1Students.data?.data), "Tenant 1 fetches its students");
    assert(t2Students.status === 200 && Array.isArray(t2Students.data?.data), "Tenant 2 fetches its students");

    const t1Ids = (t1Students.data?.data || []).map((s: any) => s.id);
    const t2Ids = (t2Students.data?.data || []).map((s: any) => s.id);

    const hasOverlap = t1Ids.some((id: string) => t2Ids.includes(id));
    assert(!hasOverlap, "Zero student ID overlap between Tenant 1 and Tenant 2");

    // 4. IDOR Protection Test
    if (t1Ids.length > 0) {
      console.log("\n[Test 4] IDOR Cross-Tenant Access Prevention");
      const crossTenantGet = await request(`/students/${t1Ids[0]}`, {}, apexToken);
      assert(crossTenantGet.status === 404, "Tenant 2 attempting to access Tenant 1 student returns 404 Not Found");
    }

    // 5. RBAC Restrictions
    console.log("\n[Test 5] Role-Based Access Control (RBAC)");
    const counselorLogin = await request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "marcus.h@abroadpath.com", password: "password123" }),
    });
    const counselorToken = counselorLogin.data?.data?.token;

    const counselorCommissions = await request("/commissions", {}, counselorToken);
    assert(counselorCommissions.status === 403, "Counselor blocked from /commissions (403 Forbidden)");

    const studentLogin = await request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "student@abroadpath.com", password: "password123" }),
    });
    const studentToken = studentLogin.data?.data?.token;

    const studentTeam = await request("/users/team", {}, studentToken);
    assert(studentTeam.status === 403, "Student blocked from /users/team (403 Forbidden)");

    // 6. Live Core Business Endpoints
    console.log("\n[Test 6] Live MongoDB Business Endpoints");
    const analytics = await request("/analytics/dashboard", {}, adminToken);
    assert(analytics.status === 200 && !!analytics.data?.data?.stats, "Analytics dashboard returns live KPIs");

    const leads = await request("/leads", {}, adminToken);
    assert(leads.status === 200 && Array.isArray(leads.data?.data), "Leads CRM list returns live data");

    const universities = await request("/universities", {}, adminToken);
    assert(universities.status === 200 && universities.data?.data?.length > 0, "Universities directory returns partner unis");

    const courses = await request("/courses", {}, adminToken);
    assert(courses.status === 200 && courses.data?.data?.length > 0, "Courses matcher returns live programs");

    const apps = await request("/applications", {}, adminToken);
    assert(apps.status === 200 && Array.isArray(apps.data?.data), "Applications desk returns live records");

    const offers = await request("/offers", {}, adminToken);
    assert(offers.status === 200 && Array.isArray(offers.data?.data), "Offers desk returns live records");

    const visa = await request("/visa-cases", {}, adminToken);
    assert(visa.status === 200 && Array.isArray(visa.data?.data), "Visa compliance desk returns live records");

    const subscription = await request("/subscriptions/current", {}, adminToken);
    assert(subscription.status === 200 && !!subscription.data?.data?.plan, "Subscription route returns active plan info");

    console.log("\n==================================================");
    console.log(`📊 AUDIT SUMMARY: ${passed} Passed, ${failed} Failed`);
    console.log("==================================================");
  } finally {
    server.close();
    await mongoose.connection.close();
  }
}

runTests().then(() => process.exit(0)).catch((err) => {
  console.error("Test runner encountered an unhandled error", err);
  process.exit(1);
});
