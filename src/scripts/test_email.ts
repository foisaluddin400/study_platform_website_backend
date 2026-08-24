import { env } from "../config/env";
import { emailService } from "../services/email.service";

async function runEmailTest() {
  console.log("================================================================");
  console.log("📧 ABROADPATH OS - PRODUCTION SMTP & EMAIL DELIVERY TEST UTILITY");
  console.log("================================================================");

  console.log("\n📋 Current Active Configuration from .env:");
  console.log(`   • SMTP Host:     ${env.smtpHost || "(not set)"}`);
  console.log(`   • SMTP Port:     ${env.smtpPort}`);
  console.log(`   • TLS / Secure:  ${env.smtpSecure ? "true (SSL/TLS)" : "false (STARTTLS)"}`);
  console.log(`   • SMTP User:     ${env.emailUser ? env.emailUser : "(not set)"}`);
  console.log(`   • SMTP Password: ${env.emailPassword ? "******** (configured)" : "(not set)"}`);
  console.log(`   • From Address:  ${env.emailFromName} <${env.emailFrom}>`);

  const recipient = process.argv[2];

  if (!recipient) {
    console.log("\n💡 Usage Tip:");
    console.log("   Pass an email address to test real delivery:");
    console.log("   npx ts-node src/scripts/test_email.ts your-real-email@gmail.com\n");
  }

  const targetEmail = recipient || "test-delivery@abroadpath.com";

  console.log("\n[Step 1/2] Verifying SMTP Connection & Credentials Handshake...");
  const handshake = await emailService.verifyConnection();

  if (handshake.success) {
    console.log(`✅ ${handshake.message}`);
  } else {
    console.warn(`⚠️  ${handshake.message}`);
    console.log("\n⚠️  Note: If credentials are missing in .env, Nodemailer runs in simulated development mode.");
  }

  console.log(`\n[Step 2/2] Sending Test Email to [${targetEmail}]...`);
  const sendResult = await emailService.sendTestEmail({
    to: targetEmail,
    customMessage: "This is a real delivery test executed via the test_email.ts CLI script.",
  });

  if (sendResult.success) {
    console.log("\n================================================================");
    console.log("🎉 SUCCESS: Email dispatch processed successfully!");
    console.log(`   • Message ID: ${sendResult.messageId}`);
    if (sendResult.response) {
      console.log(`   • Server Response: ${sendResult.response}`);
    }
    console.log("================================================================");
    console.log(`\n📬 Please check the inbox (and spam/promotions folder) for: ${targetEmail}`);
  } else {
    console.error("\n================================================================");
    console.error("❌ FAILURE: Email delivery could not be completed.");
    console.error(`   • Error: ${sendResult.error}`);
    console.error("================================================================");
    console.log("\n🔧 Troubleshooting Tips:");
    console.log("   1. For Gmail: Ensure you are using a 16-character 'Google App Password', NOT your main account password.");
    console.log("   2. For SendGrid: User must be 'apikey' and Pass must be your SendGrid API key starting with 'SG.'");
    console.log("   3. For Port 465: Set SMTP_SECURE=true");
    console.log("   4. For Port 587: Set SMTP_SECURE=false");
  }
}

runEmailTest().catch((err) => {
  console.error("💥 Uncaught test script error:", err);
  process.exit(1);
});
