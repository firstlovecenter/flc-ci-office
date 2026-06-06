'use client';

import { useState, useRef } from 'react';
import { Upload, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

const ALLOWED = 'image/jpeg,image/png,image/webp,application/pdf';
const MAX_BYTES = 5 * 1024 * 1024;

interface UploadedReceipt {
    id: string; fileName: string; fileUrl: string; fileMime: string; fileSize: number | null;
    uploadedAt: string; uploader?: { id: string; name: string | null; email: string };
}

interface Props {
    transactionId: string; open: boolean; onClose: () => void; onUploaded: (file: UploadedReceipt) => void;
}

export default function ReceiptUpload({ transactionId, open, onClose, onUploaded }: Props) {
    const [file, setFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const inputRef = useRef<HTMLInputElement | null>(null);

    const reset = () => {
        setFile(null); setError(null); setSubmitting(false);
        if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }
        if (inputRef.current) inputRef.current.value = '';
    };

    const handleClose = () => { if (submitting) return; reset(); onClose(); };

    const handlePick = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0]; setError(null);
        if (!f) { setFile(null); return; }
        if (!ALLOWED.split(',').includes(f.type)) { setError('Unsupported file type. Use JPG, PNG, WEBP, or PDF.'); setFile(null); return; }
        if (f.size > MAX_BYTES) { setError('File is too large. Maximum size is 5 MB.'); setFile(null); return; }
        setFile(f);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(f.type.startsWith('image/') ? URL.createObjectURL(f) : null);
    };

    const handleSubmit = async () => {
        if (!file) return; setSubmitting(true); setError(null);
        try {
            const fd = new FormData(); fd.append('file', file);
            const res = await fetch(`/api/transactions/${transactionId}/receipt`, { method: 'POST', body: fd });
            if (!res.ok) { let msg = 'Failed to upload receipt.'; try { const d = await res.json(); if (d?.error) msg = d.error; } catch {} throw new Error(msg); }
            const created = (await res.json()) as UploadedReceipt;
            onUploaded(created); reset(); onClose();
        } catch (err: any) { setError(err?.message || 'Failed to upload receipt.'); setSubmitting(false); }
    };

    return (
        <Dialog open={open} onOpenChange={v => { if (!v) handleClose(); }}>
            <DialogContent className="max-w-sm">
                <DialogHeader><DialogTitle>Upload receipt</DialogTitle></DialogHeader>
                <div className="flex flex-col gap-4 py-2">
                    <p className="text-sm text-muted-foreground">Attach a photo or PDF of the receipt. Once uploaded, the receipt cannot be replaced.</p>

                    <label className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-sm font-medium cursor-pointer hover:bg-muted/30 transition-colors w-fit ${submitting ? 'opacity-50 pointer-events-none' : ''}`}>
                        <Upload className="h-4 w-4" />
                        {file ? 'Choose a different file' : 'Choose file'}
                        <input ref={inputRef} type="file" hidden accept={ALLOWED} onChange={handlePick} />
                    </label>

                    {file && (
                        <div>
                            <p className="text-sm font-semibold text-foreground">{file.name}</p>
                            <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB · {file.type}</p>
                            {previewUrl ? (
                                <img src={previewUrl} alt="Receipt preview" className="mt-2 max-w-full max-h-72 rounded-xl border border-border" />
                            ) : (
                                <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-border bg-muted/20">
                                    <FileText className="h-5 w-5 text-destructive" />
                                    <p className="text-sm text-muted-foreground">PDF ready to upload</p>
                                </div>
                            )}
                        </div>
                    )}

                    {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
                </div>
                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={handleClose} disabled={submitting}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={!file || submitting}>
                        {submitting ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Uploading…</> : 'Upload Receipt'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
