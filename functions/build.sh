#!/bin/bash
cd functions
npm --prefix \"$RESOURCE_DIR\" run lint
npm --prefix \"$RESOURCE_DIR\" run build
cd ..
