import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Forbidden() {
  return (
    <main className="grid min-h-dvh place-items-center px-5 text-center">
      <div className="max-w-md">
        <h1 className="text-h1">You do not have access</h1>
        <p className="text-muted mt-4 text-lg">
          Your role cannot open this page. Ask a Super Admin to change your permissions if you need
          it.
        </p>
        <Button asChild size="lg" className="mt-8">
          <Link href="/admin">Back to dashboard</Link>
        </Button>
      </div>
    </main>
  );
}
