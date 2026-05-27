'use client';

import { useState, useRef } from 'react';
import {
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Box,
    Typography,
    Alert,
    CircularProgress,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';

const ALLOWED = 'image/jpeg,image/png,image/webp,application/pdf';
const MAX_BYTES = 5 * 1024 * 1024;

interface UploadedReceipt {
    id: string;
    fileName: string;
    fileUrl: string;
    fileMime: string;
    fileSize: number | null;
    uploadedAt: string;
    uploader?: { id: string; name: string | null; email: string };
}

interface Props {
    transactionId: string;
    open: boolean;
    onClose: () => void;
    onUploaded: (file: UploadedReceipt) => void;
}

export default function ReceiptUpload({ transactionId, open, onClose, onUploaded }: Props) {
    const [file, setFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const inputRef = useRef<HTMLInputElement | null>(null);

    const reset = () => {
        setFile(null);
        setError(null);
        setSubmitting(false);
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
            setPreviewUrl(null);
        }
        if (inputRef.current) inputRef.current.value = '';
    };

    const handleClose = () => {
        if (submitting) return;
        reset();
        onClose();
    };

    const handlePick = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        setError(null);
        if (!f) {
            setFile(null);
            return;
        }
        if (!ALLOWED.split(',').includes(f.type)) {
            setError('Unsupported file type. Use JPG, PNG, WEBP, or PDF.');
            setFile(null);
            return;
        }
        if (f.size > MAX_BYTES) {
            setError('File is too large. Maximum size is 5 MB.');
            setFile(null);
            return;
        }
        setFile(f);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(f.type.startsWith('image/') ? URL.createObjectURL(f) : null);
    };

    const handleSubmit = async () => {
        if (!file) return;
        setSubmitting(true);
        setError(null);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const res = await fetch(`/api/transactions/${transactionId}/receipt`, {
                method: 'POST',
                body: formData,
            });
            if (!res.ok) {
                let msg = 'Failed to upload receipt.';
                try {
                    const data = await res.json();
                    if (data?.error) msg = data.error;
                } catch {
                    // ignore
                }
                throw new Error(msg);
            }
            const created = (await res.json()) as UploadedReceipt;
            onUploaded(created);
            reset();
            onClose();
        } catch (err: any) {
            setError(err?.message || 'Failed to upload receipt.');
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
            <DialogTitle>Upload receipt</DialogTitle>
            <DialogContent>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Attach a photo or PDF of the receipt. Once uploaded, the receipt cannot be replaced.
                </Typography>

                <Button
                    variant="outlined"
                    component="label"
                    startIcon={<CloudUploadIcon />}
                    disabled={submitting}
                    sx={{ mb: 2 }}
                >
                    {file ? 'Choose a different file' : 'Choose file'}
                    <input
                        ref={inputRef}
                        type="file"
                        hidden
                        accept={ALLOWED}
                        onChange={handlePick}
                    />
                </Button>

                {file && (
                    <Box sx={{ mb: 2 }}>
                        <Typography variant="body2" fontWeight={600}>
                            {file.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            {(file.size / 1024).toFixed(0)} KB · {file.type}
                        </Typography>
                        {previewUrl ? (
                            <Box sx={{ mt: 1.5 }}>
                                <img
                                    src={previewUrl}
                                    alt="Receipt preview"
                                    style={{
                                        maxWidth: '100%',
                                        maxHeight: 320,
                                        borderRadius: 8,
                                        border: '1px solid rgba(0,0,0,0.12)',
                                    }}
                                />
                            </Box>
                        ) : (
                            <Box
                                sx={{
                                    mt: 1.5,
                                    p: 2,
                                    border: '1px dashed rgba(0,0,0,0.2)',
                                    borderRadius: 1,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1.5,
                                }}
                            >
                                <PictureAsPdfIcon color="error" />
                                <Typography variant="body2">PDF ready to upload</Typography>
                            </Box>
                        )}
                    </Box>
                )}

                {error && (
                    <Alert severity="error" sx={{ mt: 1 }}>
                        {error}
                    </Alert>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose} disabled={submitting}>
                    Cancel
                </Button>
                <Button
                    variant="contained"
                    onClick={handleSubmit}
                    disabled={!file || submitting}
                    startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : null}
                >
                    {submitting ? 'Uploading…' : 'Upload Receipt'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
