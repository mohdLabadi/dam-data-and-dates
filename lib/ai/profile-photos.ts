import "server-only";

import { generateImage } from "ai";
import type { PartnerProfile } from "@/lib/ai/preference-schema";
import { getProfilePhotoImageModel } from "@/lib/ai/providers";

function buildProfilePhotoPrompt(profile: PartnerProfile) {
  const details = [
    `${profile.name}, ${profile.age}`,
    profile.location,
    profile.occupation,
    profile.height,
    profile.ethnicity,
    profile.religion,
  ]
    .filter(Boolean)
    .join(", ");

  return [
    "Create a realistic, friendly dating-app style headshot portrait.",
    "Single person only, chest-up framing, looking at camera.",
    "Natural lighting, neutral blurred background, no text or logos.",
    "Photorealistic, high quality, safe-for-work.",
    `Profile context: ${details}`,
    `Personality cues: ${profile.traits.join(", ")}`,
  ].join(" ");
}

export async function generateProfilePhotoDataUrl(profile: PartnerProfile) {
  try {
    const model = getProfilePhotoImageModel();

    if (!model) {
      return null;
    }

    const result = await generateImage({
      model,
      prompt: buildProfilePhotoPrompt(profile),
      aspectRatio: "1:1",
      n: 1,
    });

    const image = result.image;

    if (!image?.base64 || !image.mediaType) {
      return null;
    }

    return `data:${image.mediaType};base64,${image.base64}`;
  } catch (error) {
    console.error("Profile photo generation failed", error);
    return null;
  }
}
