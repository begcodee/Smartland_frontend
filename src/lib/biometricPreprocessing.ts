import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision';

export type PassportGateResult =
  | { ok: true; similarityScore: number; decision: 'pass' | 'manual_review'; reasons?: string[] }
  | { ok: false; similarityScore?: number; decision: 'reject'; reasons: string[] };

export type DocumentGateResult =
  | { ok: true; tiltDegrees: number | null }
  | { ok: false; tiltDegrees: number | null; reasons: string[] };

type Landmarker = {
  detect: (source: CanvasImageSource) => Promise<{
    faceLandmarks?: Array<Array<{ x: number; y: number; z?: number }>>;
  }>;
};

let landmarkerPromise: Promise<Landmarker> | null = null;

async function getFaceLandmarker(): Promise<Landmarker> {
  if (landmarkerPromise) return landmarkerPromise;
  landmarkerPromise = (async () => {
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
    );
    // Note: model stays client-side; no user images are uploaded here.
    const lm = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
      },
      runningMode: 'IMAGE',
      numFaces: 1,
    });
    return lm as unknown as Landmarker;
  })();
  return landmarkerPromise;
}

function dataUrlToImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = dataUrl;
  });
}

function drawToCanvas(img: HTMLImageElement, maxSide = 520) {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const cw = Math.max(1, Math.round(w * scale));
  const ch = Math.max(1, Math.round(h * scale));
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas not available');
  ctx.drawImage(img, 0, 0, cw, ch);
  return { canvas, w: cw, h: ch };
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

function meanStd(values: number[]) {
  const n = Math.max(1, values.length);
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const sq = values.reduce((a, b) => a + b * b, 0) / n;
  const std = Math.sqrt(Math.max(0, sq - mean * mean));
  return { mean, std };
}

/**
 * Lightweight "natural image" heuristics. Not perfect, but blocks the obvious:
 * - extreme saturation / posterization-like palettes (common in filters/stickers)
 * - overly-smooth/airbrushed images (low luminance variance)
 */
function naturalImageHeuristics(canvas: HTMLCanvasElement): { ok: boolean; reason?: string } {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return { ok: true };
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);

  const sat: number[] = [];
  const lum: number[] = [];
  let extremeSatCount = 0;
  let sampleCount = 0;

  // Hue buckets for "cartoon / sticker" detection: too few distinct hues + very high saturation
  const hueBuckets = new Set<number>();

  const stepPx = 4; // sample grid
  for (let y = 0; y < height; y += stepPx) {
    for (let x = 0; x < width; x += stepPx) {
      const i = (y * width + x) * 4;
      const r = data[i] / 255;
      const g = data[i + 1] / 255;
      const b = data[i + 2] / 255;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const s = max === 0 ? 0 : (max - min) / max;
      lum.push(l);
      sat.push(s);
      if (s > 0.92) extremeSatCount++;
      sampleCount++;

      // rough hue in [0..360)
      let h = 0;
      if (max !== min) {
        if (max === r) h = ((g - b) / (max - min)) % 6;
        else if (max === g) h = (b - r) / (max - min) + 2;
        else h = (r - g) / (max - min) + 4;
        h *= 60;
        if (h < 0) h += 360;
      }
      hueBuckets.add(Math.floor(h / 20)); // 18 buckets
    }
  }

  const { mean: satMean, std: satStd } = meanStd(sat);
  const { std: lumStd } = meanStd(lum);

  if (satMean > 0.70 && satStd < 0.22) {
    return { ok: false, reason: 'Image looks heavily filtered. Please use a natural, unedited photo.' };
  }
  if (lumStd < 0.05 && satMean > 0.35) {
    return { ok: false, reason: 'Image looks overly smoothed/edited. Please take a natural photo in good light.' };
  }
  const extremeSatRatio = sampleCount ? extremeSatCount / sampleCount : 0;
  if (extremeSatRatio > 0.28 && hueBuckets.size <= 6) {
    return { ok: false, reason: 'Stickers/emojis or heavy editing detected. Use a natural photo without overlays.' };
  }

  return { ok: true };
}

function estimateTiltDegreesFromEdges(canvas: HTMLCanvasElement): number | null {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  if (!width || !height) return null;

  const gray = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = data[i] / 255;
      const g = data[i + 1] / 255;
      const b = data[i + 2] / 255;
      gray[y * width + x] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }
  }

  let weightSum = 0;
  let angSum = 0;

  for (let y = 1; y < height - 1; y += 2) {
    for (let x = 1; x < width - 1; x += 2) {
      const i = y * width + x;
      const gx =
        -gray[i - width - 1] - 2 * gray[i - 1] - gray[i + width - 1] +
        gray[i - width + 1] + 2 * gray[i + 1] + gray[i + width + 1];
      const gy =
        -gray[i - width - 1] - 2 * gray[i - width] - gray[i - width + 1] +
        gray[i + width - 1] + 2 * gray[i + width] + gray[i + width + 1];

      const mag = Math.sqrt(gx * gx + gy * gy);
      if (mag < 0.25) continue;

      let ang = (Math.atan2(gy, gx) * 180) / Math.PI; // [-180,180]
      while (ang > 90) ang -= 180;
      while (ang < -90) ang += 180;

      weightSum += mag;
      angSum += ang * mag;
    }
  }

  if (!weightSum) return null;
  const meanAng = angSum / weightSum; // [-90,90]
  const d0 = Math.abs(meanAng);
  const d90 = Math.abs(90 - Math.abs(meanAng));
  return Math.min(d0, d90);
}

function pickKeypoints(landmarks: Array<{ x: number; y: number }>) {
  // MediaPipe face mesh indices for stable structure points.
  // (These are standard indices; we use a minimal set to reduce sensitivity to hair/age.)
  const idx = {
    leftEyeOuter: 33,
    rightEyeOuter: 263,
    noseTip: 1,
    mouthLeft: 61,
    mouthRight: 291,
    chin: 152,
  } as const;

  const get = (i: number) => landmarks[i] ?? null;
  const pts = {
    le: get(idx.leftEyeOuter),
    re: get(idx.rightEyeOuter),
    nose: get(idx.noseTip),
    ml: get(idx.mouthLeft),
    mr: get(idx.mouthRight),
    chin: get(idx.chin),
  };
  if (!pts.le || !pts.re || !pts.nose || !pts.ml || !pts.mr || !pts.chin) return null;
  return pts;
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function facialSignature(landmarks: Array<{ x: number; y: number }>): number[] | null {
  const pts = pickKeypoints(landmarks);
  if (!pts) return null;
  // Normalize by inter-ocular distance (robust to scale).
  const eyeDist = dist(pts.le, pts.re);
  if (!eyeDist || eyeDist < 1e-6) return null;

  const sig = [
    dist(pts.le, pts.nose) / eyeDist,
    dist(pts.re, pts.nose) / eyeDist,
    dist(pts.ml, pts.mr) / eyeDist,
    dist(pts.nose, pts.chin) / eyeDist,
    dist(pts.le, pts.chin) / eyeDist,
    dist(pts.re, pts.chin) / eyeDist,
    dist(pts.nose, pts.ml) / eyeDist,
    dist(pts.nose, pts.mr) / eyeDist,
  ];
  return sig;
}

function cosineSimilarity(a: number[], b: number[]) {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  if (!denom) return 0;
  // Map from [-1,1] to [0,1] just for UI thresholding convenience.
  return clamp01((dot / denom + 1) / 2);
}

function rollDegreesFromEyes(landmarks: Array<{ x: number; y: number }>) {
  const pts = pickKeypoints(landmarks);
  if (!pts) return null;
  const dx = pts.re.x - pts.le.x;
  const dy = pts.re.y - pts.le.y;
  if (!dx && !dy) return null;
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

function faceOccupancyRatio(landmarks: Array<{ x: number; y: number }>) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of landmarks) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const w = Math.max(1e-6, maxX - minX);
  const h = Math.max(1e-6, maxY - minY);
  const area = w * h; // normalized since landmarks are 0..1
  return clamp01(area);
}

export async function runPassportGate(params: {
  selfieDataUrl: string;
  ghanaCardFrontDataUrl: string;
  tiltMaxDegrees?: number; // default 15
}): Promise<PassportGateResult> {
  const tiltMax = params.tiltMaxDegrees ?? 15;
  const reasons: string[] = [];

  const [selfieImg, cardImg] = await Promise.all([
    dataUrlToImage(params.selfieDataUrl),
    dataUrlToImage(params.ghanaCardFrontDataUrl),
  ]);

  const selfieCanvas = drawToCanvas(selfieImg, 520).canvas;
  const cardCanvas = drawToCanvas(cardImg, 720).canvas;

  // Block obvious filters / stickers locally.
  const natSelfie = naturalImageHeuristics(selfieCanvas);
  if (!natSelfie.ok) reasons.push(natSelfie.reason || 'Selfie looks edited.');
  const natCard = naturalImageHeuristics(cardCanvas);
  if (!natCard.ok) reasons.push(natCard.reason || 'Ghana Card photo looks edited.');

  const landmarker = await getFaceLandmarker();
  const [selfieRes, cardRes] = await Promise.all([
    landmarker.detect(selfieCanvas),
    landmarker.detect(cardCanvas),
  ]);

  const selfieLm = selfieRes.faceLandmarks?.[0] ?? null;
  const cardLm = cardRes.faceLandmarks?.[0] ?? null;

  if (!selfieLm) reasons.push('No face detected in selfie. Use a clear passport-style selfie.');
  if (!cardLm) reasons.push('No face detected on Ghana Card front image. Retake the card photo straight.');

  if (!selfieLm || !cardLm) {
    return { ok: false, decision: 'reject', reasons };
  }

  // Tilt detection via roll angle from eye-line.
  const selfieRoll = rollDegreesFromEyes(selfieLm);
  const cardRoll = rollDegreesFromEyes(cardLm);
  if (typeof selfieRoll === 'number' && Math.abs(selfieRoll) > tiltMax) {
    reasons.push('Please align your camera straight to the document/face.');
  }
  if (typeof cardRoll === 'number' && Math.abs(cardRoll) > tiltMax) {
    reasons.push('Please align your camera straight to the document/face.');
  }

  // Passport-style framing: face occupancy 60–70% is extremely strict for real selfies.
  // We enforce a tighter *range* around a "passport-like" crop, but not so strict that it blocks everyone.
  const occ = faceOccupancyRatio(selfieLm);
  if (occ < 0.20) reasons.push('Move closer: your face should fill most of the frame (passport-style).');
  if (occ > 0.72) reasons.push('Step back slightly: your face is too close to the camera.');

  // Landmark similarity (aging/hair resilient signature).
  const sigSelfie = facialSignature(selfieLm);
  const sigCard = facialSignature(cardLm);
  if (!sigSelfie || !sigCard) {
    reasons.push('Could not extract facial landmarks. Retake a clear, natural passport-style selfie.');
    return { ok: false, decision: 'reject', reasons };
  }
  const score = cosineSimilarity(sigSelfie, sigCard);

  // Decision thresholds (as requested)
  // >=0.80 pass, 0.60–0.79 manual review, <0.50 reject immediately
  if (score < 0.50) {
    reasons.push('Mismatch detected between Ghana Card portrait and selfie. Please retake a natural passport-style selfie.');
    return { ok: false, similarityScore: score, decision: 'reject', reasons };
  }

  // Quality rules take precedence: if reasons exist from tilt/editing/framing, block even if similarity is high.
  if (reasons.length > 0) {
    return { ok: false, similarityScore: score, decision: 'reject', reasons };
  }

  if (score >= 0.80) {
    return { ok: true, similarityScore: score, decision: 'pass' };
  }
  if (score >= 0.60) {
    return { ok: true, similarityScore: score, decision: 'manual_review' };
  }

  // 0.50–0.59: treat as reject to match the spec (below 0.5 reject immediately; this band is still risky)
  return {
    ok: false,
    similarityScore: score,
    decision: 'reject',
    reasons: ['Mismatch detected between Ghana Card portrait and selfie. Please retake a natural passport-style selfie.'],
  };
}

export async function runDocumentGate(params: {
  imageDataUrl: string;
  tiltMaxDegrees?: number;
}): Promise<DocumentGateResult> {
  const tiltMax = params.tiltMaxDegrees ?? 15;
  const reasons: string[] = [];

  const img = await dataUrlToImage(params.imageDataUrl);
  const canvas = drawToCanvas(img, 720).canvas;

  const nat = naturalImageHeuristics(canvas);
  if (!nat.ok) reasons.push(nat.reason || 'Image looks edited.');

  const tilt = estimateTiltDegreesFromEdges(canvas);
  if (typeof tilt === 'number' && tilt > tiltMax) {
    reasons.push('Please align your camera straight to the document/face.');
  }

  if (reasons.length) return { ok: false, tiltDegrees: tilt, reasons };
  return { ok: true, tiltDegrees: tilt };
}

