import Studio from "@/components/Studio";
import { config } from "@/lib/config";

export const dynamic = "force-dynamic";

export default function Page() {
  // Only non-secret configuration crosses to the client.
  return (
    <Studio
      configured={Boolean(config.openai.apiKey)}
      imageModel={config.openai.imageModel}
      outputSize={config.output.size}
      maxReferences={config.limits.maxReferenceImages}
    />
  );
}
