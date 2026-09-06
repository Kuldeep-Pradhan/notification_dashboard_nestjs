# Project Info: Notification Dashboard Backend

## Overview
This is a NestJS-based backend service designed to manage and dispatch notifications across various channels (Email, SMS, WhatsApp, etc.).

## Tech Stack
- **Framework**: NestJS (v11)
- **Database**: Apache Cassandra (v4.1)
- **Cache/Queue**: Redis (v7-alpine)
- **Utilities**: 
  - `cassandra-driver`: For Cassandra connectivity.
  - `ioredis`: For Redis caching and event handling.
  - `axios`: For outbound API calls to vendors.
  - `class-validator/transformer`: For request validation.

## Key Features
- **Automatic Schema Management**: The app automatically creates all necessary tables in the configured Cassandra keyspace upon startup (via `CassandraService`).
- **Vendor Registry**: Dynamic vendor configuration via the `vendor_registry` table.
- **Template Management**: Rule-based template selection from `notification_template_master`.
- **Audit Logging**: Detailed delivery tracking in `notification_send_log`.

## Database Tables
- `vendor_registry`: Stores vendor API URLs, headers, and authentication.
- `notification_template_master`: Stores message content mapped to channel/status.
- `notification_participants`: Stores opt-in/opt-out status for users.
- `notification_send_log`: Time-series log of all sent notifications.

## Next Steps
- Implement the core dispatcher logic in `NotificationService`.
- Enhance error handling for vendor timeouts.
