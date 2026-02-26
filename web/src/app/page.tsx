import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LandingPage } from "@/components/landing/LandingPage";

export default async function Home() {
  const session = await auth();

  // Authenticated users go straight to dashboard
  if (session?.user) {
    redirect("/dashboard");
  }

  return <LandingPage />;
}
