import React, { useState, useRef, useCallback } from 'react';
import {
  Upload,
  X,
  Trash2,
  ZoomIn,
  FileX,
  ImageOff,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Calendar,
  FileText,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { PatientXRay } from '../../types/index.js';
import { api } from '../../lib/api.js';
import { ConfirmDialog } from '../ui/Toast.js';
import { formatDate } from '../../lib/utils.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_FILE_SIZE_MB = 20;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const MAX_FILES = 10;

// MIME types that can be rendered as <img> in the browser
const RENDERABLE_IMAGE_TYPES = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif',
  'image/webp', 'image/bmp',
]);

// All accepted types (tiff and dicom are uploaded but not rendered inline)
const ACCEPTED_TYPES = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif',
  'image/webp', 'image/bmp', 'image/tiff',
  'application/dicom', 'application/octet-stream',
];
const ACCEPT_ATTR = [...ACCEPTED_TYPES, '.dcm', '.tif', '.tiff'].join(',');

// ─── Types ────────────────────────────────────────────────────────────────────

interface QueuedFile {
  file: File;
  previewUrl: string | null; // null for non-renderable types
  error?: string;
}

interface XRaysTabProps {
  patientId: string;
  xrays: PatientXRay[];
  onXRaysChange: (updated: PatientXRay[]) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isRenderable(contentType: string): boolean {
  return RENDERABLE_IMAGE_TYPES.has(contentType.toLowerCase());
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function validateFile(file: File): string | null {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `File is too large (${formatBytes(file.size)}). Maximum size is ${MAX_FILE_SIZE_MB} MB.`;
  }
  const mime = file.type.toLowerCase();
  const isDcm = file.name.toLowerCase().endsWith('.dcm');
  if (!isDcm && !mime.startsWith('image/') && !ACCEPTED_TYPES.includes(mime)) {
    return `File type "${file.type || 'unknown'}" is not accepted. Please upload images (JPEG, PNG, WEBP, GIF, BMP, TIFF) or DICOM files.`;
  }
  return null;
}

// ─── XRaysTab component ───────────────────────────────────────────────────────

export const XRaysTab: React.FC<XRaysTabProps> = ({ patientId, xrays, onXRaysChange }) => {
  // ── Upload queue state ──────────────────────────────────────────────────────
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [uploadNotes, setUploadNotes] = useState('');
  const [uploadTakenAt, setUploadTakenAt] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // ── Lightbox state ──────────────────────────────────────────────────────────
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // ── Delete state ────────────────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<PatientXRay | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── File queue management ───────────────────────────────────────────────────

  const addFilesToQueue = useCallback((incoming: FileList | File[]) => {
    const files = Array.from(incoming);
    const remaining = MAX_FILES - queue.length;
    if (remaining <= 0) {
      setUploadError(`Maximum ${MAX_FILES} files per upload batch.`);
      return;
    }
    const toAdd = files.slice(0, remaining);

    const newEntries: QueuedFile[] = toAdd.map(file => {
      const error = validateFile(file) ?? undefined;
      const previewUrl = !error && isRenderable(file.type)
        ? URL.createObjectURL(file)
        : null;
      return { file, previewUrl, error };
    });

    setQueue(prev => [...prev, ...newEntries]);
    setUploadError('');
    setUploadSuccess(false);
  }, [queue.length]);

  const removeFromQueue = useCallback((idx: number) => {
    setQueue(prev => {
      const entry = prev[idx];
      if (entry?.previewUrl) URL.revokeObjectURL(entry.previewUrl);
      return prev.filter((_, i) => i !== idx);
    });
  }, []);

  const clearQueue = useCallback(() => {
    queue.forEach(e => { if (e.previewUrl) URL.revokeObjectURL(e.previewUrl); });
    setQueue([]);
    setUploadNotes('');
    setUploadTakenAt('');
    setUploadError('');
  }, [queue]);

  // ── Drag-and-drop ───────────────────────────────────────────────────────────

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };
  const handleDragLeave = () => setIsDragOver(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) addFilesToQueue(e.dataTransfer.files);
  };

  // ── Upload ──────────────────────────────────────────────────────────────────

  const handleUpload = async () => {
    const valid = queue.filter(e => !e.error);
    if (valid.length === 0) {
      setUploadError('No valid files to upload.');
      return;
    }
    setUploading(true);
    setUploadError('');
    setUploadSuccess(false);
    try {
      const created = await api.uploadXRays(
        patientId,
        valid.map(e => e.file),
        uploadNotes.trim() || undefined,
        uploadTakenAt || undefined,
      );
      onXRaysChange([...created, ...xrays]);
      setUploadSuccess(true);
      clearQueue();
      setTimeout(() => setUploadSuccess(false), 4000);
    } catch (err: any) {
      setUploadError(err.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  // ── Delete ──────────────────────────────────────────────────────────────────

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.deleteXRay(patientId, deleteTarget.id);
      onXRaysChange(xrays.filter(x => x.id !== deleteTarget.id));
    } catch (err: any) {
      // surface error in upload area — reuse uploadError for simplicity
      setUploadError(err.message || 'Failed to delete X-ray.');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  // ── Lightbox ────────────────────────────────────────────────────────────────

  // Only renderable images appear in the lightbox sequence
  const renderableXRays = xrays.filter(x => isRenderable(x.contentType));

  const openLightbox = (xray: PatientXRay) => {
    const idx = renderableXRays.findIndex(x => x.id === xray.id);
    if (idx !== -1) setLightboxIndex(idx);
  };

  const lightboxPrev = () =>
    setLightboxIndex(i => (i !== null ? (i - 1 + renderableXRays.length) % renderableXRays.length : null));
  const lightboxNext = () =>
    setLightboxIndex(i => (i !== null ? (i + 1) % renderableXRays.length : null));

  // Close lightbox on Escape
  const handleLightboxKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') setLightboxIndex(null);
    if (e.key === 'ArrowLeft') lightboxPrev();
    if (e.key === 'ArrowRight') lightboxNext();
  };

  const validQueueCount = queue.filter(e => !e.error).length;
  const invalidQueueCount = queue.filter(e => !!e.error).length;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 text-xs">

      {/* ── Section header ─────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Radiographic Images / X-Rays
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Upload and manage patient X-ray images. Supports JPEG, PNG, WEBP, GIF, BMP, TIFF, and DICOM (.dcm) formats — up to {MAX_FILE_SIZE_MB} MB per file.
          </p>
        </div>
        <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
          {xrays.length} {xrays.length === 1 ? 'image' : 'images'}
        </span>
      </div>

      {/* ── Upload zone ────────────────────────────────────────── */}
      <div className="border border-slate-200 rounded-xl bg-slate-50/60 p-4 space-y-4">
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Upload New X-Rays
        </div>

        {/* Drop zone */}
        <div
          role="button"
          tabIndex={0}
          aria-label="Drop X-ray files here or click to browse"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors select-none
            ${isDragOver
              ? 'border-blue-800 bg-blue-50'
              : 'border-slate-300 bg-white hover:border-blue-800 hover:bg-blue-50/30'
            }`}
        >
          <Upload className={`w-8 h-8 mx-auto mb-2 ${isDragOver ? 'text-blue-800' : 'text-slate-400'}`} />
          <p className="font-semibold text-slate-700 text-xs">
            Drag & drop X-ray files here, or <span className="text-blue-800 underline">browse files</span>
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            JPEG · PNG · WEBP · GIF · BMP · TIFF · DICOM — max {MAX_FILE_SIZE_MB} MB each, up to {MAX_FILES} files at once
          </p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPT_ATTR}
            className="sr-only"
            onChange={e => { if (e.target.files) { addFilesToQueue(e.target.files); e.target.value = ''; } }}
            aria-hidden="true"
          />
        </div>

        {/* Queued files list */}
        {queue.length > 0 && (
          <div className="space-y-2">
            <div className="text-[11px] font-semibold text-slate-600">
              {queue.length} file{queue.length !== 1 ? 's' : ''} queued
              {invalidQueueCount > 0 && (
                <span className="ml-2 text-rose-700">({invalidQueueCount} with errors — will be skipped)</span>
              )}
            </div>

            <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
              {queue.map((entry, idx) => (
                <div
                  key={idx}
                  className={`flex items-center gap-3 p-2.5 rounded-lg border text-xs
                    ${entry.error
                      ? 'bg-rose-50 border-rose-200'
                      : 'bg-white border-slate-200'
                    }`}
                >
                  {/* Thumbnail or icon */}
                  <div className="w-10 h-10 rounded-md overflow-hidden bg-slate-100 border border-slate-200 shrink-0 flex items-center justify-center">
                    {entry.previewUrl ? (
                      <img src={entry.previewUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <FileX className="w-5 h-5 text-slate-400" />
                    )}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 truncate">{entry.file.name}</p>
                    <p className="text-[10px] text-slate-500">
                      {formatBytes(entry.file.size)} · {entry.file.type || 'unknown type'}
                    </p>
                    {entry.error && (
                      <p className="text-[10px] text-rose-700 font-medium mt-0.5 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 shrink-0" />{entry.error}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); removeFromQueue(idx); }}
                    className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100 shrink-0"
                    aria-label={`Remove ${entry.file.name}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Optional metadata for this batch */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Label / Notes <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={uploadNotes}
                  onChange={e => setUploadNotes(e.target.value)}
                  maxLength={500}
                  placeholder='e.g. "Left bitewing", "PA #19 pre-op"'
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-blue-800 focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Date Taken <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  type="date"
                  value={uploadTakenAt}
                  onChange={e => setUploadTakenAt(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-blue-800 focus:outline-none"
                />
              </div>
            </div>

            {/* Error / success feedback */}
            {uploadError && (
              <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <span>{uploadError}</span>
              </div>
            )}
            {uploadSuccess && (
              <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span className="font-semibold">X-rays uploaded successfully.</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={clearQueue}
                disabled={uploading}
                className="text-xs text-slate-500 hover:text-slate-800 underline disabled:opacity-50"
              >
                Clear all
              </button>
              <button
                type="button"
                onClick={handleUpload}
                disabled={uploading || validQueueCount === 0}
                className="flex items-center gap-2 px-5 py-2 bg-blue-800 hover:bg-blue-900 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs font-semibold shadow-xs"
              >
                {uploading ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /><span>Uploading…</span></>
                ) : (
                  <><Upload className="w-3.5 h-3.5" /><span>Upload {validQueueCount > 0 ? `${validQueueCount} file${validQueueCount !== 1 ? 's' : ''}` : 'Files'}</span></>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Empty-queue error (shown when user clicks Upload without queuing) */}
        {queue.length === 0 && uploadError && (
          <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <span>{uploadError}</span>
          </div>
        )}
        {queue.length === 0 && uploadSuccess && (
          <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span className="font-semibold">X-rays uploaded successfully.</span>
          </div>
        )}
      </div>

      {/* ── Gallery / image list ────────────────────────────────── */}
      {xrays.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400 space-y-2">
          <ImageOff className="w-10 h-10 text-slate-300" />
          <p className="text-sm font-medium text-slate-600">No X-rays uploaded yet</p>
          <p className="text-[11px]">Use the upload zone above to add the first radiographic image.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {xrays.map(xray => {
            const renderable = isRenderable(xray.contentType);
            return (
              <div
                key={xray.id}
                className="group relative bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs hover:shadow-md transition-shadow"
              >
                {/* Image or DICOM placeholder */}
                <div className="aspect-square bg-slate-100 flex items-center justify-center overflow-hidden">
                  {renderable ? (
                    <img
                      src={xray.blobUrl}
                      alt={xray.filename}
                      className="w-full h-full object-cover cursor-zoom-in"
                      onClick={() => openLightbox(xray)}
                      loading="lazy"
                    />
                  ) : (
                    /* DICOM / non-renderable */
                    <div className="flex flex-col items-center gap-2 p-4 text-center">
                      <FileX className="w-10 h-10 text-slate-400" />
                      <span className="text-[10px] font-mono text-slate-500 uppercase">
                        {xray.contentType.includes('dicom') || xray.filename.toLowerCase().endsWith('.dcm')
                          ? 'DICOM'
                          : xray.contentType.split('/')[1]?.toUpperCase() || 'FILE'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Overlay actions (hover) */}
                <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/20 transition-colors pointer-events-none" />
                <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {renderable && (
                    <button
                      type="button"
                      onClick={() => openLightbox(xray)}
                      className="p-1.5 bg-white/90 hover:bg-white text-slate-700 rounded-lg shadow-xs"
                      title="View full size"
                      aria-label="View full size"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(xray)}
                    className="p-1.5 bg-white/90 hover:bg-rose-50 text-rose-600 rounded-lg shadow-xs"
                    title="Delete X-ray"
                    aria-label="Delete X-ray"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Metadata footer */}
                <div className="p-2.5 space-y-0.5">
                  <p className="font-semibold text-slate-800 text-[11px] truncate" title={xray.filename}>
                    {xray.filename}
                  </p>
                  {xray.notes && (
                    <p className="text-[10px] text-blue-800 font-medium flex items-center gap-1 truncate" title={xray.notes}>
                      <FileText className="w-3 h-3 shrink-0" />
                      {xray.notes}
                    </p>
                  )}
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {xray.takenAt ? formatDate(xray.takenAt) : formatDate(xray.createdAt)}
                    </span>
                    <span>{formatBytes(xray.sizeBytes)}</span>
                  </div>
                  <p className="text-[10px] text-slate-400 truncate">↑ {xray.uploadedBy}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Lightbox ───────────────────────────────────────────── */}
      {lightboxIndex !== null && renderableXRays.length > 0 && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="X-ray image viewer"
          className="fixed inset-0 z-[100] bg-slate-950/95 flex items-center justify-center"
          onClick={() => setLightboxIndex(null)}
          onKeyDown={handleLightboxKeyDown}
          tabIndex={0}
        >
          {/* Close button */}
          <button
            type="button"
            onClick={() => setLightboxIndex(null)}
            className="absolute top-4 right-4 p-2 text-white/70 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg z-10"
            aria-label="Close viewer"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Prev / Next */}
          {renderableXRays.length > 1 && (
            <>
              <button
                type="button"
                onClick={e => { e.stopPropagation(); lightboxPrev(); }}
                className="absolute left-4 p-2 text-white/70 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg z-10"
                aria-label="Previous image"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={e => { e.stopPropagation(); lightboxNext(); }}
                className="absolute right-16 p-2 text-white/70 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg z-10"
                aria-label="Next image"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}

          {/* Image */}
          <div
            className="max-w-[90vw] max-h-[85vh] flex flex-col items-center gap-3"
            onClick={e => e.stopPropagation()}
          >
            <img
              src={renderableXRays[lightboxIndex].blobUrl}
              alt={renderableXRays[lightboxIndex].filename}
              className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-2xl"
            />
            <div className="text-center text-white/80 text-xs space-y-0.5">
              <p className="font-semibold text-white">{renderableXRays[lightboxIndex].filename}</p>
              {renderableXRays[lightboxIndex].notes && (
                <p className="text-blue-300">{renderableXRays[lightboxIndex].notes}</p>
              )}
              <p className="text-white/50">
                {renderableXRays[lightboxIndex].takenAt
                  ? `Taken: ${formatDate(renderableXRays[lightboxIndex].takenAt)}`
                  : `Uploaded: ${formatDate(renderableXRays[lightboxIndex].createdAt)}`
                }
                {renderableXRays.length > 1 && ` · ${lightboxIndex + 1} / ${renderableXRays.length}`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirmation dialog ──────────────────────────── */}
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Delete X-Ray Image"
        message={`This will permanently delete "${deleteTarget?.filename ?? ''}" from storage. This action cannot be undone.`}
        confirmLabel={deleting ? 'Deleting…' : 'Delete X-Ray'}
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
