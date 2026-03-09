import { auth } from "@/app/(auth)/auth";
import type { PartnerProfile } from "@/lib/ai/preference-schema";
import { generateProfilePhotoDataUrl } from "@/lib/ai/profile-photos";
import {
  deleteSavedMatchById,
  getSavedMatchesByUserId,
  saveMatch,
} from "@/lib/db/queries";
import { ChatbotError } from "@/lib/errors";

export async function GET() {
  if (!process.env.POSTGRES_URL) {
    return Response.json([]);
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  const matches = await getSavedMatchesByUserId({ userId: session.user.id });

  return Response.json(matches, { status: 200 });
}

export async function POST(request: Request) {
  if (!process.env.POSTGRES_URL) {
    return new ChatbotError("bad_request:database", "Database is not configured").toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  const {
    documentId,
    profile,
  }: { documentId: string; profile: PartnerProfile } = await request.json();

  if (!documentId || !profile?.id) {
    return new ChatbotError(
      "bad_request:api",
      "documentId and profile are required"
    ).toResponse();
  }

  const profilePhotoDataUrl =
    profile.profilePhotoDataUrl ?? (await generateProfilePhotoDataUrl(profile));

  const profileWithPhoto: PartnerProfile = profilePhotoDataUrl
    ? {
        ...profile,
        profilePhotoDataUrl,
      }
    : profile;

  const match = await saveMatch({
    userId: session.user.id,
    documentId,
    profile: profileWithPhoto,
  });

  return Response.json(match, { status: 200 });
}

export async function DELETE(request: Request) {
  if (!process.env.POSTGRES_URL) {
    return new ChatbotError("bad_request:database", "Database is not configured").toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return new ChatbotError("bad_request:api", "Parameter id is required").toResponse();
  }

  const deleted = await deleteSavedMatchById({
    id,
    userId: session.user.id,
  });

  if (!deleted) {
    return new ChatbotError("not_found:database", "Saved match not found").toResponse();
  }

  return Response.json(deleted, { status: 200 });
}
