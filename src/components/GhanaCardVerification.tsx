import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Upload, Camera, Shield, CheckCircle, Clock,
  FileImage, User, CreditCard, RotateCcw,
  Scan
} from 'lucide-react';
import { toast } from '@/lib/appToast';
import {
  normalizeGhanaCardNumber,
  isValidGhanaCardFormat,
  validateFullNameAsOnCard,
  GHANA_CARD_FORMAT_HINT
} from '@/lib/ghanaCardValidation';
import { api } from '@/lib/api';
import { runDocumentGate, runPassportGate } from '@/lib/biometricPreprocessing';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import {
  loadGhanaCardDraft,
  saveGhanaCardDraft,
  clearGhanaCardDraft,
  type GhanaCardDraftV1,
} from '@/lib/ghanaCardDraftStore';

interface GhanaCardVerificationProps {
  onVerificationComplete: (verificationData: VerificationData) => void;
  userCountry: string;
  /** After a successful PATCH `/users/me`, end the session and return to the sign-in screen (default). */
  signOutAfterSubmit?: boolean;
}

export interface VerificationData {
  frontCardImage: string;
  backCardImage: string;
  faceImage: string;
  cardNumber: string;
  fullName: string;
  status: 'pending' | 'verified' | 'rejected';
  faceMatch?: boolean;
  livenessPassed?: boolean;
  selfieSource?: 'live_camera' | 'upload';
  requiresManualReview?: boolean;
  identityReferenceId?: string;
  /** Backend IVS simulation snapshot (Protocols A & B) — persisted for rule-based settlement */
  smartlandProtocols?: Record<string, unknown>;
  ghanaCard?: {
    cardNumber: string;
    fullName: string;
    frontCardImage?: string;
    backCardImage?: string;
    faceImage?: string;
  };
}

const CARD_NAMES: Record<string, string> = {
  GH: 'Ghana Card',
  NG: 'National ID Card',
  KE: 'Huduma Namba',
  ZA: 'Smart ID Card',
  EG: 'National ID Card',
  MA: 'CNIE (Carte Nationale)',
  ET: 'Ethiopian ID',
  TZ: 'National ID',
  UG: 'National ID',
  RW: 'National ID'
};

async function assessSelfieNaturalness(dataUrl: string): Promise<{ ok: boolean; reason?: string }> {
  try {
    if (!dataUrl?.startsWith('data:image/')) return { ok: false, reason: 'Invalid selfie image.' };

    const img = new Image();
    img.decoding = 'async';
    img.src = dataUrl;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Image load failed'));
    });

    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if (!w || !h) return { ok: false, reason: 'Selfie image could not be read.' };
    if (w < 320 || h < 320) return { ok: false, reason: 'Selfie is too small. Please take a clearer photo.' };

    // Passport-style checks (best-effort). On Chromium browsers we can use FaceDetector.
    // If the API isn't available, we only run color/quality heuristics and avoid blocking users.
    try {
      type FaceDetectorCtor =
        new (opts?: { fastMode?: boolean; maxDetectedFaces?: number }) => {
          detect: (source: CanvasImageSource) => Promise<Array<{ boundingBox: DOMRectReadOnly }>>;
        };
      const FaceDetectorCtor = (window as unknown as Window & { FaceDetector?: FaceDetectorCtor }).FaceDetector;
      if (FaceDetectorCtor) {
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          const fd = new FaceDetectorCtor({ fastMode: true, maxDetectedFaces: 2 });
          const faces = await fd.detect(canvas);
          if (!faces || faces.length === 0) {
            return { ok: false, reason: 'No face detected. Use a clear passport-style selfie (no filters).' };
          }
          if (faces.length > 1) {
            return { ok: false, reason: 'Multiple faces detected. Only your face should be visible.' };
          }
          const bb = faces[0].boundingBox;
          const faceArea = Math.max(1, bb.width * bb.height);
          const imgArea = Math.max(1, w * h);
          const ratio = faceArea / imgArea;

          // Face should be reasonably large like a passport photo, not far away.
          if (ratio < 0.08) {
            return { ok: false, reason: 'Face is too far. Move closer (passport-style) and keep your head straight.' };
          }
          if (ratio > 0.65) {
            return { ok: false, reason: 'Face is too close. Step back slightly and keep your head straight.' };
          }

          // Face should be centered (reduces strong tilts/angles and cropped shots).
          const cx = bb.x + bb.width / 2;
          const cy = bb.y + bb.height / 2;
          const dx = Math.abs(cx - w / 2) / (w / 2);
          const dy = Math.abs(cy - h / 2) / (h / 2);
          if (dx > 0.38 || dy > 0.38) {
            return { ok: false, reason: 'Center your face like a passport photo (no tilt/angles), then retake.' };
          }

          // Strong sideways / rotated captures often produce extreme face box aspect ratios.
          const ar = bb.width / Math.max(1, bb.height);
          if (ar < 0.42 || ar > 1.35) {
            return { ok: false, reason: 'Keep your head upright (no tilt) and take a natural passport-style selfie.' };
          }
        }
      }
    } catch {
      // If face detection fails, do not block legitimate users.
    }

    // Downsample for fast analysis (no ML): look for extreme saturation / overly-smooth "beauty filter" look.
    const maxSide = 220;
    const scale = Math.min(1, maxSide / Math.max(w, h));
    const sw = Math.max(1, Math.round(w * scale));
    const sh = Math.max(1, Math.round(h * scale));
    const canvas = document.createElement('canvas');
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return { ok: true };
    ctx.drawImage(img, 0, 0, sw, sh);
    const { data } = ctx.getImageData(0, 0, sw, sh);

    let lumSum = 0;
    let lumSq = 0;
    let satSum = 0;
    let satSq = 0;
    let n = 0;

    // Sample every few pixels for speed.
    const step = 4 * 3; // every ~3 pixels
    for (let i = 0; i < data.length; i += step) {
      const r = data[i] / 255;
      const g = data[i + 1] / 255;
      const b = data[i + 2] / 255;

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const sat = max === 0 ? 0 : (max - min) / max;

      lumSum += lum;
      lumSq += lum * lum;
      satSum += sat;
      satSq += sat * sat;
      n++;
    }

    const lumMean = lumSum / n;
    const lumStd = Math.sqrt(Math.max(0, lumSq / n - lumMean * lumMean));
    const satMean = satSum / n;
    const satStd = Math.sqrt(Math.max(0, satSq / n - satMean * satMean));

    // Heuristics:
    // - Extremely high saturation (common in heavy filters)
    // - Very low luminance variation (over-smoothing / airbrushing)
    if (satMean > 0.68 && satStd < 0.22) {
      return { ok: false, reason: 'Selfie looks heavily filtered. Please upload a natural, unedited photo.' };
    }
    if (lumStd < 0.055 && satMean > 0.38) {
      return { ok: false, reason: 'Selfie looks overly smoothed/edited. Please take a natural photo in good light.' };
    }

    return { ok: true };
  } catch {
    // If analysis fails, don’t block legitimate users.
    return { ok: true };
  }
}

export const GhanaCardVerification = ({
  onVerificationComplete,
  userCountry,
  signOutAfterSubmit = true
}: GhanaCardVerificationProps) => {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const isSeller = user?.role === 'seller';

  const draftUserKey = useMemo(() => {
    if (user?.id) return `id:${user.id}`;
    const em = user?.email?.trim().toLowerCase();
    if (em) return `email:${em}`;
    return '';
  }, [user?.id, user?.email]);

  const [draftReady, setDraftReady] = useState(false);
  const [resumeFaceScreening, setResumeFaceScreening] = useState(false);

  const [step, setStep] = useState<GhanaCardDraftV1['step']>(1);
  const [subStep, setSubStep] = useState<'front' | 'back' | 'details'>('front');
  const [frontCard, setFrontCard] = useState<string>('');
  const [backCard, setBackCard] = useState<string>('');
  const [faceImage, setFaceImage] = useState<string>('');
  const [cardNumber, setCardNumber] = useState('');
  const [fullName, setFullName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  /** live_camera = screened; upload = manual review only */
  const [faceCaptureMethod, setFaceCaptureMethod] = useState<'live_camera' | 'upload' | null>(null);
  const [faceScreeningDone, setFaceScreeningDone] = useState(false);
  const [faceScreeningMessage, setFaceScreeningMessage] = useState<string>('');
  const [requiresManualReview, setRequiresManualReview] = useState(false);
  const [faceRecognitionStep, setFaceRecognitionStep] = useState<'extracting' | 'comparing' | 'liveness' | 'done' | null>(null);
  const [faceSimilarityScore, setFaceSimilarityScore] = useState<number | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  /** Latest Protocol A/B snapshot from `/verify/ghana-card` — merged into PATCH `/users/me`. */
  const [smartlandProtocols, setSmartlandProtocols] = useState<Record<string, unknown> | null>(null);
  const inlineVideoRef = useRef<HTMLVideoElement>(null);
  const dialogVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [cameraDialogOpen, setCameraDialogOpen] = useState(false);
  const [cameraTarget, setCameraTarget] = useState<'front' | 'back' | 'face'>('front');
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');

  const cardName = CARD_NAMES[userCountry] || 'National ID Card';

  useEffect(() => {
    cameraStreamRef.current = cameraStream;
  }, [cameraStream]);

  const stopCamera = useCallback(() => {
    const stream = cameraStreamRef.current;
    stream?.getTracks().forEach(track => track.stop());
    cameraStreamRef.current = null;
    if (inlineVideoRef.current) inlineVideoRef.current.srcObject = null;
    if (dialogVideoRef.current) dialogVideoRef.current.srcObject = null;
    setCameraStream(null);
  }, []);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  const runScreeningForFace = useCallback(
    async (faceDataUrl: string, method: 'live_camera' | 'upload') => {
      if (!frontCard || !backCard) return;
      const normalized = normalizeGhanaCardNumber(cardNumber);
      if (!isValidGhanaCardFormat(normalized)) {
        toast.error(GHANA_CARD_FORMAT_HINT);
        return;
      }
      if (!validateFullNameAsOnCard(fullName)) {
        toast.error('Enter your full name as printed on the card (e.g. first and last name).');
        return;
      }
      setFaceSimilarityScore(null);
      setFaceRecognitionStep('extracting');

      let passportSimilarity: number | undefined;

      // Pre-submission gatekeeper: run on-device quality + landmark similarity checks.
      // IMPORTANT: This is local-only. We do NOT send anything to backend until the final "Submit" stage.
      try {
        const gate = await runPassportGate({
          selfieDataUrl: faceDataUrl,
          ghanaCardFrontDataUrl: frontCard,
          tiltMaxDegrees: 15,
        });

        if (!gate.ok) {
          setFaceScreeningDone(false);
          setFaceRecognitionStep(null);
          setFaceScreeningMessage('');
          setRequiresManualReview(false);
          setFaceSimilarityScore(typeof gate.similarityScore === 'number' ? gate.similarityScore : null);
          toast.error(gate.reasons?.[0] || 'Selfie was rejected. Please use a natural passport-style photo.');
          return;
        }

        passportSimilarity = gate.similarityScore;
        setFaceSimilarityScore(gate.similarityScore);

        // Manual review band: allow user to proceed to submission, but mark manual review.
        if (gate.decision === 'manual_review') {
          setFaceRecognitionStep('done');
          setRequiresManualReview(true);
          setFaceScreeningDone(true);
          setFaceScreeningMessage('Pre-check complete: Manual review will be required (60–79% match). You can proceed to submit.');
          setSmartlandProtocols({
            protocolA: { passed: true },
            protocolB: {
              passed: false,
              skipped: true,
              similarity: gate.similarityScore,
              decision: 'manual_review',
            },
          });
          return;
        }
      } catch (e) {
        // If CV gate fails unexpectedly, fall back to the older "naturalness" heuristic instead of blocking users.
        const natural = await assessSelfieNaturalness(faceDataUrl);
        if (!natural.ok) {
          setFaceScreeningDone(false);
          setFaceRecognitionStep(null);
          setFaceScreeningMessage('');
          setRequiresManualReview(false);
          toast.error(natural.reason || 'Selfie was rejected. Please use a natural photo.');
          return;
        }
      }

      const uploadNeedsStaff = method === 'upload';
      setSmartlandProtocols({
        protocolA: { passed: true },
        protocolB: {
          passed: !uploadNeedsStaff,
          skipped: uploadNeedsStaff,
          similarity: passportSimilarity,
        },
      });
      setFaceRecognitionStep('done');
      setRequiresManualReview(uploadNeedsStaff);
      setFaceScreeningDone(true);
      setFaceScreeningMessage('Pre-check passed. Proceed to submit — you will be notified within 24–48 hours.');
    },
    [frontCard, backCard, cardNumber, fullName]
  );

  const isDataUrlImage = (s: string) => s.startsWith('data:image/');

  /** Align saved draft with required step order so users never land on an impossible screen. */
  const coerceDraft = useCallback((raw: GhanaCardDraftV1): { draft: GhanaCardDraftV1; resumeFace: boolean } => {
    let step = raw.step;
    let subStep = raw.subStep;
    const cardNum = normalizeGhanaCardNumber(raw.cardNumber || '');
    const fn = (raw.fullName || '').trim();
    const detailsOk = isValidGhanaCardFormat(cardNum) && validateFullNameAsOnCard(fn);

    if (!isDataUrlImage(raw.frontCard)) {
      step = 1;
      subStep = 'front';
    } else if (!isDataUrlImage(raw.backCard)) {
      step = 1;
      subStep = 'back';
    } else if (!detailsOk) {
      step = 1;
      subStep = 'details';
    } else if (!isDataUrlImage(raw.faceImage) || !raw.faceScreeningDone) {
      step = 2;
    } else {
      step = raw.step >= 3 ? 3 : 2;
    }

    const draft: GhanaCardDraftV1 = {
      ...raw,
      step,
      subStep,
      cardNumber: cardNum,
      fullName: fn,
    };

    const resumeFace =
      draft.step === 2 &&
      isDataUrlImage(draft.faceImage) &&
      !draft.faceScreeningDone &&
      (draft.faceCaptureMethod === 'live_camera' || draft.faceCaptureMethod === 'upload');

    return { draft, resumeFace };
  }, []);

  useEffect(() => {
    if (!draftUserKey) {
      setDraftReady(true);
      return;
    }
    const loaded = loadGhanaCardDraft(draftUserKey);
    if (loaded) {
      const { draft, resumeFace } = coerceDraft(loaded);
      setStep(draft.step);
      setSubStep(draft.subStep);
      setFrontCard(draft.frontCard);
      setBackCard(draft.backCard);
      setFaceImage(draft.faceImage);
      setCardNumber(draft.cardNumber);
      setFullName(draft.fullName);
      setFaceCaptureMethod(draft.faceCaptureMethod);
      setFaceScreeningDone(draft.faceScreeningDone);
      setFaceScreeningMessage(draft.faceScreeningMessage);
      setRequiresManualReview(draft.requiresManualReview);
      setFaceRecognitionStep(draft.faceRecognitionStep);
      setFaceSimilarityScore(draft.faceSimilarityScore);
      setSmartlandProtocols(draft.smartlandProtocols);
      setResumeFaceScreening(resumeFace);
      const progressed =
        draft.step > 1 ||
        isDataUrlImage(draft.frontCard) ||
        isDataUrlImage(draft.backCard) ||
        !!draft.cardNumber.trim() ||
        !!draft.fullName.trim();
      if (progressed) {
        toast.info('Continuing where you left off', { duration: 4500 });
      }
    }
    setDraftReady(true);
  }, [draftUserKey, coerceDraft]);

  useEffect(() => {
    if (!draftReady || !resumeFaceScreening) return;
    if (!faceCaptureMethod || !faceImage) return;
    if (!frontCard || !backCard) return;
    const normalized = normalizeGhanaCardNumber(cardNumber);
    if (!isValidGhanaCardFormat(normalized) || !validateFullNameAsOnCard(fullName)) return;
    setResumeFaceScreening(false);
    void runScreeningForFace(faceImage, faceCaptureMethod);
  }, [
    draftReady,
    resumeFaceScreening,
    faceCaptureMethod,
    faceImage,
    frontCard,
    backCard,
    cardNumber,
    fullName,
    runScreeningForFace,
  ]);

  useEffect(() => {
    if (!draftUserKey || !draftReady) return;
    const t = window.setTimeout(() => {
      saveGhanaCardDraft(draftUserKey, {
        version: 1,
        updatedAt: new Date().toISOString(),
        step,
        subStep,
        frontCard,
        backCard,
        faceImage,
        cardNumber,
        fullName,
        faceCaptureMethod,
        faceScreeningDone,
        faceScreeningMessage,
        requiresManualReview,
        faceRecognitionStep,
        faceSimilarityScore,
        smartlandProtocols,
      });
    }, 500);
    return () => window.clearTimeout(t);
  }, [
    draftUserKey,
    draftReady,
    step,
    subStep,
    frontCard,
    backCard,
    faceImage,
    cardNumber,
    fullName,
    faceCaptureMethod,
    faceScreeningDone,
    faceScreeningMessage,
    requiresManualReview,
    faceRecognitionStep,
    faceSimilarityScore,
    smartlandProtocols,
  ]);

  const clearSavedProgress = useCallback(() => {
    if (draftUserKey) clearGhanaCardDraft(draftUserKey);
    stopCamera();
    setResumeFaceScreening(false);
    setStep(1);
    setSubStep('front');
    setFrontCard('');
    setBackCard('');
    setFaceImage('');
    setCardNumber('');
    setFullName('');
    setFaceCaptureMethod(null);
    setFaceScreeningDone(false);
    setFaceScreeningMessage('');
    setRequiresManualReview(false);
    setFaceRecognitionStep(null);
    setFaceSimilarityScore(null);
    setSmartlandProtocols(null);
    toast.message('Starting fresh — previous draft cleared on this device.');
  }, [draftUserKey, stopCamera]);

  const handleFileUpload = (file: File, type: 'front' | 'back' | 'face') => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      const result = e.target?.result as string;
      if (type === 'front' || type === 'back') {
        const gate = await runDocumentGate({ imageDataUrl: result, tiltMaxDegrees: 15 });
        if (!gate.ok) {
          const reason = 'reasons' in gate && Array.isArray(gate.reasons) ? gate.reasons[0] : undefined;
          toast.error(reason || 'Please align your camera straight to the document/face.');
          return;
        }
        if (type === 'front') setFrontCard(result);
        else setBackCard(result);
        return;
      }

      {
        const natural = await assessSelfieNaturalness(result);
        if (!natural.ok) {
          toast.error(natural.reason || 'Selfie was rejected. Please use a natural photo.');
          return;
        }
        setFaceImage(result);
        setFaceCaptureMethod('upload');
        setFaceScreeningDone(false);
        setRequiresManualReview(false);
        void runScreeningForFace(result, 'upload');
      }
    };
    reader.readAsDataURL(file);
  };

  const startCamera = useCallback(async (facing: 'environment' | 'user' = 'environment') => {
    try {
      stopCamera();
      if (!navigator.mediaDevices?.getUserMedia) {
        toast.error('Camera is not supported in this browser.');
        return false;
      }
      if (typeof window !== 'undefined' && 'isSecureContext' in window && !(window as Window & { isSecureContext?: boolean }).isSecureContext) {
        toast.error('Camera requires HTTPS (or localhost).');
        return false;
      }
      const base: MediaTrackConstraints = {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 },
      };
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            ...base,
            facingMode: { ideal: facing },
            // Best-effort: helps avoid very dark previews on some devices.
            // (Not all browsers support these advanced constraints.)
            advanced: [{ exposureMode: 'continuous' }, { whiteBalanceMode: 'continuous' }] as unknown
          } as unknown as MediaTrackConstraints,
          audio: false
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { ...base, facingMode: facing } as MediaTrackConstraints,
          audio: false
        });
      }
      setCameraStream(stream);
      return true;
    } catch (e) {
      const err = e as unknown as { name?: string };
      const msg =
        typeof err?.name === 'string'
          ? err.name === 'NotAllowedError'
            ? 'Camera permission was blocked. Allow camera access in your browser settings.'
            : err.name === 'NotFoundError'
              ? 'No camera device was found.'
              : err.name === 'NotReadableError'
                ? 'Camera is in use by another app (Zoom/Teams/etc). Close it and try again.'
                : `Camera error: ${err.name}`
          : 'Camera access denied or not available.';
      toast.error(msg);
      return false;
    }
  }, [stopCamera]);

  const openCameraFor = async (target: 'front' | 'back' | 'face', facing: 'environment' | 'user') => {
    setCameraTarget(target);
    setCameraFacing(facing);
    setCameraDialogOpen(true);
  };

  useEffect(() => {
    if (!cameraDialogOpen) return;
    void startCamera(cameraFacing);
    // Stop when closing handled by Dialog onOpenChange
  }, [cameraDialogOpen, cameraFacing, startCamera]);

  useEffect(() => {
    if (!cameraStream) return;
    const bindStream = (v: HTMLVideoElement | null) => {
      if (!v) return;
      v.srcObject = cameraStream;
      const tryPlay = () => {
        try {
          const p = v.play();
          if (p && typeof (p as { catch?: (fn: () => void) => void }).catch === 'function') {
            (p as { catch: (fn: () => void) => void }).catch(() => {});
          }
        } catch {
          // ignore
        }
      };
      // iOS/Safari can require metadata before play succeeds.
      v.onloadedmetadata = () => tryPlay();
      tryPlay();
    };
    bindStream(inlineVideoRef.current);
    bindStream(dialogVideoRef.current);
  }, [cameraStream]);

  const captureFromCamera = useCallback(
    async (type: 'front' | 'back' | 'face') => {
      const video =
        (cameraDialogOpen ? dialogVideoRef.current : inlineVideoRef.current) ??
        inlineVideoRef.current ??
        dialogVideoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || !video.videoWidth) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      if (type === 'front' || type === 'back') {
        const gate = await runDocumentGate({ imageDataUrl: dataUrl, tiltMaxDegrees: 15 });
        if (!gate.ok) {
          const reason = 'reasons' in gate && Array.isArray(gate.reasons) ? gate.reasons[0] : undefined;
          toast.error(reason || 'Please align your camera straight to the document/face.');
          return;
        }
        if (type === 'front') setFrontCard(dataUrl);
        else setBackCard(dataUrl);
      } else {
        setFaceImage(dataUrl);
        setFaceCaptureMethod('live_camera');
        setFaceScreeningDone(false);
        setRequiresManualReview(false);
        void runScreeningForFace(dataUrl, 'live_camera');
      }
      setCameraDialogOpen(false);
      stopCamera();
      toast.success('Photo captured');
    },
    [cameraDialogOpen, stopCamera, runScreeningForFace]
  );

  const captureSelfie = () => {
    void captureFromCamera('face');
  };

  const openFaceCameraInline = useCallback(async () => {
    setCameraTarget('face');
    setCameraFacing('user');
    setCameraDialogOpen(false);
    await startCamera('user');
  }, [startCamera]);

  const retryFacialRecognition = () => {
    setFaceImage('');
    setFaceCaptureMethod(null);
    setFaceScreeningDone(false);
    setFaceRecognitionStep(null);
    setRequiresManualReview(false);
    setFaceScreeningMessage('');
    void openFaceCameraInline();
  };

  const detailsValid =
    isValidGhanaCardFormat(normalizeGhanaCardNumber(cardNumber)) && validateFullNameAsOnCard(fullName);

  const submitVerification = async () => {
    if (!faceImage || !faceScreeningDone) {
      toast.error('Complete facial screening first.');
      return;
    }
    const normalized = normalizeGhanaCardNumber(cardNumber);
    if (!isValidGhanaCardFormat(normalized) || !validateFullNameAsOnCard(fullName)) {
      toast.error(GHANA_CARD_FORMAT_HINT);
      return;
    }
    try {
      if (!localStorage.getItem('smartland_token')) {
        toast.error('Your session has expired. Sign in again to submit verification.');
        navigate('/', { replace: true });
        return;
      }
    } catch {
      toast.error('Sign in again to submit verification.');
      navigate('/', { replace: true });
      return;
    }

    setIsProcessing(true);
    try {
      const smartlandProtocolsForSubmit: Record<string, unknown> = {
        protocolA: (smartlandProtocols?.protocolA as Record<string, unknown> | undefined) ?? { passed: true },
        protocolB: {
          passed: !requiresManualReview,
          skipped: requiresManualReview,
          similarity: faceSimilarityScore ?? undefined,
          selfieCapture: faceCaptureMethod ?? undefined,
        },
      };

      const verificationData: VerificationData = {
        frontCardImage: frontCard,
        backCardImage: backCard,
        faceImage,
        cardNumber: normalized,
        fullName: fullName.trim(),
        status: 'pending',
        faceMatch: requiresManualReview ? false : true,
        livenessPassed: faceCaptureMethod === 'live_camera',
        selfieSource: faceCaptureMethod ?? undefined,
        requiresManualReview,
        identityReferenceId: undefined,
        smartlandProtocols: smartlandProtocolsForSubmit,
        ghanaCard: {
          cardNumber: normalized,
          fullName: fullName.trim(),
          frontCardImage: frontCard,
          backCardImage: backCard,
          faceImage
        }
      };

      await api.saveIdVerification(verificationData as unknown as Record<string, unknown>);
      if (draftUserKey) clearGhanaCardDraft(draftUserKey);
      onVerificationComplete(verificationData);
      if (signOutAfterSubmit) {
        toast.success('Submission received', {
          description: 'Sign in again with the same email and password. Your Ghana Card submission stays on file while staff review it (usually 24–48 hours).',
          duration: 9000,
        });
        logout();
        navigate('/', { replace: true });
      } else {
        toast.success('Submission received', {
          description: 'You will be notified of your verification status within 24–48 hours.',
          duration: 8000,
        });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Submission failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const progressValue = step === 1 ? (subStep === 'front' ? 15 : subStep === 'back' ? 35 : 55) : step === 2 ? 75 : 100;

  return (
    <>
    <Card className="w-full max-w-2xl mx-auto bg-card text-card-foreground border border-border shadow-lg">
      <CardHeader className="space-y-2">
        <CardTitle className="flex items-center gap-2 text-foreground">
          <Shield className="w-5 h-5 text-primary" />
          {cardName} Verification
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Front and back of your card plus a face match. Verification is reviewed by staff before access is granted.
          {draftUserKey ? (
            <span className="block mt-2 text-xs text-muted-foreground">
              Your answers and photos are saved automatically on this device until you submit — close anytime and continue later.{' '}
              <button
                type="button"
                className="underline font-medium text-foreground hover:text-primary"
                onClick={() => clearSavedProgress()}
              >
                Start over
              </button>
            </span>
          ) : null}
        </CardDescription>
        <Progress value={progressValue} className="h-2 bg-muted" />
      </CardHeader>
      <CardContent className="space-y-6">
        {step === 1 && (
          <div className="space-y-6">
            <Alert className="border-border bg-muted/50">
              <CreditCard className="h-4 w-4 text-primary" />
              <AlertDescription className="text-foreground">
                Upload or capture <strong>front</strong> and <strong>back</strong> of your {cardName}. For Ghana, the card number on the front must match{' '}
                <span className="font-mono text-sm">GHA-XXXXXXXXX-X</span>.
              </AlertDescription>
            </Alert>

            {subStep === 'front' && (
              <div className="space-y-4">
                <Label className="flex items-center gap-2 text-foreground">
                  <FileImage className="w-4 h-4" />
                  Front of {cardName}
                </Label>
                <div className="border-2 border-dashed border-border rounded-xl p-6 text-center bg-muted/30">
                  {frontCard ? (
                    <div className="space-y-3">
                      <img src={frontCard} alt="Front of card" className="max-h-40 mx-auto rounded-lg object-contain border border-border" />
                      <div className="flex flex-wrap gap-2 justify-center">
                        <Badge variant="secondary" className="border border-border">
                          <CheckCircle className="w-3 h-3 mr-1" /> Captured
                        </Badge>
                        <Button type="button" variant="outline" size="sm" onClick={() => setFrontCard('')}>
                          <RotateCcw className="w-3 h-3 mr-1" /> Retake
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center">
                        <Camera className="w-8 h-8 text-primary" />
                      </div>
                      <p className="text-sm text-muted-foreground">Take a photo or upload the front of your card</p>
                      <div className="flex flex-wrap gap-2 justify-center">
                        <Button type="button" variant="outline" size="sm" onClick={() => void openCameraFor('front', 'environment')}>
                          <Camera className="w-4 h-4 mr-2" /> Use camera
                        </Button>
                        <Label className="cursor-pointer">
                          <span className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-border bg-background px-4 py-2 hover:bg-muted">
                            <Upload className="w-4 h-4 mr-2" /> Upload
                          </span>
                          <Input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'front')} />
                        </Label>
                      </div>
                    </div>
                  )}
                </div>
                <Button onClick={() => { stopCamera(); setSubStep('back'); }} disabled={!frontCard} className="w-full">
                  Next: Back of card
                </Button>
              </div>
            )}

            {subStep === 'back' && (
              <div className="space-y-4">
                <Label className="flex items-center gap-2 text-foreground">
                  <FileImage className="w-4 h-4" />
                  Back of {cardName}
                </Label>
                <div className="border-2 border-dashed border-border rounded-xl p-6 text-center bg-muted/30">
                  {backCard ? (
                    <div className="space-y-3">
                      <img src={backCard} alt="Back of card" className="max-h-40 mx-auto rounded-lg object-contain border border-border" />
                      <div className="flex flex-wrap gap-2 justify-center">
                        <Badge variant="secondary" className="border border-border">
                          <CheckCircle className="w-3 h-3 mr-1" /> Captured
                        </Badge>
                        <Button type="button" variant="outline" size="sm" onClick={() => setBackCard('')}>
                          <RotateCcw className="w-3 h-3 mr-1" /> Retake
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center">
                        <Camera className="w-8 h-8 text-primary" />
                      </div>
                      <p className="text-sm text-muted-foreground">Take a photo or upload the back of your card</p>
                      <div className="flex flex-wrap gap-2 justify-center">
                        <Button type="button" variant="outline" size="sm" onClick={() => void openCameraFor('back', 'environment')}>
                          <Camera className="w-4 h-4 mr-2" /> Use camera
                        </Button>
                        <Label className="cursor-pointer">
                          <span className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-border bg-background px-4 py-2 hover:bg-muted">
                            <Upload className="w-4 h-4 mr-2" /> Upload
                          </span>
                          <Input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'back')} />
                        </Label>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => { stopCamera(); setSubStep('front'); }}>
                    Back
                  </Button>
                  <Button onClick={() => { stopCamera(); setSubStep('details'); }} disabled={!backCard} className="flex-1">
                    Next: Your details
                  </Button>
                </div>
              </div>
            )}

            {subStep === 'details' && (
              <div className="space-y-4">
                <Label className="text-foreground">Card number & name (as on card)</Label>
                <p className="text-xs text-muted-foreground">{GHANA_CARD_FORMAT_HINT}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    placeholder="GHA-123456789-1"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    className="bg-background border-border text-foreground"
                  />
                  <Input
                    placeholder="Full name as on card"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="bg-background border-border text-foreground"
                  />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setSubStep('back')}>
                    Back
                  </Button>
                  <Button
                    onClick={() => setStep(2)}
                    disabled={!detailsValid}
                    className="flex-1"
                  >
                    Continue to facial recognition
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800">
              <User className="h-4 w-4 text-amber-700 dark:text-amber-400" />
              <AlertTitle className="text-amber-900 dark:text-amber-200">Facial check</AlertTitle>
              <AlertDescription className="text-amber-900/90 dark:text-amber-100/90">
                <strong>Recommended:</strong> use the live camera so we know the photo was taken in this session. If you upload a file instead,{' '}
                <strong>manual review will be required</strong> before your identity is cleared. Random or unrelated images will be rejected.
              </AlertDescription>
            </Alert>

            {!faceImage ? (
              <div className="space-y-4">
                <div className="relative mx-auto w-72 h-72 rounded-full overflow-hidden bg-muted border-4 border-dashed border-primary/40">
                  {cameraStream ? (
                    <>
                      <video
                        ref={inlineVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
                        style={{ filter: 'brightness(1.15) contrast(1.1) saturate(1.05)' }}
                      />
                      <canvas ref={canvasRef} className="hidden" />
                      {/* Passport-style guidance overlay (centered face, upright) */}
                      <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute inset-0 bg-gradient-to-b from-black/15 via-transparent to-black/25" />
                        {/* Silhouette-ish oval */}
                        <div className="absolute left-1/2 top-[18%] -translate-x-1/2 w-[56%] h-[64%] rounded-[999px] border-2 border-white/55" />
                        {/* Eye line */}
                        <div className="absolute left-1/2 top-[38%] -translate-x-1/2 w-[58%] border-t border-white/35" />
                        {/* Chin line */}
                        <div className="absolute left-1/2 top-[72%] -translate-x-1/2 w-[44%] border-t border-white/25" />
                        <div className="absolute bottom-3 left-0 right-0 text-center text-[11px] text-white/85 drop-shadow">
                          Keep head upright. Center your face like a passport photo.
                        </div>
                      </div>
                      <div className="absolute inset-0 pointer-events-none rounded-full border-4 border-primary/40" />
                    </>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground p-4 text-center">
                      <User className="w-16 h-16 mb-2 opacity-80" />
                      <p className="text-sm">Position your face in the frame</p>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  {!cameraStream ? (
                    <>
                      <Button onClick={() => void openFaceCameraInline()} className="w-full">
                        <Camera className="w-4 h-4 mr-2" /> Open camera (recommended)
                      </Button>
                      <Label className="cursor-pointer text-center py-2 rounded-md border border-dashed border-border hover:bg-muted/50">
                        <span className="text-sm text-foreground">Upload a selfie instead (manual review required)</span>
                        <Input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'face')}
                        />
                      </Label>
                    </>
                  ) : (
                    <>
                      <Button onClick={captureSelfie} className="w-full">
                        <Scan className="w-4 h-4 mr-2" /> Capture selfie
                      </Button>
                      <Label className="cursor-pointer text-center py-2 rounded-md border border-dashed border-border hover:bg-muted/50">
                        <span className="text-sm text-foreground">Upload a selfie instead (manual review required)</span>
                        <Input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            stopCamera();
                            handleFileUpload(file, 'face');
                          }}
                        />
                      </Label>
                      <Button variant="ghost" onClick={stopCamera} className="text-muted-foreground">
                        Cancel
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-center">
                <div className="flex justify-center gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Card photo</p>
                    <img src={frontCard} alt="ID" className="w-24 h-24 rounded-lg object-cover border border-border" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Your selfie</p>
                    <div className="relative w-24 h-24 rounded-full overflow-hidden border-4 border-border">
                      <img src={faceImage} alt="Selfie" className="w-full h-full object-cover scale-x-[-1]" />
                    </div>
                  </div>
                </div>

                {isProcessing && (
                  <div className="space-y-3 text-left max-w-sm mx-auto">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${faceRecognitionStep === 'extracting' ? 'bg-primary animate-pulse' : 'bg-emerald-600'}`} />
                      <span className="text-sm text-foreground">{faceRecognitionStep === 'extracting' ? 'Checking card data…' : 'Checked'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${faceRecognitionStep === 'comparing' ? 'bg-primary animate-pulse' : faceRecognitionStep && faceRecognitionStep !== 'extracting' ? 'bg-emerald-600' : 'bg-muted'}`} />
                      <span className="text-sm text-foreground">Server screening…</span>
                    </div>
                    <Progress
                      value={faceRecognitionStep === 'extracting' ? 33 : faceRecognitionStep === 'comparing' ? 66 : faceRecognitionStep === 'liveness' ? 90 : 100}
                      className="h-2 bg-muted"
                    />
                  </div>
                )}

                {faceScreeningDone && (
                  <Alert className={requiresManualReview ? 'border-amber-300 bg-amber-50 dark:bg-amber-950/25' : 'border-emerald-200 bg-emerald-50 dark:bg-emerald-950/25'}>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription className="text-foreground text-left text-sm">
                      {faceScreeningMessage}
                      {requiresManualReview && (
                        <span className="block mt-2 font-medium">Your account will remain limited until staff completes this review.</span>
                      )}
                    </AlertDescription>
                  </Alert>
                )}


                <div className="flex gap-2 justify-center flex-wrap">
                  <Button variant="outline" onClick={() => void retryFacialRecognition()} disabled={isProcessing}>
                    Retake selfie
                  </Button>
                  {faceScreeningDone && (
                    <Button onClick={() => setStep(3)}>Continue to submit</Button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 text-center">
            <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">Submit for review</h3>
            <p className="text-muted-foreground text-sm">
              <strong className="text-foreground">Every buyer and every seller</strong> must be approved by the{' '}
              <strong className="text-foreground">Ghana Lands Commission</strong> — there is no way around Ghana Card verification. Your package is sent for review now.{' '}
              <strong className="text-foreground">You are not verified yet</strong> — transactions unlock only after approval.
              {isSeller ? (
                <>
                  {' '}
                  As a seller, <strong className="text-foreground">Ghana Lands Commission</strong> will still review each parcel’s land documents before that listing can go live for buyers.
                </>
              ) : (
                <> Buyers and investors do not need a separate seller registry account approval.</>
              )}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div className="p-3 rounded-lg bg-muted/50 border border-border">
                <FileImage className="w-6 h-6 mx-auto text-primary mb-1" />
                <p className="text-foreground font-medium">Card images</p>
                <p className="text-xs text-muted-foreground">Uploaded</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 border border-border">
                <Camera className="w-6 h-6 mx-auto text-primary mb-1" />
                <p className="text-foreground font-medium">Face</p>
                <p className="text-xs text-muted-foreground">{requiresManualReview ? 'Manual review' : 'Live screening'}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 border border-border">
                <Shield className="w-6 h-6 mx-auto text-primary mb-1" />
                <p className="text-foreground font-medium">Status</p>
                <p className="text-xs text-amber-700 dark:text-amber-400">Pending approval</p>
              </div>
            </div>
            <Alert className="border-border bg-muted/40 text-left">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <AlertDescription className="text-foreground">
                After you submit, <strong>Ghana Lands Commission</strong> will review your Ghana Card details. Expect an update within{' '}
                <strong>24 to 48 hours</strong> — not instant verification.
              </AlertDescription>
            </Alert>
            <Button onClick={() => void submitVerification()} disabled={isProcessing} className="w-full">
              {isProcessing ? 'Submitting…' : 'Submit for verification'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>

      <Dialog
        open={cameraDialogOpen}
        onOpenChange={(open) => {
          setCameraDialogOpen(open);
          if (!open) stopCamera();
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {cameraTarget === 'face'
                ? 'Live selfie'
                : cameraTarget === 'front'
                  ? `Front of ${cardName}`
                  : `Back of ${cardName}`}
            </DialogTitle>
            <DialogDescription>
              Allow camera permissions, then tap <strong>Take photo</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="relative overflow-hidden rounded-xl border border-border bg-black">
              <video
                ref={dialogVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-[320px] object-cover"
                style={{ filter: 'brightness(1.15) contrast(1.1) saturate(1.05)' }}
              />
              <canvas ref={canvasRef} className="hidden" />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  stopCamera();
                  const next = cameraFacing === 'environment' ? 'user' : 'environment';
                  setCameraFacing(next);
                  await startCamera(next);
                }}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Switch camera
              </Button>

              <Button
                type="button"
                className="flex-1"
                onClick={() => void captureFromCamera(cameraTarget)}
                disabled={!cameraStream}
              >
                <Scan className="w-4 h-4 mr-2" />
                Take photo
              </Button>
            </div>

            <Label className="cursor-pointer text-center py-2 rounded-md border border-dashed border-border hover:bg-muted/50">
              <span className="text-sm text-foreground">
                Upload a photo instead
                {cameraTarget === 'face' ? ' (manual review required)' : ''}
              </span>
              <Input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setCameraDialogOpen(false);
                  stopCamera();
                  handleFileUpload(file, cameraTarget);
                }}
              />
            </Label>

            {!cameraStream ? (
              <Button
                type="button"
                variant="secondary"
                onClick={async () => {
                  await startCamera(cameraFacing);
                }}
              >
                <Camera className="w-4 h-4 mr-2" />
                Start camera
              </Button>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
