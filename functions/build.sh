#!/bin/bash
cd "$RESOURCE_DIR"
npm install
npm run lint
npm run build
cd ..
