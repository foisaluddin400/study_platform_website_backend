import { PlanType } from "../models/Subscription";

export interface PlanConfig {
  name: string;
  maxStudents: number;
  maxCounselors: number;
  maxStorageMb: number;
  features: string[];
}

export const PLAN_LIMITS: Record<PlanType, PlanConfig> = {
  LIFETIME_FREE: {
    name: "Free Access — Lifetime",
    maxStudents: 999999,
    maxCounselors: 999999,
    maxStorageMb: 102400,
    features: [
      "leads_crm",
      "student_portal",
      "university_catalog",
      "kanban_applications",
      "visa_case_tracking",
      "commission_ledger",
      "multi_branch",
      "advanced_analytics",
      "document_vault",
      "email_notifications",
      "counselor_management",
    ],
  },
};

export const getPlanLimits = (_plan?: string): PlanConfig => {
  return PLAN_LIMITS.LIFETIME_FREE;
};
