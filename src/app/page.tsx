import TeamInbox from "@/components/team-inbox/team-inbox";
import { Suspense } from "react";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <TeamInbox />
    </Suspense>
  );
}