import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { SavedMatchesPage } from "@/components/saved-matches-page";
import { getSavedMatchesByUserId } from "@/lib/db/queries";

export default async function Page() {
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
