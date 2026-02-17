import { ChevronLeft, Pencil, Pin, PinOff, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { tierPill, stagePill } from "../utils/formatters";
import type { Client } from "../utils/types";

interface ClientHeaderProps {
  client: Client;
  isFavorited: boolean;
  onBack: () => void;
  onEdit: () => void;
  onToggleFavorite: () => void;
  onTogglePin: () => void;
}

export function ClientHeader({
  client,
  isFavorited,
  onBack,
  onEdit,
  onToggleFavorite,
  onTogglePin,
}: ClientHeaderProps) {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="gap-1.5 text-black/60 hover:text-black"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </Button>
        
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onToggleFavorite}
          >
            <Star className={`h-4 w-4 ${isFavorited ? "fill-amber-400 text-amber-400" : ""}`} />
          </Button>
          
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onTogglePin}>
            {isFavorited ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={onEdit}
            className="gap-1.5"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
        </div>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-black mb-2">{client.name}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={`${tierPill(client.tier)} text-xs`}>{client.tier}</Badge>
            <Badge className={`${stagePill(client.stage)} text-xs`}>{client.stage}</Badge>
            {client.tags && client.tags.map((tag, i) => (
              <Badge key={i} className="border-black/10 bg-black/[0.03] text-black/70 text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
