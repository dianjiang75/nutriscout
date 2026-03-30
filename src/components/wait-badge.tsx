import { Badge } from "@/components/ui/badge";

interface WaitBadgeProps {
  minutes: number | null;
}

export function WaitBadge({ minutes }: WaitBadgeProps) {
  if (minutes == null) {
    return <Badge variant="outline" className="text-xs">Wait N/A</Badge>;
  }
  if (minutes <= 5) {
    return <Badge className="bg-ns-green-light text-ns-green border-ns-green/20 text-xs">No wait</Badge>;
  }
  if (minutes <= 20) {
    return <Badge className="bg-ns-amber-light text-ns-amber border-ns-amber/20 text-xs">~{minutes} min</Badge>;
  }
  return <Badge className="bg-ns-red-light text-ns-red border-ns-red/20 text-xs">~{minutes} min</Badge>;
}
