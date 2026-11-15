import { FeatureFlag } from '../models/FeatureFlag.js';
import { config } from '../config/index.js';

export const DEFAULT_FLAGS = [
  {
    name: 'enable_ml',
    is_enabled: true,
    description: 'Master toggle for Machine Learning inference and risk scoring pipelines'
  },
  {
    name: 'enable_local_llm',
    is_enabled: false,
    description: 'Toggle onboard Ollama / llama.cpp local LLM inference'
  },
  {
    name: 'enable_high_rate_telemetry',
    is_enabled: true,
    description: 'Toggle 1 Hz high-frequency vitals telemetry stream'
  }
];

export async function initializeDefaultFlags() {
  const results = [];
  for (const flag of DEFAULT_FLAGS) {
    const updated = await FeatureFlag.findOneAndUpdate(
      { name: flag.name },
      {
        $setOnInsert: {
          name: flag.name,
          is_enabled: flag.is_enabled,
          description: flag.description,
          updated_by: 'system'
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    results.push(updated);
  }
  return results;
}

export async function getFlag(name) {
  return FeatureFlag.findOne({ name });
}

export async function isFlagEnabled(name) {
  try {
    const flag = await FeatureFlag.findOne({ name });
    if (flag) {
      return flag.is_enabled;
    }
  } catch {
    // Fall back to config if DB error
  }

  if (name === 'enable_ml') return config.flagEnableMl;
  if (name === 'enable_local_llm') return config.flagEnableLocalLlm;
  return true;
}

export async function setFlag(name, isEnabled, updatedBy = 'admin') {
  return FeatureFlag.findOneAndUpdate(
    { name },
    {
      $set: {
        name,
        is_enabled: isEnabled,
        updated_by: updatedBy
      },
      $setOnInsert: {
        description: `Dynamically registered flag: ${name}`
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

export async function listFlags() {
  return FeatureFlag.find().sort({ name: 1 });
}
