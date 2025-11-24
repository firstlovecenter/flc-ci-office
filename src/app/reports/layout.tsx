import ModernDashboardLayout from '@/components/ModernDashboardLayout';

export default function Layout({ children }: { children: React.ReactNode }) {
    return <ModernDashboardLayout>{children}</ModernDashboardLayout>;
}
