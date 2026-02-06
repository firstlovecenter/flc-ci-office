import ModernDashboardLayout from '@/components/ModernDashboardLayout';

export const metadata = {
    title: 'Profile - FLC CI Office',
    description: 'Manage your profile settings',
};

export default function ProfileLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <ModernDashboardLayout>{children}</ModernDashboardLayout>;
}
