import { redirect } from "next/navigation";
import { AuthPage } from "@/components/auth-page";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  if (await getCurrentUser()) redirect("/");
  return <AuthPage initialMode="signup" />;
}
