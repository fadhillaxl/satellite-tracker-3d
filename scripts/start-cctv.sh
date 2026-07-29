#!/bin/bash

# Get the directory of the script and resolve the root directory of the project
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CCTV_DIR="$ROOT_DIR/public/cctv"

echo "=== CCTV HLS Stream Service ==="
echo "Target directory: $CCTV_DIR"

# Ensure the output directory exists
mkdir -p "$CCTV_DIR"

echo "Starting FFmpeg stream..."
echo "Press Ctrl+C to stop the stream."

# Run ffmpeg with RTSP input and output HLS to public/cctv/index.m3u8
ffmpeg -rtsp_transport tcp \
  -i "rtsp://admin:Ihub2019@192.168.55.12:554/Streaming/Channels/101" \
  -map 0:v:0 \
  -c:v copy \
  -f hls \
  -hls_time 2 \
  -hls_list_size 5 \
  -hls_flags delete_segments+append_list+independent_segments \
  "$CCTV_DIR/index.m3u8"
