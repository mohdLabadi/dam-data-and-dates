import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SavedMatchesPage } from "@/components/matchmaker/saved-matches-page";
import { getSavedMatchesByUserId } from "@/lib/db/queries";

async function SavedMatchesContent() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const hasDatabase = Boolean(process.env.POSTGRES_URL);
  const savedMatches = hasDatabase
    ? await getSavedMatchesByUserId({ userId: session.user.id })
    : [];

  return <SavedMatchesPage initialMatches={savedMatches} />;
}

export default function Page() {
  return (
    <Suspense fallback={<div className="flex h-dvh" />}>
      <SavedMatchesContent />
    </Suspense>
  );
}
