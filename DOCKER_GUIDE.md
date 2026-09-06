# Docker & Database Guide: Notification Dashboard

## 1. Quick Start (New Laptop)
To get the infrastructure running on a new machine:

1. Install **Docker Desktop** and **Git**.
2. Clone this repository.
3. In the root directory, run:
   ```powershell
   docker-compose up -d
   ```
4. Verify containers are running:
   ```powershell
   docker ps
   ```

## 2. Infrastructure Services
- **Cassandra**: Port `9042`. Stores all persistent data (Templates, Vendors, Logs).
- **Redis**: Port `6379`. Used for session storage and caching.

## 3. Database Initialization (Creating a New DB)
The app uses Cassandra "Keyspaces" as databases. To create a new keyspace:

1. Enter the Cassandra container:
   ```powershell
   docker exec -it notification_cassandra cqlsh
   ```
2. Run the following command to create the default keyspace:
   ```sql
   CREATE KEYSPACE IF NOT EXISTS notification_keyspace 
   WITH replication = {'class': 'SimpleStrategy', 'replication_factor': 1};
   ```
3. (Optional) To create **another database** for a different environment:
   ```sql
   CREATE KEYSPACE IF NOT EXISTS notification_test_keyspace 
   WITH replication = {'class': 'SimpleStrategy', 'replication_factor': 1};
   ```
4. Exit `cqlsh` by typing `exit`.

## 4. Automatic Table Creation
You do **not** need to manually create tables. Once the keyspace is created and the `.env` file is updated with the `CASSANDRA_KEYSPACE` name, simply start the NestJS app:
```bash
npm run start:dev
```
The `CassandraService` will automatically detect and create:
- `vendor_registry`
- `notification_template_master`
- `notification_participants`
- `notification_send_log`

## 5. Portability & Backup
Data is persisted in Docker Volumes:
- `cassandra_data`
- `redis_data`

To migrate data to another laptop, you can export these volumes or rely on git-based schema management and re-run seed scripts.
