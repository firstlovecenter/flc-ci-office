import ModernDashboardLayout from '@/components/ModernDashboardLayout';

export const metadata = {
    title: 'Currency Management - FLC CI Office',
    description: 'Manage currencies and exchange rates',
};

export default function CurrenciesLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <ModernDashboardLayout>{children}</ModernDashboardLayout>;
}
