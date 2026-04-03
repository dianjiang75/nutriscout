"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <h2 className="text-lg font-semibold mb-2">Something went wrong</h2>
      <p className="text-sm text-muted-foreground mb-4 max-w-md">
        We hit an unexpected error. This has been logged and we&apos;ll look into it.
      </p>
      <div className="flex gap-3">
        <Button onClick={reset} variant="outline">
          Try again
        </Button>
        <Link href="/">
          <Button variant="ghost">Go home</Button>
        </Link>
      </div>
      {process.env.NODE_ENV === "development" && error.digest && (
        <p className="mt-4 text-xs text-muted-foreground/50 font-mono">
          Digest: {error.digest}
        </p>
      )}
    </div>
  );
}
