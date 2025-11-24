import type { Metadata } from 'next';
import ModernDashboardLayout from '@/components/ModernDashboardLayout';

export const metadata: Metadata = {
    title: 'Audit Trail - FLC CI Office',
    description: 'View system audit logs',
};

export default function AuditLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <ModernDashboardLayout>{children}</ModernDashboardLayout>;
}
