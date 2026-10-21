import { prisma } from '@/lib/prisma';

export interface ApprovalAdmin {
    phone: string | null;
    email: string;
    name: string | null;
}

/**
 * The campus admins who decide an account's withdrawal requests: active users
 * holding CAMPUS_ADMIN on the account or any church above it, up to and
 * including its campus. One entry per user.
 *
 * Shared by the "new request" and "request cancelled" SMS so the admins told
 * about a request are the same ones told when it is withdrawn.
 */
export async function getApprovalAdmins(organisationId: string): Promise<ApprovalAdmin[]> {
    const dept = await prisma.organisation.findUnique({
        where: { id: organisationId },
        include: { parent: { include: { parent: { include: { parent: true } } } } },
    });

    const organisationHierarchy: string[] = [];
    if (dept) {
        organisationHierarchy.push(dept.id);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let currentOrg: any = dept.parent;
        while (currentOrg) {
            organisationHierarchy.push(currentOrg.id);
            if (currentOrg.level === 'CAMPUS') break; // Stop at campus level
            currentOrg = currentOrg.parent;
        }
    }

    const campusAdminRoles = await prisma.userRole.findMany({
        where: { role: 'CAMPUS_ADMIN', organisationId: { in: organisationHierarchy } },
        include: { user: { select: { phone: true, email: true, name: true, archived: true } } },
    });

    return campusAdminRoles
        .filter(ur => !ur.user.archived)
        .reduce((acc: ApprovalAdmin[], ur) => {
            if (!acc.find(a => a.email === ur.user.email)) {
                acc.push({ phone: ur.user.phone, email: ur.user.email, name: ur.user.name });
            }
            return acc;
        }, []);
}
