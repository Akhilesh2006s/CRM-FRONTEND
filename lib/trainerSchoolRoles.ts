export function canAssignTrainerSchools(role?: string | null) {
  return role === 'Manager' || role === 'Admin' || role === 'Super Admin'
}

export function canApproveTrainerSchools(role?: string | null) {
  return (
    role === 'Coordinator' ||
    role === 'Senior Coordinator' ||
    role === 'Admin' ||
    role === 'Super Admin'
  )
}
