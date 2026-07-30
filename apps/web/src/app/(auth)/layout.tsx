import Link from 'next/link';
import { Sparkles } from 'lucide-react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <Link href="/" className="mb-8 flex items-center gap-2 text-lg font-semibold">
        <Sparkles className="h-5 w-5 text-primary" />
        AI Career Platform
      </Link>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
