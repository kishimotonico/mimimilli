export interface AudioEngineError {
  source: "play" | "media";
  name?: string;
  code?: number;
  message: string;
}
