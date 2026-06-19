export interface CustomerConfig {
  endpoints: string[];
  // routing strategy; defaults to 'sequential' when absent
  mode?: 'sequential' | 'parallel';
}

export interface Env {
  CONFIG: KVNamespace;
  ANALYTICS: AnalyticsEngineDataset;
}
