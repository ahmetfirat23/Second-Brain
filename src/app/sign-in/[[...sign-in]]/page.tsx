import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-[hsl(0_0%_4%)] flex items-center justify-center px-4">
      <SignIn />
    </div>
  );
}
