#!/bin/bash
cd "$RESOURCE_DIR"
npm run lint
npm run build
cd ..
