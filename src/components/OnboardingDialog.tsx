import { useState } from "react";
import { Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { thematicHubs } from "../lib/hubs";
import { updatePreferences, getPreferences } from "../lib/userData";

const frequencies = [
  { key: "realtime", label: "The Real-Time Stream", description: "Best for policy professionals" },
  { key: "daily", label: "The Daily Briefing", description: "Every morning at 8:00 AM" },
  { key: "weekly", label: "The Weekly Review", description: "Delivered Saturday morning" },
] as const;

interface OnboardingDialogProps {
  open: boolean;
  onComplete: () => void;
}

export default function OnboardingDialog({ open, onComplete }: OnboardingDialogProps) {
  const [step, setStep] = useState(1);
  const [selectedHubs, setSelectedHubs] = useState<string[]>(() => {
    const prefs = getPreferences();
    return prefs.followedHubs?.length ? prefs.followedHubs : [];
  });
  const [frequency, setFrequency] = useState<"realtime" | "daily" | "weekly" | null>(() => {
    const prefs = getPreferences();
    return prefs.digestFrequency || null;
  });

  const toggleHub = (key: string) => {
    setSelectedHubs((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleFinish = () => {
    updatePreferences({
      onboardingComplete: true,
      followedHubs: selectedHubs,
      digestFrequency: frequency,
    });
    onComplete();
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-center gap-1 mb-2">
            {[1, 2, 3].map((s) => (
              <span
                key={s}
                className={`h-1.5 rounded-full transition-all ${
                  s === step ? "w-6 bg-blue-600" : "w-1.5 bg-slate-200 dark:bg-slate-700"
                }`}
                aria-hidden="true"
              />
            ))}
          </div>
          {step === 1 && (
            <>
              <DialogTitle className="font-serif text-xl">
                What impacts your daily life?
              </DialogTitle>
              <DialogDescription>
                Select the government topics you care about. We&apos;ll surface the most relevant
                updates from 505 federal feeds.
              </DialogDescription>
            </>
          )}
          {step === 2 && (
            <>
              <DialogTitle className="font-serif text-xl">Choose your briefing rhythm</DialogTitle>
              <DialogDescription>
                Pick how often you want a curated digest. You can change this anytime.
              </DialogDescription>
            </>
          )}
          {step === 3 && (
            <>
              <DialogTitle className="font-serif text-xl">You&apos;re all set</DialogTitle>
              <DialogDescription>
                Welcome to Civic Clarity. Your personalized briefing is ready.
              </DialogDescription>
            </>
          )}
        </DialogHeader>

        {step === 1 && (
          <div className="grid grid-cols-1 gap-2 py-2">
            {thematicHubs.map((hub) => {
              const selected = selectedHubs.includes(hub.key);
              return (
                <button
                  key={hub.key}
                  onClick={() => toggleHub(hub.key)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors ${
                    selected
                      ? "border-blue-600 bg-blue-50 dark:bg-blue-950/40"
                      : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                  }`}
                  type="button"
                  aria-pressed={selected}
                >
                  <span className={selected ? "text-blue-600" : "text-slate-500"}>{hub.icon}</span>
                  <span className="flex-1 text-sm font-medium text-slate-900 dark:text-slate-100">
                    {hub.label}
                  </span>
                  <span
                    className={`size-5 rounded-full border flex items-center justify-center ${
                      selected
                        ? "border-blue-600 bg-blue-600 text-white"
                        : "border-slate-300 dark:border-slate-600"
                    }`}
                  >
                    {selected && <Check size={12} />}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {step === 2 && (
          <div className="grid grid-cols-1 gap-2 py-2">
            {frequencies.map((freq) => {
              const selected = frequency === freq.key;
              return (
                <button
                  key={freq.key}
                  onClick={() => setFrequency(freq.key)}
                  className={`flex flex-col gap-1 px-4 py-3 rounded-xl border text-left transition-colors ${
                    selected
                      ? "border-blue-600 bg-blue-50 dark:bg-blue-950/40"
                      : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                  }`}
                  type="button"
                  aria-pressed={selected}
                >
                  <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {freq.label}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {freq.description}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {step === 3 && (
          <div className="py-4 text-center">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              You&apos;re following{" "}
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {selectedHubs.length}
              </span>{" "}
              {selectedHubs.length === 1 ? "topic" : "topics"} with the{" "}
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {frequency
                  ? frequencies.find((f) => f.key === frequency)?.label.toLowerCase()
                  : "real-time stream"}
              </span>
              .
            </p>
          </div>
        )}

        <DialogFooter>
          {step > 1 && (
            <Button type="button" variant="outline" onClick={() => setStep((s) => s - 1)}>
              Back
            </Button>
          )}
          {step < 3 ? (
            <Button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              disabled={step === 1 && selectedHubs.length === 0}
            >
              Continue
            </Button>
          ) : (
            <Button type="button" onClick={handleFinish}>
              Start reading
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
