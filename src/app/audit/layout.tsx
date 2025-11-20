import type { Metadata } from 'next';
import DashboardLayout from '@/components/DashboardLayout';

export const metadata: Metadata = {
    title: 'Audit Trail - FLC CI Office',
    description: 'View system audit logs',
};

export default function AuditLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <DashboardLayout>{children}</DashboardLayout>;
}
