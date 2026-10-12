import { cookies } from 'next/headers';
import { DEMO_EMPLOYEE, DEMO_OPERATOR } from '@/lib/config';

/**
 * DEMONSTRATION ROLES — NOT AUTHENTICATION.
 *
 * In demo mode the presenter can switch between the fictional employee and operator views with a
 * cookie. This is deliberately simple and is clearly labelled in the UI. It must never be used in
 * a production deployment: set DEMO_MODE=false and the role switch is disabled, and every operator
 * endpoint refuses access until real enterprise sign-in (for example Microsoft Entra ID) is added.
 */

export type DemoRole = 'employee' | 'operator';
export const ROLE_COOKIE = 'wf_role';
export const ACCESS_COOKIE = 'wf_access';

export function isDemoMode(): boolean {
  return process.env.DEMO_MODE !== 'false';
}

export async function getDemoRole(): Promise<DemoRole | null> {
  if (!isDemoMode()) return null;
  const value = (await cookies()).get(ROLE_COOKIE)?.value;
  return value === 'employee' || value === 'operator' ? value : null;
}

export function demoIdentity(role: DemoRole) {
  return role === 'operator'
    ? { name: DEMO_OPERATOR.name, title: DEMO_OPERATOR.role, clockNumber: DEMO_OPERATOR.clockNumber }
    : { name: DEMO_EMPLOYEE.name, title: `${DEMO_EMPLOYEE.department} · ${DEMO_EMPLOYEE.productionLine}`, clockNumber: DEMO_EMPLOYEE.clockNumber };
}
