# llm-info

Model metadata for Quantum Agent: templates, capabilities (tools, images, streaming), and aliases.

`openai-adapters` handles API translation; `llm-info` holds provider/model definitions used during autodetection and the Add Model flow.

## Structure

- `models/` — individual model definitions
- `providers/` — provider groupings and supported models
