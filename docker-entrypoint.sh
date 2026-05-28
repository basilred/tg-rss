#!/bin/sh
set -e

mkdir -p /data
chmod 777 /data

exec "$@"
