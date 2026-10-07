import { ImageUpscaleTool } from "@/features/image-upscale";

export default function ImageUpscalePage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header>
        <h1 className="text-xl font-semibold text-black/80">Image Upscaler</h1>
        <p className="mt-1 text-sm text-black/50">
          Upscale a photo to 4K and compare it with the original. Nothing is saved to a quote — use the ✨ button in a
          social post for that.
        </p>
      </header>
      <ImageUpscaleTool />
    </div>
  );
}
