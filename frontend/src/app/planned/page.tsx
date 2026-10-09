import { PlannedWorkspace } from '@/features/planned/planned-workspace';
import { PassengerAccess } from '@/features/auth/passenger-access';
export default function PlannedPage() {
  return (
    <PassengerAccess>
      <PlannedWorkspace />
    </PassengerAccess>
  );
}
