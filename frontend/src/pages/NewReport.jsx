import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, MapPin, Camera, X } from "lucide-react";
import { toast } from "sonner";
import { api, apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { AppHeader } from "@/components/AppHeader";
import { WasteMap } from "@/components/WasteMap";

const MAX_EDGE = 1280;

function downscale(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("That file couldn't be read. Try another photo."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("That file isn't a readable image. Use a JPG or PNG."));
      img.onload = () => {
        const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.75));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export default function NewReport() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [photo, setPhoto] = useState("");
  const [point, setPoint] = useState(null);
  const [description, setDescription] = useState("");
  const [locError, setLocError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const locate = () => {
    setLocError("");
    if (!navigator.geolocation) {
      setLocError("This browser can't share a location. Tap the map to drop the pin yourself.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setPoint([pos.coords.latitude, pos.coords.longitude]),
      (err) => {
        const msgs = {
          1: "Location permission denied — enable it in your browser settings, or tap the map to place the pin.",
          2: "Your device couldn't get a fix. Tap the map to place the pin manually.",
          3: "Location lookup timed out. Tap the map to place the pin manually.",
        };
        setLocError(msgs[err.code] || "Location is unavailable. Tap the map to place the pin manually.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  useEffect(() => {
    locate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      setError("That format isn't supported — upload a JPG, PNG or WEBP photo.");
      return;
    }
    setError("");
    try {
      setPhoto(await downscale(file));
    } catch (err) {
      setError(err.message);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!photo) return setError("Add a photo — crews won't dispatch on a description alone.");
    if (!point) return setError("Drop a pin on the map so the crew knows where to go.");
    if (description.trim().length < 10)
      return setError("Add at least a short line of context (10 characters or more).");
    setError("");
    setBusy(true);
    try {
      const { data } = await api.post("/reports", {
        photo_url: photo,
        lat: point[0],
        lng: point[1],
        description,
      });
      toast.success(`Filed. Triaged as ${data.priority}.`);
      navigate(`/reports/${data.id}`);
    } catch (err) {
      setError(apiError(err, "The report didn't save. Check your connection and try again."));
    } finally {
      setBusy(false);
    }
  };

  const coords = useMemo(
    () => (point ? `${point[0].toFixed(5)}, ${point[1].toFixed(5)}` : "No pin placed"),
    [point],
  );

  return (
    <div className="min-h-screen wx-surface">
      <AppHeader />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 pb-16">
        <h1 className="font-display font-extrabold text-3xl sm:text-4xl text-ink-deep">Report waste</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Filing as {user?.name}. Priority is set by the triage model from your photo — you can't set it yourself, and
          that's the point.
        </p>

        <form onSubmit={submit} className="mt-8 space-y-8" data-testid="report-form">
          <section>
            <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-muted font-semibold">
              1 — Photo of the site
            </h2>
            {photo ? (
              <div className="mt-3 relative border border-hairline bg-white overflow-hidden rounded-xl">
                <img src={photo} alt="Waste site you are reporting" className="w-full h-64 object-cover" data-testid="report-photo-preview" />
                <button
                  type="button"
                  data-testid="report-photo-clear"
                  onClick={() => setPhoto("")}
                  className="absolute top-2 right-2 bg-ink-deep/90 text-white p-2 rounded-lg hover:bg-ink-deep transition-colors"
                  aria-label="Remove photo"
                >
                  <X size={15} />
                </button>
              </div>
            ) : (
              <label
                htmlFor="photo"
                className="mt-3 flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-300 bg-white py-12 cursor-pointer rounded-xl transition-colors hover:border-emerald-500 hover:bg-emerald-50/30"
              >
                <span className="grid h-12 w-12 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
                  <Camera size={22} />
                </span>
                <span className="text-sm font-semibold text-ink">Take or upload a photo</span>
                <span className="text-xs text-ink-muted">JPG, PNG or WEBP</span>
                <input
                  id="photo"
                  data-testid="report-photo-input"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  onChange={onFile}
                  className="sr-only"
                />
              </label>
            )}
          </section>

          <section>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-muted font-semibold">
                2 — Location
              </h2>
              <button
                type="button"
                data-testid="report-locate-button"
                onClick={locate}
                className="wx-btn wx-btn-ghost px-3 py-1.5 text-xs"
              >
                <MapPin size={13} /> Use my location
              </button>
            </div>
            <p className="mt-2 text-xs text-ink-muted">Tap anywhere on the map to move the pin.</p>
            <div className="mt-3 overflow-hidden rounded-xl border border-hairline">
              <WasteMap
                testId="report-picker-map"
                className="h-64 sm:h-80 w-full"
                pickMode
                pickedPoint={point}
                onPick={(lat, lng) => setPoint([lat, lng])}
              />
            </div>
            <p className="mt-2 font-mono text-[11px] text-ink-muted tabnum" data-testid="report-coords">
              {coords}
            </p>
            {locError && (
              <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800" data-testid="report-location-error">
                {locError}
              </p>
            )}
          </section>

          <section>
            <label htmlFor="desc" className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-muted font-semibold">
              3 — What's there
            </label>
            <textarea
              id="desc"
              data-testid="report-description-input"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Bags dumped at the alley mouth, blocking the drain grate since Sunday."
              className="wx-field mt-3 resize-y"
            />
          </section>

          {error && (
            <p data-testid="report-error" className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            data-testid="report-submit-button"
            className="wx-btn wx-btn-emerald w-full py-3.5"
          >
            {busy && <Loader2 size={16} className="animate-spin" />}
            {busy ? "Reading the photo and scoring priority…" : "Submit report"}
          </button>
        </form>
      </main>
    </div>
  );
}
