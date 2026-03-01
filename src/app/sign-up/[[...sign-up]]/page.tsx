import Link from "next/link";

// To fully disable sign-ups: Clerk Dashboard → User & authentication → Restrictions → Restricted mode
export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-[hsl(0_0%_4%)] flex items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-[hsl(0_0%_24%)] bg-[hsl(0_0%_10%)] p-8 text-center shadow-xl">
        <h1 className="text-lg font-semibold text-white mb-2">Sign-ups disabled</h1>
        <p className="text-sm text-[hsl(0_0%_72%)] mb-6">
          This app is private. New accounts cannot be created.
        </p>
        <Link
          href="/sign-in"
          className="inline-block px-6 py-2.5 rounded-lg bg-[hsl(263,90%,60%)] hover:bg-[hsl(263,90%,65%)] text-white text-sm font-medium transition-colors"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}
