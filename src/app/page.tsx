import ErrorBoundary from "@/components/ErrorBoundary";
import TournamentSetup from "@/components/tournament/TournamentSetup";

export default function HomePage() {
  return (
    <ErrorBoundary label="Master Dashboard">
      <TournamentSetup />
    </ErrorBoundary>
  );
}
