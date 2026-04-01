"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function DishError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-muted/80 flex items-center justify-center mb-4">
        <span className="text-2xl">😔</span>
      </div>
      <h2 className="text-lg font-semibold mb-2">Failed to load dish</h2>
      <p className="text-sm text-muted-foreground mb-4 max-w-xs">
        Something went wrong loading this dish. It may have been removed or there was a network issue.
      </p>
      <div className="flex gap-3">
        <Button onClick={reset} variant="outline">
          Try again
        </Button>
        <Link href="/">
          <Button variant="ghost">Back to search</Button>
        </Link>
      </div>
    </div>
  );
}
