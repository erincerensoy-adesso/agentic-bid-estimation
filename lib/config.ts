import rawConfig from "../config/estimation.config.json";
import rawCatalog from "../config/model-catalog.json";
import type { EstimationConfig, ModelEntry } from "./types";

export const config = rawConfig as unknown as EstimationConfig;
export const modelCatalog = (rawCatalog as unknown as { models: ModelEntry[] }).models;
