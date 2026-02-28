export type RelationshipGoal =
  | "casual"
  | "serious"
  | "marriage"
  | "friendship"
  | "open"
  | "exploring";

export type SocialStyle = "introvert" | "ambivert" | "extrovert";

export type ActivityLevel = "sedentary" | "moderate" | "active" | "very_active";

export type ProfileType = "close_match" | "moderate_stretch" | "exploratory";

export interface PreferenceState {
  // Core demographics
  ageRange?: { min: number; max: number };
  genderPreference?: string;
  location?: string;
  maxDistanceMiles?: number;
  heightPreference?: string;
  ethnicityPreference?: string;

  // Relationship goal
  relationshipGoal?: RelationshipGoal;

  // Lifestyle & values
  religionPreference?: string;
  smokingPreference?: "dealbreaker" | "ok" | "prefer_non_smoker";
  drinkingPreference?: "dealbreaker" | "ok" | "social_ok";
  educationPreference?: string;
  politicalViewsPreference?: string;

  // Additional (optional, from volunteered info)
  wantsChildren?: "yes" | "no" | "open";
  okWithPartnersKids?: boolean;
  activityLevel?: ActivityLevel;
  socialStyle?: SocialStyle;
  personalityTraits: string[];
  coreValues: string[];
  dealbreakers: string[];
  hardConstraints: string[];
  otherNotes?: string;
}

export interface PartnerProfile {
  id: string;
  type: ProfileType;
  name: string;
  age: number;
  location: string;
  occupation: string;
  height?: string;
  ethnicity?: string;
  religion?: string;
  education?: string;
  politicalViews?: string;
  bio: string;
  traits: string[];
  compatibilityNotes: string;
  challengePoint: string;
  compatibilityScore: number;
}

export interface ProfileSet {
  profiles: PartnerProfile[];
  generatedAt: string;
  preferencesSummary: string;
}
