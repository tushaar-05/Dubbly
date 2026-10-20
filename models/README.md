# Dubbly GGML Models Directory

This directory stores offline GGML speech models for **whisper.cpp**.

### Recommended Models:
- `ggml-tiny.en.bin` (~74 MB) — High speed, low memory, ideal for fast English transcription.
- `ggml-base.en.bin` (~142 MB) — Better accuracy while maintaining fast local inference.

### How to download:
Models can be downloaded from HuggingFace:
```bash
curl -L -o models/ggml-tiny.en.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin
```
Or for base:
```bash
curl -L -o models/ggml-base.en.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin
```

In production distributions, lightweight models can be bundled in application resources or downloaded on first run.
