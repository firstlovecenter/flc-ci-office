import ModernDashboardLayout from '@/components/ModernDashboardLayout';

export default function ApprovalsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <ModernDashboardLayout>{children}</ModernDashboardLayout>;
}
