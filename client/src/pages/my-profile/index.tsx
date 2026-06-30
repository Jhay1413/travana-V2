import HubProfiles from "@/features/hub/components/hub-profiles";

// The header dropdown "My Profile" now shows the same profile experience as the
// Hub's profile section. HubProfiles is rendered as-is (unchanged); it uses
// negative margins to break out of its container's padding for the cover photo,
// so we wrap it in the same padding the Hub shell's <main> provides.
export default function MyProfilePage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <HubProfiles />
    </div>
  );
}
