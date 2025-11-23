import DashboardLayout from '@/components/DashboardLayout';

export default function ApprovalsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <DashboardLayout>{children}</DashboardLayout>;
}
