import { useEffect, useState } from "react";
import jsQR from "jsqr";

/**
 * useQrScanner — camera-based QR decoding with jsQR.
 *
 * Starts the rear camera when `enabled` flips true, samples frames into an
 * offscreen canvas and decodes QR content. Falls back with a clear error when
 * the camera is unavailable (permissions, no device, insecure origin).
 *
 * Returns the decoded text once (calls onResult), plus live status flags.
 */
export function useQrScanner({
  enabled,
  onResult,
}: {
  enabled: boolean;
  onResult: (text: string) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    let stream: MediaStream | null = null;
    let raf = 0;
    let cancelled = false;
    const video = document.createElement("video");
    video.setAttribute("playsinline", "true");
    video.muted = true;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    const tick = () => {
      if (cancelled) return;
      if (video.readyState === video.HAVE_ENOUGH_DATA && ctx) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        try {
          const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
          if (code?.data) {
            onResult(code.data.trim());
            return; // stop scanning after a hit
          }
        } catch {
          /* frame not ready — next tick */
        }
      }
      raf = requestAnimationFrame(tick);
    };

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Camera is not supported in this browser (requires HTTPS or localhost)");
        }
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((tr) => tr.stop());
          return;
        }
        video.srcObject = stream;
        await video.play();
        setScanning(true);
        raf = requestAnimationFrame(tick);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.name === "NotAllowedError"
              ? "Camera permission denied — allow camera access and try again."
              : err.message
            : "Could not start the camera"
        );
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      setScanning(false);
      stream?.getTracks().forEach((tr) => tr.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return { error, scanning };
}
