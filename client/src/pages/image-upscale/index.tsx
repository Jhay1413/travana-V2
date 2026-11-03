import { ImageUpscaleTool } from "@/features/image-upscale";

export default function ImageUpscalePage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header>
        <h1 className="text-xl font-semibold text-black/80">Post Image Formatter</h1>
        <p className="mt-1 text-sm text-black/50">
          Centre-crops to a 1080×1080 square and upscales small photos first. Nothing is saved to a quote.
        </p>
      </header>
      <ImageUpscaleTool />
    </div>
  );
}
