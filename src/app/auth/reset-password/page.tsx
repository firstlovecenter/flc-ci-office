'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Eye, EyeOff, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

function ResetPasswordForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const urlToken = searchParams.get('token');
    const urlCode = searchParams.get('code');

    const [resetCode, setResetCode] = useState(urlCode || '');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const usingUrlToken = !!(urlToken || urlCode);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess(false);

        if (password !== confirmPassword) { setError('Passwords do not match'); return; }
        if (password.length < 8) { setError('Password must be at least 8 characters long'); return; }
        if (!usingUrlToken && !resetCode.trim()) { setError('Please enter the reset code sent via SMS'); return; }

        setLoading(true);
        try {
            const response = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token: urlToken || urlCode || resetCode.trim().toUpperCase(),
                    password,
                }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to reset password');

            setSuccess(true);
            setTimeout(() => router.push('/auth/login'), 3000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen flex items-center justify-center px-6 sm:px-12 py-10 sm:py-16 bg-background">
                <div className="w-full max-w-[420px] text-center">
                    <div className="w-14 h-14 rounded-full flex items-center justify-center bg-success/10 text-success mx-auto mb-6">
                        <CheckCircle className="h-7 w-7" />
                    </div>
                    <h1 className="text-[1.75rem] sm:text-[2rem] font-semibold tracking-[-0.025em] mb-[5px] text-foreground">
                        Password reset
                    </h1>
                    <p className="text-sm text-muted-foreground mb-8">
                        Your password has been changed. Redirecting to sign in&hellip;
                    </p>
                    <Button
                        size="lg"
                        className="w-full font-medium"
                        onClick={() => router.push('/auth/login')}
                    >
                        Go to sign in
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center px-6 sm:px-12 py-10 sm:py-16 bg-background">
            <div className="w-full max-w-[420px]">
                {/* Brand */}
                <div className="flex items-center gap-3 mb-10">
                    <div className="w-9 h-9 rounded-[5px] border border-border flex items-center justify-center overflow-hidden bg-card">
                        <Image src="/flc-logo.webp" alt="CI Office" width={22} height={22} />
                    </div>
                    <div>
                        <p className="text-[1.0625rem] font-semibold tracking-tight text-foreground">CI Office</p>
                        <p className="text-[0.625rem] font-semibold tracking-[0.18em] uppercase text-primary leading-none">
                            Accounts
                        </p>
                    </div>
                </div>

                <p className="text-[0.6875rem] font-medium tracking-[0.12em] uppercase text-muted-foreground mb-1.5">
                    Account recovery
                </p>
                <h1 className="text-[1.75rem] sm:text-[2rem] font-semibold tracking-[-0.025em] leading-[1.15] mb-[5px] text-foreground">
                    Set a new password
                </h1>
                <p className="text-sm text-muted-foreground mb-8">
                    {usingUrlToken
                        ? 'Choose a new password to continue.'
                        : 'Enter the 6-digit code sent to your phone and a new password.'}
                </p>

                {error && (
                    <Alert variant="destructive" className="mb-4">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    {!usingUrlToken && (
                        <div className="space-y-1.5">
                            <Label htmlFor="resetCode" className="text-xs text-muted-foreground tracking-[0.02em]">
                                Reset code
                            </Label>
                            <Input
                                id="resetCode"
                                name="resetCode"
                                autoComplete="off"
                                autoFocus
                                required
                                value={resetCode}
                                onChange={(e) => setResetCode(e.target.value.toUpperCase())}
                                disabled={loading}
                                placeholder="F823A5"
                                maxLength={6}
                                className="tracking-[0.25em] uppercase"
                            />
                            <p className="text-xs text-muted-foreground">6-character code from the SMS</p>
                        </div>
                    )}

                    <div className="space-y-1.5">
                        <Label htmlFor="password" className="text-xs text-muted-foreground tracking-[0.02em]">
                            New password
                        </Label>
                        <div className="relative">
                            <Input
                                id="password"
                                name="password"
                                type={showPassword ? 'text' : 'password'}
                                autoComplete="new-password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                disabled={loading}
                                className="pr-10"
                            />
                            <button
                                type="button"
                                aria-label="Toggle password visibility"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            >
                                {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                            </button>
                        </div>
                        <p className="text-xs text-muted-foreground">At least 8 characters</p>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="confirmPassword" className="text-xs text-muted-foreground tracking-[0.02em]">
                            Confirm new password
                        </Label>
                        <div className="relative">
                            <Input
                                id="confirmPassword"
                                name="confirmPassword"
                                type={showConfirmPassword ? 'text' : 'password'}
                                autoComplete="new-password"
                                required
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                disabled={loading}
                                className="pr-10"
                            />
                            <button
                                type="button"
                                aria-label="Toggle confirm password visibility"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            >
                                {showConfirmPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                            </button>
                        </div>
                    </div>

                    <Button
                        type="submit"
                        size="lg"
                        className="mt-2 w-full font-medium"
                        disabled={loading || (!usingUrlToken && !resetCode.trim()) || !password || !confirmPassword}
                    >
                        {loading ? 'Resetting…' : 'Reset password'}
                    </Button>

                    <div className="flex justify-center mt-3 pt-4 border-t border-border">
                        <Link
                            href="/auth/login"
                            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-150"
                        >
                            Back to sign in
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-background" />}>
            <ResetPasswordForm />
        </Suspense>
    );
}
