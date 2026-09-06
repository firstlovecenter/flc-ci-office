'use client';

import { useState, useRef } from 'react';
import { Upload, FileText, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

const ALLOWED = 'image/jpeg,image/png,image/webp,application/pdf';
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_FILES = 10;

interface UploadedReceipt {
    id: string; fileName: string; fileUrl: string; fileMime: string; fileSize: number | null;
    uploadedAt: string; uploader?: { id: string; name: string | null; email: string };
}

interface Props {
    transactionId: string;
    open: boolean;
    onClose: () => void;
    onUploaded: (files: UploadedReceipt[]) => void;
}

export default function ReceiptUpload({ transactionId, open, onClose, onUploaded }: Props) {
    const [files, setFiles] = useState<File[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const inputRef = useRef<HTMLInputElement | null>(null);

    const reset = () => {
        setFiles([]);
        setError(null);
        setSubmitting(false);
        if (inputRef.current) inputRef.current.value = '';
    };

    const handleClose = () => {
        if (submitting) return;
        reset();
        onClose();
    };

    const handlePick = (e: React.ChangeEvent<HTMLInputElement>) => {
        const picked = Array.from(e.target.files || []);
        setError(null);
        if (!picked.length) return;

        const next = [...files];
        for (const f of picked) {
            if (!ALLOWED.split(',').includes(f.type)) {
                setError(`Unsupported file type: ${f.name}. Use JPG, PNG, WEBP, or PDF.`);
                continue;
            }
            if (f.size > MAX_BYTES) {
                setError(`${f.name} is too large. Maximum size is 5 MB.`);
                continue;
            }
            if (next.length >= MAX_FILES) {
                setError(`You can upload at most ${MAX_FILES} files at once.`);
                break;
            }
            next.push(f);
        }
        setFiles(next);
        if (inputRef.current) inputRef.current.value = '';
    };

    const removeAt = (index: number) => {
        setFiles((prev) => prev.filter((_, i) => i !== index));
        setError(null);
    };

    const handleSubmit = async () => {
        if (!files.length) return;
        setSubmitting(true);
        setError(null);
        const created: UploadedReceipt[] = [];
        try {
            for (const file of files) {
                const fd = new FormData();
                fd.append('file', file);
                const res = await fetch(`/api/transactions/${transactionId}/receipt`, {
                    method: 'POST',
                    body: fd,
                });
                if (!res.ok) {
                    let msg = `Failed to upload ${file.name}.`;
                    try {
                        const d = await res.json();
                        if (d?.error) msg = d.error;
                    } catch {}
                    throw new Error(msg);
                }
                created.push((await res.json()) as UploadedReceipt);
            }
            onUploaded(created);
            reset();
            onClose();
        } catch (err: any) {
            if (created.length) onUploaded(created);
            setError(err?.message || 'Failed to upload receipt.');
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
            <DialogContent className="max-w-sm">
                <DialogHeader><DialogTitle>Upload receipts</DialogTitle></DialogHeader>
                <div className="flex flex-col gap-4 py-2">
                    <p className="text-sm text-muted-foreground">
                        Attach one or more photos or PDFs. Each file can be up to 5 MB.
                    </p>

                    <label className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-sm font-medium cursor-pointer hover:bg-muted/30 transition-colors w-fit ${submitting ? 'opacity-50 pointer-events-none' : ''}`}>
                        <Upload className="h-4 w-4" />
                        {files.length ? 'Add more files' : 'Choose files'}
                        <input
                            ref={inputRef}
                            type="file"
                            hidden
                            multiple
                            accept={ALLOWED}
                            onChange={handlePick}
                        />
                    </label>

                    {files.length > 0 && (
                        <ul className="flex flex-col gap-2">
                            {files.map((file, i) => (
                                <li key={`${file.name}-${i}`} className="flex items-start gap-2 rounded-xl border border-border px-3 py-2">
                                    <FileText className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-semibold text-foreground truncate">{file.name}</p>
                                        <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</p>
                                    </div>
                                    {!submitting && (
                                        <button type="button" onClick={() => removeAt(i)} className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/40" aria-label="Remove file">
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}

                    {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
                </div>
                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={handleClose} disabled={submitting}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={!files.length || submitting}>
                        {submitting
                            ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Uploading…</>
                            : files.length > 1 ? `Upload ${files.length} receipts` : 'Upload receipt'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
