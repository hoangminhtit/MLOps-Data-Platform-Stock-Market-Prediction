import RealtimeDashboard from "@/components/dashboard/realtime-dashboard";
import { getInitialDashboardData } from "@/lib/api";

export default async function Home() {
  const initialData = await getInitialDashboardData();
  return <RealtimeDashboard initialData={initialData} />;
}
