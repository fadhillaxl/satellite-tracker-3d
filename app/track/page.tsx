import SatelliteTrackerApp from '@/components/SatelliteTrackerApp';

export default async function TrackPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedParams = await searchParams;
  const noradId = (resolvedParams['norad-id'] as string) || '25544'; // Default: ISS

  return <SatelliteTrackerApp initialNoradId={noradId} />;
}
