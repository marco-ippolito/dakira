interface DakiraOptions {
  path: string;
  extensions: Array<SupportedExtensions>;
}

type SupportedExtensions = "js" | "ts";
