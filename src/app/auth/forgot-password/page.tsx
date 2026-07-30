'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function ForgotPasswordPage() {
    const router = useRouter();
    const [identifier, setIdentifier] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess(false);
        setLoading(true);

        try {
            const response = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identifier }),
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to send reset instructions');

            setSuccess(true);
            setIdentifier('');
            setTimeout(() => router.push('/auth/reset-password'), 2000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

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
                    Forgot your password?
                </h1>
                <p className="text-sm text-muted-foreground mb-8">
                    Enter the email or phone number on your account. We&apos;ll send a reset code by SMS and email when available.
                </p>

                {error && (
                    <Alert variant="destructive" className="mb-4">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}
                {success && (
                    <Alert variant="success" className="mb-4">
                        <AlertDescription>
                            If an account exists, a reset code has been sent. Redirecting&hellip;
                        </AlertDescription>
                    </Alert>
                )}

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="identifier" className="text-xs text-muted-foreground tracking-[0.02em]">
                            Email or phone
                        </Label>
                        <Input
                            id="identifier"
                            name="identifier"
                            placeholder="email@example.com or 0241234567"
                            autoFocus
                            required
                            value={identifier}
                            onChange={(e) => setIdentifier(e.target.value)}
                            disabled={loading || success}
                        />
                    </div>

                    <Button
                        type="submit"
                        size="lg"
                        className="mt-2 w-full font-medium"
                        disabled={loading || success || !identifier}
                    >
                        {loading ? 'Sending…' : 'Send reset code'}
                    </Button>

                    <div className="flex justify-center mt-3 pt-4 border-t border-border">
                        <Link
                            href="/auth/login"
                            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-150"
                        >
                            <ArrowLeft className="h-3.5 w-3.5" />
                            Back to sign in
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    );
}
