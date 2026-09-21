import { useEffect, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useUpdateDestinationGuruCoordinates } from "@/features/destination-guru/api/use-destination-guru-mutations";
import { getErrorMessage } from "@/features/destination-guru/lib/get-error-message";
import { parseLatLng } from "@/features/destination-guru/lib/parse-lat-lng";
import { useToast } from "@/hooks/use-toast";

interface AdjustPinPopoverProps {
  destinationId: string;
  lat: number | null;
  lng: number | null;
  onSaved: (lat: number, lng: number) => void;
  trigger: ReactNode;
}

// Small popover for setting/adjusting a destination's globe pin — either by
// typing lat/lng directly, or by pasting a "lat, lng" pair copied from
// Google Maps (parsed via parseLatLng).
export function AdjustPinPopover({ destinationId, lat, lng, onSaved, trigger }: AdjustPinPopoverProps) {
  const { toast } = useToast();
  const mutation = useUpdateDestinationGuruCoordinates();
  const [open, setOpen] = useState(false);
  const [latInput, setLatInput] = useState(lat !== null ? String(lat) : "");
  const [lngInput, setLngInput] = useState(lng !== null ? String(lng) : "");
  const [pasteInput, setPasteInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLatInput(lat !== null ? String(lat) : "");
    setLngInput(lng !== null ? String(lng) : "");
    setPasteInput("");
    setError(null);
  }, [open, lat, lng]);

  const handlePasteChange = (value: string) => {
    setPasteInput(value);
    const parsed = parseLatLng(value);
    if (parsed) {
      setLatInput(String(parsed.lat));
      setLngInput(String(parsed.lng));
      setError(null);
    }
  };

  const handleSave = () => {
    const latitude = Number(latInput);
    const longitude = Number(lngInput);

    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      setError("Latitude must be between -90 and 90");
      return;
    }
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      setError("Longitude must be between -180 and 180");
      return;
    }
    setError(null);

    mutation.mutate(
      { id: destinationId, latitude, longitude },
      {
        onSuccess: () => {
          toast({ title: "Pin updated" });
          setOpen(false);
          onSaved(latitude, longitude);
        },
        onError: (err) => {
          toast({ title: "Failed to update pin", description: getErrorMessage(err, "Please try again"), variant: "destructive" });
        },
      },
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-72 rounded-2xl" align="end" data-testid="popover-adjust-pin">
        <div className="space-y-3">
          <div>
            <Label htmlFor="guru-paste-coords" className="text-xs">
              Paste coordinates
            </Label>
            <Input
              id="guru-paste-coords"
              value={pasteInput}
              onChange={(e) => handlePasteChange(e.target.value)}
              placeholder="e.g. 39.62, 19.92"
              className="mt-1 h-9 rounded-xl"
              data-testid="input-guru-paste-coords"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="guru-lat" className="text-xs">
                Latitude
              </Label>
              <Input
                id="guru-lat"
                type="number"
                step="any"
                value={latInput}
                onChange={(e) => setLatInput(e.target.value)}
                className="mt-1 h-9 rounded-xl"
                data-testid="input-guru-latitude"
              />
            </div>
            <div>
              <Label htmlFor="guru-lng" className="text-xs">
                Longitude
              </Label>
              <Input
                id="guru-lng"
                type="number"
                step="any"
                value={lngInput}
                onChange={(e) => setLngInput(e.target.value)}
                className="mt-1 h-9 rounded-xl"
                data-testid="input-guru-longitude"
              />
            </div>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <Button
            size="sm"
            className="h-9 w-full rounded-xl"
            onClick={handleSave}
            disabled={mutation.isPending || !latInput.trim() || !lngInput.trim()}
            data-testid="button-guru-save-pin"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Save"
            )}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
