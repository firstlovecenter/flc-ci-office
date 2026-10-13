import ModernDashboardLayout from '@/components/ModernDashboardLayout';

export const metadata = {
    title: 'Settings - CI Office',
    description: 'System-wide settings',
};

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
    return <ModernDashboardLayout>{children}</ModernDashboardLayout>;
}
