export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function nextNumber(prefix: string, existing: number): string {
  return `${prefix}-${String(existing + 1).padStart(4, "0")}`;
}

const APPROVER_ROLES = new Set(["owner", "accounting_lead"]);

export function isApprover(role: string | undefined): boolean {
  return !!role && APPROVER_ROLES.has(role);
}
