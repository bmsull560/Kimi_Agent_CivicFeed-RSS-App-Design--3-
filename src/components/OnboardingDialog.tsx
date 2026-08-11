import { useEffect, useId, useRef, useState } from "react";
import { Check, Compass, LayoutDashboard, Newspaper } from "lucide-react";
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
  {
    key: "realtime",
    label: "Real-time stream",
    description: "Browse updates as soon as they are available.",
  },
  { key: "daily", label: "Daily briefing", description: "Use a focused morning briefing rhythm." },
  {
    key: "weekly",
    label: "Weekly review",
    description: "Catch up with a broader weekly overview.",
  },
] as const;

type Frequency = (typeof frequencies)[number]["key"];

interface OnboardingDialogProps {
  open: boolean;
  onComplete: () => void;
  onDismiss: () => void;
}

export default function OnboardingDialog({ open, onComplete, onDismiss }: OnboardingDialogProps) {
  const [step, setStep] = useState(1);
  const [selectedHubs, setSelectedHubs] = useState<string[]>(() => {
    const prefs = getPreferences();
    return prefs.followedHubs?.length ? prefs.followedHubs : [];
  });
  const [frequency, setFrequency] = useState<Frequency | null>(() => {
    const prefs = getPreferences();
    return prefs.digestFrequency || null;
  });
  const titleRef = useRef<HTMLHeadingElement>(null);
  const topicHelpId = useId();
  const frequencyHelpId = useId();

  useEffect(() => {
    if (open) titleRef.current?.focus();
  }, [open, step]);

  const toggleHub = (key: string) => {
    setSelectedHubs((previous) =>
      previous.includes(key) ? previous.filter((hubKey) => hubKey !== key) : [...previous, key]
    );
  };

  const handleDismiss = () => {
    updatePreferences({ onboardingDismissed: true });
    onDismiss();
  };

  const handleFinish = () => {
    if (selectedHubs.length === 0 || !frequency) return;
    updatePreferences({
      onboardingComplete: true,
      onboardingDismissed: false,
      followedHubs: selectedHubs,
      digestFrequency: frequency,
    });
    onComplete();
  };

  const canContinue = step === 1 ? selectedHubs.length > 0 : frequency !== null;
  const frequencyLabel = frequencies.find((item) => item.key === frequency)?.label;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && handleDismiss()}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-4 sm:max-w-md sm:p-6"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          titleRef.current?.focus();
        }}
      >
        <DialogHeader>
          <p className="text-xs font-semibold text-blue-700 dark:text-blue-300" aria-live="polite">
            Step {step} of 3
          </p>
          <div className="flex items-center gap-1" aria-hidden="true">
            {[1, 2, 3].map((item) => (
              <span
                key={item}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  item <= step ? "bg-blue-600" : "bg-slate-200 dark:bg-slate-700"
                }`}
              />
            ))}
          </div>
          {step === 1 && (
            <>
              <DialogTitle ref={titleRef} tabIndex={-1} className="font-serif text-xl">
                Choose topics that matter to you
              </DialogTitle>
              <DialogDescription className="text-slate-700 dark:text-slate-300">
                We&apos;ll prioritize these civic updates on your dashboard. You can change them
                later with Personalize.
              </DialogDescription>
            </>
          )}
          {step === 2 && (
            <>
              <DialogTitle ref={titleRef} tabIndex={-1} className="font-serif text-xl">
                Choose your briefing rhythm
              </DialogTitle>
              <DialogDescription className="text-slate-700 dark:text-slate-300">
                This preference labels and organizes your briefing; CivicFeed does not send
                notifications or email.
              </DialogDescription>
            </>
          )}
          {step === 3 && (
            <>
              <DialogTitle ref={titleRef} tabIndex={-1} className="font-serif text-xl">
                Your CivicFeed is ready
              </DialogTitle>
              <DialogDescription className="text-slate-700 dark:text-slate-300">
                Start on the dashboard, discover trusted sources, and open any entry to read it.
              </DialogDescription>
            </>
          )}
        </DialogHeader>

        {step === 1 && (
          <fieldset className="grid grid-cols-1 gap-2 py-2" aria-describedby={topicHelpId}>
            <legend className="sr-only">Topics to follow</legend>
            {thematicHubs.map((hub) => {
              const selected = selectedHubs.includes(hub.key);
              return (
                <label
                  key={hub.key}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2 ${
                    selected
                      ? "border-blue-600 bg-blue-50 dark:bg-blue-950/40"
                      : "border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={selected}
                    onChange={() => toggleHub(hub.key)}
                  />
                  <span
                    className={selected ? "text-blue-600" : "text-slate-500"}
                    aria-hidden="true"
                  >
                    {hub.icon}
                  </span>
                  <span className="flex-1 text-sm font-medium text-slate-900 dark:text-slate-100">
                    {hub.label}
                  </span>
                  <span
                    className={`flex size-5 items-center justify-center rounded-full border ${
                      selected
                        ? "border-blue-600 bg-blue-600 text-white"
                        : "border-slate-300 dark:border-slate-600"
                    }`}
                    aria-hidden="true"
                  >
                    {selected && <Check size={12} />}
                  </span>
                </label>
              );
            })}
            <p id={topicHelpId} className="text-xs text-slate-600 dark:text-slate-300">
              Select at least one topic to continue.
            </p>
          </fieldset>
        )}

        {step === 2 && (
          <fieldset className="grid grid-cols-1 gap-2 py-2" aria-describedby={frequencyHelpId}>
            <legend className="sr-only">Briefing frequency</legend>
            {frequencies.map((item) => {
              const selected = frequency === item.key;
              return (
                <label
                  key={item.key}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2 ${
                    selected
                      ? "border-blue-600 bg-blue-50 dark:bg-blue-950/40"
                      : "border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                  }`}
                >
                  <input
                    type="radio"
                    name="briefing-frequency"
                    value={item.key}
                    checked={selected}
                    onChange={() => setFrequency(item.key)}
                    className="mt-0.5 size-4 accent-blue-600"
                  />
                  <span className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {item.label}
                    </span>
                    <span className="text-xs text-slate-600 dark:text-slate-300">
                      {item.description}
                    </span>
                  </span>
                </label>
              );
            })}
            <p id={frequencyHelpId} className="text-xs text-slate-600 dark:text-slate-300">
              Select one briefing rhythm to continue.
            </p>
          </fieldset>
        )}

        {step === 3 && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-slate-700 dark:text-slate-300">
              Following <strong>{selectedHubs.length}</strong>{" "}
              {selectedHubs.length === 1 ? "topic" : "topics"} with the{" "}
              <strong>{frequencyLabel}</strong>.
            </p>
            <ol className="space-y-3 text-sm" aria-label="Getting started">
              <li className="flex gap-3">
                <LayoutDashboard
                  className="mt-0.5 size-4 shrink-0 text-blue-600"
                  aria-hidden="true"
                />
                <span>
                  <strong>Browse your dashboard</strong> for prioritized topics and recent entries.
                </span>
              </li>
              <li className="flex gap-3">
                <Compass className="mt-0.5 size-4 shrink-0 text-blue-600" aria-hidden="true" />
                <span>
                  <strong>Discover feeds</strong> to explore or enable trusted civic sources.
                </span>
              </li>
              <li className="flex gap-3">
                <Newspaper className="mt-0.5 size-4 shrink-0 text-blue-600" aria-hidden="true" />
                <span>
                  <strong>Open an entry</strong> to read, bookmark, archive, or visit its source.
                </span>
              </li>
            </ol>
          </div>
        )}

        <DialogFooter className="sm:justify-between">
          <Button type="button" variant="ghost" onClick={handleDismiss}>
            Not now
          </Button>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            {step > 1 && (
              <Button type="button" variant="outline" onClick={() => setStep((value) => value - 1)}>
                Back
              </Button>
            )}
            {step < 3 ? (
              <Button
                type="button"
                onClick={() => setStep((value) => value + 1)}
                disabled={!canContinue}
              >
                Continue
              </Button>
            ) : (
              <Button type="button" onClick={handleFinish}>
                Start reading
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
