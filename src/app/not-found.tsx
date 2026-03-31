import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <h2 className="text-lg font-semibold mb-2">Page not found</h2>
      <p className="text-sm text-muted-foreground mb-4">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Link href="/">
        <Button variant="outline">Back to search</Button>
      </Link>
    </div>
  );
}
