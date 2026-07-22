export type CoreFeature = {
  key: string
  name: string
  description: string
  category: 'core'
  status: 'active'
}

export const CORE_FEATURE_REGISTRY: readonly CoreFeature[] = [
  { key: 'company-authentication', name: 'Company authentication', description: 'Secure Company sign-in and session access.', category: 'core', status: 'active' },
  { key: 'company-workspace', name: 'Company workspace', description: 'A protected workspace for each Company.', category: 'core', status: 'active' },
  { key: 'todo-management', name: 'Todo management', description: 'Basic task creation and completion tools.', category: 'core', status: 'active' },
  { key: 'standard-dashboard', name: 'Standard dashboard', description: 'Task totals and workspace status at a glance.', category: 'core', status: 'active' },
  { key: 'tenant-isolation', name: 'Tenant isolation', description: 'Company-scoped access enforced by the database.', category: 'core', status: 'active' },
] as const