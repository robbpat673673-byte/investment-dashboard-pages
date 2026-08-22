import { getUser } from "@netlify/identity";
import type { User } from "../../drizzle/schema";
import { getUserByOpenId, upsertUser } from "../db";

/**
 * Resolves the Netlify Identity session and mirrors the profile into the existing
 * MySQL users table, keeping the rest of the dashboard's role contract intact.
 */
export async function getNetlifyDbUser(): Promise<User | null> {
  const identityUser = await getUser();
  if (!identityUser) return null;

  const raw = identityUser as unknown as {
    id: string;
    email?: string;
    roles?: string[];
    userMetadata?: { fullName?: string; full_name?: string; name?: string };
  };
  const role = raw.roles?.includes("admin") ? "admin" : "user";
  const name = raw.userMetadata?.fullName ?? raw.userMetadata?.full_name ?? raw.userMetadata?.name ?? raw.email ?? null;

  await upsertUser({
    openId: raw.id,
    email: raw.email ?? null,
    name,
    loginMethod: "netlify-identity",
    role,
    lastSignedIn: new Date(),
  });

  return (await getUserByOpenId(raw.id)) ?? null;
}

