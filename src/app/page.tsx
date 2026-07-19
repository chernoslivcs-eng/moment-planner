import { redirect } from "next/navigation";

// Step 2: Capture is no longer a route — it lives in the bottom sheet opened from the
// FAB. The home path now lands on the day's plan; the sheet is reachable from there.
export default function Home() {
  redirect("/today");
}
