export interface RequestUserContext {
  userId: string;
  agencyId?: string;
  role: string;
  email?: string;
  name?: string;
  branch?: string;
}

/**
 * Checks whether a counselor (by userId) is assigned to a student record.
 * Handles both single assignment (assignedCounselor) and multiple assignments (assignedCounselors).
 */
export const isCounselorAssignedToStudent = (
  student: any,
  counselorId: string | undefined
): boolean => {
  if (!student || !counselorId) return false;

  const targetId = counselorId.toString();

  // Check single counselor field
  if (student.assignedCounselor) {
    const primaryId =
      typeof student.assignedCounselor === "object"
        ? (student.assignedCounselor._id?.toString() || student.assignedCounselor.id?.toString())
        : student.assignedCounselor.toString();
    if (primaryId === targetId) return true;
  }

  // Check multiple counselors array
  if (Array.isArray(student.assignedCounselors)) {
    const isFound = student.assignedCounselors.some((c: any) => {
      const cId =
        typeof c === "object"
          ? (c._id?.toString() || c.id?.toString())
          : c.toString();
      return cId === targetId;
    });
    if (isFound) return true;
  }

  return false;
};

/**
 * Checks whether the authenticated user has authorization to access private/detail data
 * of a given student record.
 * - PLATFORM_SUPER_ADMIN & AGENCY_ADMIN: Always allowed (unrestricted access)
 * - COUNSELOR: Allowed ONLY IF assigned to the student
 * - STUDENT: Allowed ONLY IF the record belongs to their user account or email
 */
export const canUserAccessStudentPrivateData = (
  user: RequestUserContext | undefined,
  student: any
): boolean => {
  if (!user || !student) return false;

  // Platform super admins and agency admins have unrestricted access
  if (user.role === "PLATFORM_SUPER_ADMIN" || user.role === "AGENCY_ADMIN") {
    return true;
  }

  // Counselors have access only if assigned
  if (user.role === "COUNSELOR") {
    return isCounselorAssignedToStudent(student, user.userId);
  }

  // Students have access to their own data
  if (user.role === "STUDENT") {
    const studentUser =
      typeof student.user === "object"
        ? student.user?._id?.toString() || student.user?.id?.toString()
        : student.user?.toString();
    const studentId = student._id?.toString() || student.id?.toString();
    return (
      studentUser === user.userId ||
      studentId === user.userId ||
      (student.email && user.email && student.email.toLowerCase() === user.email.toLowerCase())
    );
  }

  return false;
};
