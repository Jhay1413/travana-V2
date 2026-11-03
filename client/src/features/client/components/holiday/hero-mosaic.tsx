import { ImageIcon, MapPin, Star } from "lucide-react";
import { OperatorTile } from "@/features/pipeline/shared/operator-tile";
import { cn } from "@/lib/utils";
import { mosaicTiles, type MosaicImage } from "@/features/client/lib/hero-mosaic";

/**
 * Five-tile photo mosaic at the top of the hero (first tile spans two rows).
 * Tile 0 carries the overlay: operator badge, stars, title and place. The last tile has the "N photos" button.
 *
 * Props:
 * - photos: photos in viewer order (primary first), e.g. from useHolidayPhotos.
 * - title: the holiday title (h2 over tile 0).
 * - place: "destination, country" line under the title; hidden when empty.
 * - operatorName / operatorLogoUrl: operator badge, hidden when both are empty.
 * - stars: hotel star rating, drawn only when a positive number is given.
 * - onOpenPhoto: called with the index of the clicked photo (index into `photos`).
 */
export interface HeroMosaicProps {
  photos: MosaicImage[];
  title: string;
  place: string;
  operatorName: string | null;
  operatorLogoUrl: string | null;
  stars?: number | null;
  onOpenPhoto: (index: number) => void;
}

const MAX_TILES = 5;

export function HeroMosaic({ photos, title, place, operatorName, operatorLogoUrl, stars, onOpenPhoto }: HeroMosaicProps) {
  const { tiles, extra } = mosaicTiles(photos, MAX_TILES);
  const total = tiles.length + extra;
  return (
    <div
      className="relative grid grid-cols-[2fr_1fr_1fr] grid-rows-[170px_170px] gap-1 max-[620px]:grid-cols-2 max-[620px]:grid-rows-[200px_90px] [&>div:nth-child(n+4)]:max-[620px]:hidden"
      data-testid="holiday-hero-mosaic"
    >
      {Array.from({ length: MAX_TILES }, (_, i) => {
        const tile = tiles[i];
        return (
          <div
            key={tile?.id ?? `empty-${i}`}
            className={cn(
              "relative overflow-hidden",
              i === 0 ? "row-span-2 bg-social-navy-ink max-[620px]:col-span-full max-[620px]:row-auto" : "bg-muted",
            )}
          >
            {tile ? (
              <button
                type="button"
                onClick={() => onOpenPhoto(i)}
                aria-label={`Open photo ${i + 1} of ${total}`}
                className="block size-full cursor-zoom-in"
              >
                <img src={tile.url} alt="" className="size-full object-cover" />
              </button>
            ) : (
              <span className="grid size-full place-items-center text-qp-muted" aria-hidden>
                <ImageIcon className="size-6 opacity-40" />
              </span>
            )}
            {i === 0 && <TileCaption title={title} place={place} operatorName={operatorName} operatorLogoUrl={operatorLogoUrl} stars={stars} />}
            {i === MAX_TILES - 1 && total > 0 && (
              <button
                type="button"
                onClick={() => onOpenPhoto(0)}
                className="absolute bottom-3 right-3 z-[2] inline-flex items-center gap-1.5 rounded-full bg-social-navy-ink/90 px-2.5 py-1.5 text-xs font-semibold text-white"
              >
                <ImageIcon className="size-3.5" aria-hidden />
                {total} {total === 1 ? "photo" : "photos"}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TileCaption({ title, place, operatorName, operatorLogoUrl, stars }: Pick<HeroMosaicProps, "title" | "place" | "operatorName" | "operatorLogoUrl" | "stars">) {
  return (
    <>
      <span className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-social-navy-ink/85 to-transparent" aria-hidden />
      {(operatorName || operatorLogoUrl) && (
        <span className="pointer-events-none absolute left-4 top-4 z-[2] inline-flex items-center gap-2 rounded-full bg-card/95 py-1.5 pl-1.5 pr-2.5 text-xs font-semibold text-foreground">
          <OperatorTile name={operatorName} logoUrl={operatorLogoUrl} size={26} className="rounded-full" />
          {operatorName}
        </span>
      )}
      <div className="pointer-events-none absolute inset-x-[22px] bottom-[18px] z-[2] flex flex-col gap-1.5 text-white">
        {stars != null && stars > 0 && (
          <span className="inline-flex gap-0.5 text-social-orange" role="img" aria-label={`${stars} star hotel`}>
            {Array.from({ length: Math.min(Math.round(stars), 5) }, (_, k) => (
              <Star key={k} className="size-4 fill-current" strokeWidth={1.2} />
            ))}
          </span>
        )}
        <h2 id="holiday-hero-title" className="text-balance text-[26px] font-semibold leading-[1.15] max-[620px]:text-xl">
          {title}
        </h2>
        {place && (
          <span className="inline-flex items-center gap-1.5 text-sm text-qp-overlay-fg">
            <MapPin className="size-[15px]" aria-hidden />
            {place}
          </span>
        )}
      </div>
    </>
  );
}
