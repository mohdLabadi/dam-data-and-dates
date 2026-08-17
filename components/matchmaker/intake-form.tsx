"use client";

import { Sparkles, Timer, WandSparkles, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type IntakeValues = {
  firstName: string;
  age: string;
  preferredAgeMin: string;
  preferredAgeMax: string;
  location: string;
  maxDistanceMiles: string;
  religionPreference: string;
  relationshipGoal: string;
  interestedIn: string;
  smokingPreference: string;
  drinkingPreference: string;
  hobbies: string[];
  partnerQualities: string[];
  values: string[];
  dealbreakers: string[];
  lifestyle: string;
};

const initialValues: IntakeValues = {
  firstName: "",
  age: "",
  preferredAgeMin: "",
  preferredAgeMax: "",
  location: "",
  maxDistanceMiles: "",
  religionPreference: "open",
  relationshipGoal: "",
  interestedIn: "",
  smokingPreference: "prefer_non_smoker",
  drinkingPreference: "social_ok",
  hobbies: [],
  partnerQualities: [],
  values: [],
  dealbreakers: [],
  lifestyle: "",
};

const relationshipGoals = [
  { value: "dating", label: "Dating" },
  { value: "serious", label: "Serious relationship" },
  { value: "casual", label: "Casual dating" },
  { value: "friendship", label: "Friendship" },
  { value: "collaboration", label: "Collab" },
  { value: "networking", label: "Networking" },
  { value: "employee", label: "Empoloyee" },
  { value: "open", label: "Open to possibilities" },
];

const interestedInOptions = [
  { value: "women", label: "Women" },
  { value: "men", label: "Men" },
  { value: "nonbinary", label: "Non-binary people" },
  { value: "all-genders", label: "All genders" },
  { value: "other", label: "Prefer to describe in chat" },
];

const religionOptions = [
  { value: "open", label: "Open / no strong preference" },
  { value: "christian", label: "Christian" },
  { value: "muslim", label: "Muslim" },
  { value: "jewish", label: "Jewish" },
  { value: "hindu", label: "Hindu" },
  { value: "buddhist", label: "Buddhist" },
  { value: "agnostic", label: "Agnostic" },
  { value: "atheist", label: "Atheist" },
  { value: "spiritual", label: "Spiritual" },
];

const smokingOptions = [
  { value: "prefer_non_smoker", label: "Prefer non-smoker" },
  { value: "dealbreaker", label: "Smoking is a dealbreaker" },
  { value: "ok", label: "Smoking is okay" },
];

const drinkingOptions = [
  { value: "no_drinking", label: "No drinking" },
  { value: "social_ok", label: "Social drinking is okay" },
  { value: "dealbreaker", label: "Heavy drinking is a dealbreaker" },
  { value: "ok", label: "Open to any drinking style" },
];

const truncate = (value: string, max: number) => value.trim().slice(0, max);

const normalizeTag = (value: string) =>
  value.trim().replace(/\s+/g, " ").slice(0, 40);

const labelByValue = (
  value: string,
  options: Array<{ value: string; label: string }>
) => {
  return options.find((option) => option.value === value)?.label ?? value;
};

function buildIntakePrompt(values: IntakeValues, isTestMode = false) {
  const lines = [
    isTestMode
      ? "I am using test mode with fictional placeholder values. Please generate a demo set of profiles only; do not treat these details as real preferences."
      : "I completed your dating intake form. Please generate my first set of matches now.",
    `Name: ${truncate(values.firstName, 80) || "Not provided"}`,
    `My age: ${truncate(values.age, 3) || "Not provided"}`,
    `Age range preference: ${values.preferredAgeMin && values.preferredAgeMax ? `${truncate(values.preferredAgeMin, 3)}-${truncate(values.preferredAgeMax, 3)}` : "Open"}`,
    `Location and distance preference: ${truncate(values.location, 120) || "Open"}`,
    `Maximum distance: ${truncate(values.maxDistanceMiles, 3) || "Open"} miles`,
    `Connection goal: ${labelByValue(values.relationshipGoal, relationshipGoals) || "Not provided"}`,
    `Interested in: ${labelByValue(values.interestedIn, interestedInOptions) || "Not provided"}`,
    `Religion preference: ${labelByValue(values.religionPreference, religionOptions)}`,
    `Smoking preference: ${labelByValue(values.smokingPreference, smokingOptions)}`,
    `Drinking preference: ${labelByValue(values.drinkingPreference, drinkingOptions)}`,
    `Hobbies and interests: ${values.hobbies.length > 0 ? values.hobbies.join(", ") : "Not provided"}`,
    `Top qualities I want in a partner: ${values.partnerQualities.length > 0 ? values.partnerQualities.join(", ") : "Not provided"}`,
    `My own core values (what matters to me fundamentally): ${values.values.length > 0 ? values.values.join(", ") : "Not provided"}`,
    `Dealbreakers: ${values.dealbreakers.length > 0 ? values.dealbreakers.join(", ") : "Not provided"}`,
    `Lifestyle notes: ${truncate(values.lifestyle, 220) || "Not provided"}`,
    "Please create profiles immediately, then we can refine together in chat. Do not ask additional intake questions first.",
  ];

  return lines.join("\n").slice(0, 1900);
}

const testValues: IntakeValues = {
  firstName: "Jordan",
  age: "29",
  preferredAgeMin: "27",
  preferredAgeMax: "36",
  location: "New York, NY",
  maxDistanceMiles: "25",
  religionPreference: "open",
  relationshipGoal: "serious",
  interestedIn: "all-genders",
  smokingPreference: "prefer_non_smoker",
  drinkingPreference: "social_ok",
  hobbies: ["Reading", "Trying new restaurants", "Weekend hikes"],
  partnerQualities: ["Kind", "Curious", "Emotionally available"],
  values: ["Growth", "Honesty"],
  dealbreakers: ["Dishonesty"],
  lifestyle: "Fictional sample preferences for a product demonstration.",
};

function TagInput({
  id,
  label,
  description,
  placeholder,
  tags,
  onChange,
}: {
  id: string;
  label: string;
  description?: string;
  placeholder: string;
  tags: string[];
  onChange: (nextTags: string[]) => void;
}) {
  const [value, setValue] = useState("");

  const pushTag = (raw: string) => {
    const normalized = normalizeTag(raw);
    if (!normalized) {
      return;
    }

    if (tags.some((tag) => tag.toLowerCase() === normalized.toLowerCase())) {
      return;
    }

    onChange([...tags, normalized]);
  };

  const commitBuffer = () => {
    pushTag(value);
    setValue("");
  };

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {description && (
        <p className="text-xs text-muted-foreground -mt-1">{description}</p>
      )}
      <div className="rounded-md border bg-background p-2">
        <div className="mb-2 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <Badge className="gap-1" key={tag} variant="secondary">
              {tag}
              <button
                aria-label={`Remove ${tag}`}
                className="rounded-full p-0.5 hover:bg-muted"
                onClick={() => onChange(tags.filter((item) => item !== tag))}
                type="button"
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>

        <Input
          id={id}
          onBlur={commitBuffer}
          onChange={(event) => {
            const next = event.target.value;
            if (next.includes(",")) {
              const chunks = next.split(",");
              for (const chunk of chunks.slice(0, -1)) {
                pushTag(chunk);
              }
              setValue(chunks.at(-1) ?? "");
              return;
            }
            setValue(next);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              commitBuffer();
              return;
            }

            if (
              event.key === "Backspace" &&
              value.length === 0 &&
              tags.length > 0
            ) {
              onChange(tags.slice(0, -1));
            }
          }}
          placeholder={placeholder}
          value={value}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Tip: press comma or Enter to create each bubble.
      </p>
    </div>
  );
}

function PrivacyPolicy() {
  return (
    <footer className="mt-5 border-t pt-4 text-xs leading-relaxed text-muted-foreground">
      <p className="font-semibold text-foreground">Strict privacy policy</p>
      <p className="mt-1">
        Enter only information you are comfortable sharing. We use your intake
        answers, chat messages, and feedback to provide this service and send
        them to our AI provider to generate fictional profiles. Do not submit
        another person&apos;s sensitive or identifying information. We do not
        sell your personal information. Test-mode values are fictional and must
        not be used to make real-world decisions. By continuing, you acknowledge
        this is an experimental AI service and that generated profiles are not
        real people or professional advice.
      </p>
    </footer>
  );
}

function WelcomeScreen({
  onAcknowledge,
  onStartTest,
  isSubmitting,
}: {
  onAcknowledge: () => void;
  onStartTest: () => void;
  isSubmitting: boolean;
}) {
  const [showTestConfirmation, setShowTestConfirmation] = useState(false);
  const [acknowledgesTestMode, setAcknowledgesTestMode] = useState(false);

  return (
    <div className="mx-auto w-full max-w-2xl px-3 pb-6 pt-4 md:px-4">
      <Card className="overflow-hidden border-border/80">
        <CardHeader className="bg-muted/40 pb-4">
          <CardTitle className="text-xl md:text-2xl">
            Welcome to DAM — your AI matchmaker
          </CardTitle>
          <CardDescription>
            Before we get started, here&apos;s exactly how this works.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-4 md:p-6">
          <div className="flex flex-col gap-5 text-sm text-muted-foreground">
            <div className="flex flex-col gap-1.5">
              <p className="font-semibold text-foreground">What DAM does</p>
              <p>
                DAM is an AI-powered matchmaking assistant. You share your
                preferences once, and it generates three realistic dating
                profiles tailored to what you&apos;re looking for — a close
                match, a moderate stretch, and an exploratory pick.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <p className="font-semibold text-foreground">
                What information we use
              </p>
              <ul className="ml-4 list-disc space-y-1">
                <li>Basic details you enter: age, location, and goals</li>
                <li>
                  Your preferences: interests, personality traits, values, and
                  dealbreakers
                </li>
                <li>
                  Your swipe feedback: which profiles you liked or passed on
                </li>
              </ul>
            </div>

            <div className="flex flex-col gap-1.5">
              <p className="font-semibold text-foreground">
                How recommendations are made
              </p>
              <p>
                Your answers are sent to an AI language model (Google Gemini)
                which interprets your preferences and generates fictional but
                plausible profiles. No real person&apos;s data is used. Profiles
                are generated fresh each session.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <p className="font-semibold text-foreground">
                How your feedback helps
              </p>
              <p>
                After you swipe through your matches, DAM asks why you liked or
                passed on each profile. Your answers refine the next round of
                suggestions within the same conversation.
              </p>
            </div>

            <div className="overflow-hidden rounded-xl border border-primary/25 bg-gradient-to-br from-primary/10 via-background to-background">
              <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <WandSparkles className="size-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">
                      In a hurry? See the magic first.
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      We&apos;ll introduce a fictional dater and create a sample
                      set of matches — no form required.
                    </p>
                    <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-primary">
                      <Timer className="size-3.5" />A 30-second product tour
                    </div>
                  </div>
                </div>
                {!showTestConfirmation && (
                  <Button
                    className="shrink-0"
                    onClick={() => setShowTestConfirmation(true)}
                    type="button"
                    variant="secondary"
                  >
                    <Sparkles />
                    Show me a demo
                  </Button>
                )}
              </div>

              {showTestConfirmation && (
                <div className="border-t border-primary/20 bg-background/80 p-4">
                  <p className="font-semibold text-foreground">
                    One quick reality check
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    The name, preferences, and profiles in this tour are
                    fictional. This is a preview of DAM, not a real matching
                    session.
                  </p>
                  <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm text-foreground">
                    <input
                      checked={acknowledgesTestMode}
                      className="mt-0.5 size-4 accent-primary"
                      onChange={(event) =>
                        setAcknowledgesTestMode(event.target.checked)
                      }
                      type="checkbox"
                    />
                    <span>I understand this is a fictional product demo.</span>
                  </label>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      disabled={!acknowledgesTestMode || isSubmitting}
                      onClick={onStartTest}
                      type="button"
                    >
                      <Sparkles />
                      Start the fictional demo
                    </Button>
                    <Button
                      onClick={() => setShowTestConfirmation(false)}
                      type="button"
                      variant="ghost"
                    >
                      Not now
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <Button className="px-6" onClick={onAcknowledge} type="button">
              I&apos;ll create my own profile
            </Button>
          </div>
          <PrivacyPolicy />
        </CardContent>
      </Card>
    </div>
  );
}

export function IntakeForm({
  onSubmit,
  isSubmitting,
}: {
  onSubmit: (prompt: string) => void;
  isSubmitting: boolean;
}) {
  const [step, setStep] = useState<"welcome" | "form">("welcome");
  const [values, setValues] = useState<IntakeValues>(initialValues);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const canSubmit = useMemo(() => {
    const age = Number(values.age);
    const preferredAgeMin = Number(values.preferredAgeMin);
    const preferredAgeMax = Number(values.preferredAgeMax);

    return Boolean(
      values.firstName.trim().length >= 2 &&
        Number.isFinite(age) &&
        age >= 18 &&
        age <= 99 &&
        Number.isFinite(preferredAgeMin) &&
        Number.isFinite(preferredAgeMax) &&
        preferredAgeMin >= 18 &&
        preferredAgeMax <= 99 &&
        preferredAgeMin <= preferredAgeMax &&
        values.relationshipGoal &&
        values.interestedIn &&
        values.hobbies.length > 0 &&
        values.partnerQualities.length > 0
    );
  }, [values]);

  if (isMounted && step === "welcome") {
    return (
      <WelcomeScreen
        isSubmitting={isSubmitting}
        onAcknowledge={() => setStep("form")}
        onStartTest={() => onSubmit(buildIntakePrompt(testValues, true))}
      />
    );
  }

  if (!isMounted) {
    return (
      <div className="mx-auto w-full max-w-5xl px-3 pb-6 pt-4 md:px-4">
        <Card className="border-border/80">
          <CardHeader className="bg-muted/40 pb-4">
            <CardTitle className="text-xl md:text-2xl">
              Build your dating profile
            </CardTitle>
            <CardDescription>Loading your intake form...</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-3 pb-6 pt-4 md:px-4">
      <Card className="overflow-hidden border-border/80">
        <CardHeader className="bg-muted/40 pb-4">
          <CardTitle className="text-xl md:text-2xl">
            Build your dating profile
          </CardTitle>
          <CardDescription>
            Share your basics and preferences. We will generate matches
            immediately after submit.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-4 md:p-6">
          <form
            className="grid grid-cols-1 gap-5 md:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (!canSubmit || isSubmitting) {
                return;
              }
              onSubmit(buildIntakePrompt(values));
            }}
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="firstName">First name *</Label>
              <Input
                id="firstName"
                inputMode="text"
                maxLength={80}
                onChange={(event) =>
                  setValues((prev) => ({
                    ...prev,
                    firstName: event.target.value.replace(/[^a-zA-Z\s'-]/g, ""),
                  }))
                }
                placeholder="Alex"
                required
                value={values.firstName}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="age">Your age *</Label>
              <Input
                id="age"
                inputMode="numeric"
                max={99}
                min={18}
                onChange={(event) =>
                  setValues((prev) => ({
                    ...prev,
                    age: event.target.value.replace(/\D/g, "").slice(0, 2),
                  }))
                }
                placeholder="29"
                required
                type="number"
                value={values.age}
              />
            </div>

            <div className="grid grid-cols-2 gap-3 md:col-span-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="preferredAgeMin">Preferred age min *</Label>
                <Input
                  id="preferredAgeMin"
                  inputMode="numeric"
                  max={99}
                  min={18}
                  onChange={(event) =>
                    setValues((prev) => ({
                      ...prev,
                      preferredAgeMin: event.target.value
                        .replace(/\D/g, "")
                        .slice(0, 2),
                    }))
                  }
                  placeholder="27"
                  required
                  type="number"
                  value={values.preferredAgeMin}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="preferredAgeMax">Preferred age max *</Label>
                <Input
                  id="preferredAgeMax"
                  inputMode="numeric"
                  max={99}
                  min={18}
                  onChange={(event) =>
                    setValues((prev) => ({
                      ...prev,
                      preferredAgeMax: event.target.value
                        .replace(/\D/g, "")
                        .slice(0, 2),
                    }))
                  }
                  placeholder="36"
                  required
                  type="number"
                  value={values.preferredAgeMax}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2 md:col-span-2">
              <Label htmlFor="location">City/area</Label>
              <Input
                id="location"
                maxLength={120}
                onChange={(event) =>
                  setValues((prev) => ({
                    ...prev,
                    location: event.target.value,
                  }))
                }
                placeholder="Brooklyn, NY"
                value={values.location}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="maxDistanceMiles">Maximum distance (miles)</Label>
              <Input
                id="maxDistanceMiles"
                inputMode="numeric"
                max={500}
                min={1}
                onChange={(event) =>
                  setValues((prev) => ({
                    ...prev,
                    maxDistanceMiles: event.target.value
                      .replace(/\D/g, "")
                      .slice(0, 3),
                  }))
                }
                placeholder="25"
                type="number"
                value={values.maxDistanceMiles}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label>Connection goal *</Label>
              <Select
                onValueChange={(value) =>
                  setValues((prev) => ({ ...prev, relationshipGoal: value }))
                }
                value={values.relationshipGoal}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose one" />
                </SelectTrigger>
                <SelectContent>
                  {relationshipGoals.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Interested in *</Label>
              <Select
                onValueChange={(value) =>
                  setValues((prev) => ({ ...prev, interestedIn: value }))
                }
                value={values.interestedIn}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose one" />
                </SelectTrigger>
                <SelectContent>
                  {interestedInOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Religion preference</Label>
              <Select
                onValueChange={(value) =>
                  setValues((prev) => ({ ...prev, religionPreference: value }))
                }
                value={values.religionPreference}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {religionOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Smoking preference</Label>
              <Select
                onValueChange={(value) =>
                  setValues((prev) => ({ ...prev, smokingPreference: value }))
                }
                value={values.smokingPreference}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {smokingOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2 md:col-span-2">
              <Label>Drinking preference</Label>
              <Select
                onValueChange={(value) =>
                  setValues((prev) => ({ ...prev, drinkingPreference: value }))
                }
                value={values.drinkingPreference}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {drinkingOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2">
              <TagInput
                id="hobbies"
                label="Hobbies and interests *"
                onChange={(next) =>
                  setValues((prev) => ({ ...prev, hobbies: next }))
                }
                placeholder="Add one hobby at a time"
                tags={values.hobbies}
              />
            </div>

            <div className="md:col-span-2">
              <TagInput
                description="What you want in the other person."
                id="partnerQualities"
                label="Top partner qualities *"
                onChange={(next) =>
                  setValues((prev) => ({ ...prev, partnerQualities: next }))
                }
                placeholder="Kind, emotionally available, ambitious"
                tags={values.partnerQualities}
              />
            </div>

            <div className="md:col-span-2">
              <TagInput
                description="What matters to you fundamentally."
                id="values"
                label="Core values"
                onChange={(next) =>
                  setValues((prev) => ({ ...prev, values: next }))
                }
                placeholder="Family-oriented, growth mindset"
                tags={values.values}
              />
            </div>

            <div className="md:col-span-2">
              <TagInput
                id="dealbreakers"
                label="Dealbreakers"
                onChange={(next) =>
                  setValues((prev) => ({ ...prev, dealbreakers: next }))
                }
                placeholder="Dishonesty, smoking, poor communication"
                tags={values.dealbreakers}
              />
            </div>

            <div className="flex flex-col gap-2 md:col-span-2">
              <Label htmlFor="lifestyle">Lifestyle notes</Label>
              <Textarea
                id="lifestyle"
                maxLength={240}
                onChange={(event) =>
                  setValues((prev) => ({
                    ...prev,
                    lifestyle: event.target.value,
                  }))
                }
                placeholder="Any context about your lifestyle or dating preferences"
                rows={3}
                value={values.lifestyle}
              />
            </div>

            <div className="md:col-span-2 flex items-center justify-between gap-3 border-t pt-4">
              <p className="text-xs text-muted-foreground">
                Required: name, age, preferred age range, connection goal,
                interested-in, hobbies, and partner qualities.
              </p>
              <Button disabled={!canSubmit || isSubmitting} type="submit">
                {isSubmitting ? "Generating matches..." : "Generate my matches"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <PrivacyPolicy />
    </div>
  );
}
