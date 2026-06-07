'use client';

import { signIn, useSession } from 'next-auth/react';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { data: session, status } = useSession();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [logoutMessage, setLogoutMessage] = useState('');

    useEffect(() => {
        if (status === 'authenticated' && session?.user?.id) {
            router.push('/dashboard');
        }
    }, [status, session, router]);

    useEffect(() => {
        const logout = searchParams.get('logout');
        const reason = searchParams.get('reason');
        if (logout === 'true') {
            setLogoutMessage('You have been successfully logged out.');
            setTimeout(() => setLogoutMessage(''), 5000);
        } else if (reason === 'timeout') {
            setLogoutMessage('Your session has expired due to inactivity. Please log in again.');
        }
    }, [searchParams]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const result = await signIn('credentials', { email, password, redirect: false });
            if (result?.error) {
                setError('Invalid email or password');
            } else {
                const response = await fetch('/api/auth/session');
                const s = await response.json();
                if (s?.user?.roles && s.user.roles.length > 1) {
                    router.push('/select-role');
                } else {
                    router.push('/dashboard');
                }
            }
        } catch {
            setError('An error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex bg-background">
            {/* Left — institutional canvas (hidden on mobile) */}
            <div
                className="hidden md:flex flex-[1.05] relative overflow-hidden flex-col justify-between p-12 lg:p-16"
                style={{ backgroundColor: '#0B1320', color: '#F1F3F5' }}
            >
                {/* Brand glow */}
                <div
                    aria-hidden
                    className="absolute inset-0 pointer-events-none"
                    style={{
                        background:
                            'radial-gradient(60% 60% at 100% 100%, rgba(255,66,102,0.20) 0%, transparent 65%), radial-gradient(40% 40% at 0% 0%, rgba(255,90,78,0.08) 0%, transparent 70%)',
                    }}
                />
                {/* Subtle grid */}
                <div
                    aria-hidden
                    className="absolute inset-0 pointer-events-none"
                    style={{
                        backgroundImage:
                            'linear-gradient(rgba(241,243,245,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(241,243,245,0.04) 1px, transparent 1px)',
                        backgroundSize: '64px 64px',
                        maskImage:
                            'radial-gradient(ellipse 80% 60% at 50% 50%, #000 30%, transparent 80%)',
                        WebkitMaskImage:
                            'radial-gradient(ellipse 80% 60% at 50% 50%, #000 30%, transparent 80%)',
                    }}
                />

                {/* Logo */}
                <div className="relative z-10 flex items-center gap-3">
                    <div
                        className="w-9 h-9 rounded-[5px] flex items-center justify-center overflow-hidden"
                        style={{
                            border: '1px solid rgba(241,243,245,0.14)',
                            backgroundColor: 'rgba(241,243,245,0.04)',
                        }}
                    >
                        <Image src="/flc-logo.webp" alt="CI Office" width={22} height={22} />
                    </div>
                    <div className="leading-none">
                        <p
                            className="text-[1.0625rem] font-semibold tracking-tight"
                            style={{ color: '#F1F3F5' }}
                        >
                            CI Office
                        </p>
                        <p
                            className="text-[0.625rem] font-medium tracking-[0.18em] uppercase mt-0.5"
                            style={{ color: '#FF4266' }}
                        >
                            Accounts
                        </p>
                    </div>
                </div>

                {/* Headline */}
                <div className="relative z-10 max-w-[540px]">
                    <p
                        className="text-[0.6875rem] font-medium tracking-[0.18em] uppercase mb-3"
                        style={{ color: '#7CB4A2' }}
                    >
                        Built for stewardship
                    </p>
                    <h1
                        className="text-[2.5rem] lg:text-[3rem] font-semibold tracking-[-0.03em] leading-[1.08] mb-3"
                        style={{ color: '#F1F3F5' }}
                    >
                        Clear books.<br />
                        Confident decisions.
                    </h1>
                    <p
                        className="text-[0.9375rem] leading-relaxed max-w-[460px]"
                        style={{ color: 'rgba(241,243,245,0.65)' }}
                    >
                        A unified ledger across denomination, oversight, campus, stream, and council &mdash;
                        with multi&#8209;currency, approval workflow, and audit trail built in.
                    </p>
                </div>

                {/* Footer */}
                <div
                    className="relative z-10 flex items-center justify-between pt-4"
                    style={{ borderTop: '1px solid rgba(241,243,245,0.10)' }}
                >
                    <p className="text-xs tracking-[0.01em]" style={{ color: 'rgba(241,243,245,0.5)' }}>
                        &copy; {new Date().getFullYear()} CI Office
                    </p>
                    <p
                        className="text-[0.6875rem] tracking-[0.14em] uppercase"
                        style={{ color: 'rgba(241,243,245,0.5)' }}
                    >
                        Secured access
                    </p>
                </div>
            </div>

            {/* Right — sign-in panel */}
            <div className="flex-1 flex items-center justify-center px-6 sm:px-12 py-10 sm:py-16 bg-background">
                <div className="w-full max-w-[420px]">
                    {/* Mobile brand */}
                    <div className="flex md:hidden items-center gap-3 mb-10">
                        <div className="w-9 h-9 rounded-[5px] border border-border flex items-center justify-center overflow-hidden bg-card">
                            <Image src="/flc-logo.webp" alt="CI Office" width={22} height={22} />
                        </div>
                        <div>
                            <p className="text-[1.0625rem] font-semibold tracking-tight text-foreground">
                                CI Office
                            </p>
                            <p className="text-[0.625rem] font-semibold tracking-[0.18em] uppercase text-primary leading-none">
                                Accounts
                            </p>
                        </div>
                    </div>

                    <p className="text-[0.6875rem] font-medium tracking-[0.12em] uppercase text-muted-foreground mb-1.5">
                        Welcome back
                    </p>
                    <h2 className="text-[1.75rem] sm:text-[2rem] font-semibold tracking-[-0.025em] leading-[1.15] mb-[5px] text-foreground">
                        Sign in to your account
                    </h2>
                    <p className="text-sm text-muted-foreground mb-8">
                        Use your registered email.
                    </p>

                    <div className="flex flex-col gap-3 mb-2">
                        {logoutMessage && (
                            <Alert variant="success">
                                <AlertDescription>{logoutMessage}</AlertDescription>
                            </Alert>
                        )}
                        {error && (
                            <Alert variant="destructive">
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}
                    </div>

                    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="email" className="text-xs text-muted-foreground tracking-[0.02em]">
                                Email
                            </Label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-muted-foreground pointer-events-none" />
                                <Input
                                    id="email"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    autoFocus
                                    required
                                    placeholder="you@church.org"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="password" className="text-xs text-muted-foreground tracking-[0.02em]">
                                Password
                            </Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-muted-foreground pointer-events-none" />
                                <Input
                                    id="password"
                                    name="password"
                                    type={showPassword ? 'text' : 'password'}
                                    autoComplete="current-password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="pl-9 pr-10"
                                />
                                <button
                                    type="button"
                                    aria-label="Toggle password visibility"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    {showPassword
                                        ? <EyeOff className="h-[18px] w-[18px]" />
                                        : <Eye className="h-[18px] w-[18px]" />
                                    }
                                </button>
                            </div>
                            <div className="flex justify-end">
                                <Link
                                    href="/auth/forgot-password"
                                    className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    Forgot password?
                                </Link>
                            </div>
                        </div>

                        <Button
                            type="submit"
                            size="lg"
                            className={cn('mt-2 w-full font-medium')}
                            disabled={loading}
                        >
                            {loading ? 'Signing in…' : (
                                <>
                                    Sign in
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </>
                            )}
                        </Button>

                        <div className="flex items-center gap-4 mt-3 pt-4 border-t border-border">
                            <div className="flex-1">
                                <p className="text-xs text-muted-foreground mb-0.5">
                                    Council leader outside Accra?
                                </p>
                                <Link
                                    href="/public-expense"
                                    className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-primary transition-colors duration-150"
                                >
                                    Submit an expense request
                                    <ArrowRight className="h-3.5 w-3.5" />
                                </Link>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-background" />}>
            <LoginForm />
        </Suspense>
    );
}
