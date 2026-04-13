/**
 * BunSqliteSaver — a LangGraph BaseCheckpointSaver backed by bun:sqlite.
 *
 * Drop-in replacement for @langchain/langgraph-checkpoint-sqlite that avoids
 * the better-sqlite3 native module, which is not supported in Bun.
 *
 * Schema is identical to the official SqliteSaver so databases are
 * interchangeable if you ever switch runtimes.
 */

import { Database } from "bun:sqlite";
import {
  BaseCheckpointSaver,
  copyCheckpoint,
  type Checkpoint,
  type CheckpointMetadata,
  type CheckpointTuple,
} from "@langchain/langgraph";
import type {
  CheckpointListOptions,
  ChannelVersions,
  PendingWrite,
} from "@langchain/langgraph-checkpoint";
import type { RunnableConfig } from "@langchain/core/runnables";

// "__pregel_tasks" — the internal channel name LangGraph uses for pending sends.
const TASKS = "__pregel_tasks";

// bun:sqlite named-param objects; cast helps TS when params are built dynamically.
type BindParams = Record<string, string | number | boolean | null | Uint8Array>;

// ---------------------------------------------------------------------------
// SQL templates
// ---------------------------------------------------------------------------

const PENDING_WRITES_SUBQUERY = `(
  SELECT json_group_array(json_object(
    'task_id', pw.task_id,
    'channel',  pw.channel,
    'type',     pw.type,
    'value',    CAST(pw.value AS TEXT)
  ))
  FROM writes AS pw
  WHERE pw.thread_id      = checkpoints.thread_id
    AND pw.checkpoint_ns  = checkpoints.checkpoint_ns
    AND pw.checkpoint_id  = checkpoints.checkpoint_id
) AS pending_writes`;

const PENDING_SENDS_SUBQUERY = `(
  SELECT json_group_array(json_object(
    'type',  ps.type,
    'value', CAST(ps.value AS TEXT)
  ))
  FROM writes AS ps
  WHERE ps.thread_id      = checkpoints.thread_id
    AND ps.checkpoint_ns  = checkpoints.checkpoint_ns
    AND ps.checkpoint_id  = checkpoints.parent_checkpoint_id
    AND ps.channel        = '${TASKS}'
  ORDER BY ps.idx
) AS pending_sends`;

function selectSql(withId: boolean): string {
  return `
    SELECT
      thread_id,
      checkpoint_ns,
      checkpoint_id,
      parent_checkpoint_id,
      type,
      CAST(checkpoint AS TEXT) AS checkpoint,
      CAST(metadata  AS TEXT) AS metadata,
      ${PENDING_WRITES_SUBQUERY},
      ${PENDING_SENDS_SUBQUERY}
    FROM checkpoints
    WHERE thread_id     = $thread_id
      AND checkpoint_ns = $checkpoint_ns
    ${
      withId
        ? "AND checkpoint_id = $checkpoint_id"
        : "ORDER BY checkpoint_id DESC LIMIT 1"
    }
  `;
}

// ---------------------------------------------------------------------------
// Row type returned from SQLite queries
// ---------------------------------------------------------------------------

interface CheckpointRow {
  thread_id: string;
  checkpoint_ns: string;
  checkpoint_id: string;
  parent_checkpoint_id: string | null;
  type: string;
  checkpoint: string;
  metadata: string;
  pending_writes: string;
  pending_sends: string;
}

// ---------------------------------------------------------------------------
// BunSqliteSaver
// ---------------------------------------------------------------------------

export class BunSqliteSaver extends BaseCheckpointSaver {
  private db: Database;
  private ready = false;

  constructor(db: Database) {
    super();
    this.db = db;
  }

  /** Convenience factory — mirrors SqliteSaver.fromConnString() */
  static fromConnString(path: string): BunSqliteSaver {
    return new BunSqliteSaver(new Database(path));
  }

  // -------------------------------------------------------------------------
  // Setup (lazy, idempotent)
  // -------------------------------------------------------------------------

  private setup(): void {
    if (this.ready) return;

    this.db.run("PRAGMA journal_mode=WAL");

    this.db.run(`
      CREATE TABLE IF NOT EXISTS checkpoints (
        thread_id            TEXT NOT NULL,
        checkpoint_ns        TEXT NOT NULL DEFAULT '',
        checkpoint_id        TEXT NOT NULL,
        parent_checkpoint_id TEXT,
        type                 TEXT,
        checkpoint           BLOB,
        metadata             BLOB,
        PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id)
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS writes (
        thread_id     TEXT    NOT NULL,
        checkpoint_ns TEXT    NOT NULL DEFAULT '',
        checkpoint_id TEXT    NOT NULL,
        task_id       TEXT    NOT NULL,
        idx           INTEGER NOT NULL,
        channel       TEXT    NOT NULL,
        type          TEXT,
        value         BLOB,
        PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id, task_id, idx)
      )
    `);

    this.ready = true;
  }

  // -------------------------------------------------------------------------
  // Deserialise a row into a CheckpointTuple
  // -------------------------------------------------------------------------

  private async rowToTuple(
    row: CheckpointRow,
    config: RunnableConfig
  ): Promise<CheckpointTuple> {
    const [checkpoint, meta] = await Promise.all([
      this.serde.loadsTyped(row.type ?? "json", row.checkpoint),
      this.serde.loadsTyped(row.type ?? "json", row.metadata),
    ]);

    const pendingWritesRaw: Array<{
      task_id: string;
      channel: string;
      type: string;
      value: string;
    }> = JSON.parse(row.pending_writes ?? "[]");

    const pendingWrites = await Promise.all(
      pendingWritesRaw.map(
        async (w): Promise<[string, string, unknown]> => [
          w.task_id,
          w.channel,
          await this.serde.loadsTyped(w.type ?? "json", w.value ?? ""),
        ]
      )
    );

    return {
      checkpoint: checkpoint as Checkpoint,
      config,
      metadata: meta as CheckpointMetadata,
      parentConfig: row.parent_checkpoint_id
        ? {
            configurable: {
              thread_id: row.thread_id,
              checkpoint_ns: row.checkpoint_ns,
              checkpoint_id: row.parent_checkpoint_id,
            },
          }
        : undefined,
      pendingWrites,
    };
  }

  // -------------------------------------------------------------------------
  // getTuple
  // -------------------------------------------------------------------------

  async getTuple(config: RunnableConfig): Promise<CheckpointTuple | undefined> {
    this.setup();

    const {
      thread_id,
      checkpoint_ns = "",
      checkpoint_id,
    } = config.configurable ?? {};

    const params: BindParams = {
      $thread_id: thread_id,
      $checkpoint_ns: checkpoint_ns,
    };
    if (checkpoint_id) params.$checkpoint_id = checkpoint_id;

    const row = this.db
      .query<CheckpointRow, BindParams>(selectSql(!!checkpoint_id))
      .get(params);

    if (!row) return undefined;

    const resolvedConfig: RunnableConfig = checkpoint_id
      ? config
      : {
          configurable: {
            thread_id: row.thread_id,
            checkpoint_ns,
            checkpoint_id: row.checkpoint_id,
          },
        };

    return this.rowToTuple(row, resolvedConfig);
  }

  // -------------------------------------------------------------------------
  // list
  // -------------------------------------------------------------------------

  async *list(
    config: RunnableConfig,
    options?: CheckpointListOptions
  ): AsyncGenerator<CheckpointTuple> {
    this.setup();

    const { limit, before, filter } = options ?? {};
    const { thread_id, checkpoint_ns } = config.configurable ?? {};

    const validMetaKeys = ["source", "step", "parents"] as const;

    const where: string[] = [];
    const params: BindParams = {};

    if (thread_id) {
      where.push("thread_id = $thread_id");
      params.$thread_id = thread_id;
    }
    if (checkpoint_ns !== undefined && checkpoint_ns !== null) {
      where.push("checkpoint_ns = $checkpoint_ns");
      params.$checkpoint_ns = checkpoint_ns as string;
    }
    if (before?.configurable?.checkpoint_id) {
      where.push("checkpoint_id < $before_id");
      params.$before_id = before.configurable.checkpoint_id as string;
    }

    const sanitized = Object.fromEntries(
      Object.entries(filter ?? {}).filter(
        ([k, v]) =>
          v !== undefined &&
          (validMetaKeys as readonly string[]).includes(k)
      )
    );
    for (const [key, value] of Object.entries(sanitized)) {
      const p = `$meta_${key}`;
      where.push(`jsonb(CAST(metadata AS TEXT))->'$.${key}' = ${p}`);
      params[p] = JSON.stringify(value);
    }

    let sql = `
      SELECT
        thread_id, checkpoint_ns, checkpoint_id, parent_checkpoint_id,
        type,
        CAST(checkpoint AS TEXT) AS checkpoint,
        CAST(metadata AS TEXT) AS metadata,
        ${PENDING_WRITES_SUBQUERY}
      FROM checkpoints
    `;
    if (where.length) sql += `WHERE ${where.join(" AND ")}\n`;
    sql += "ORDER BY checkpoint_id DESC";
    if (limit) sql += ` LIMIT ${parseInt(String(limit), 10)}`;

    const rows = this.db.query<CheckpointRow, BindParams>(sql).all(params);

    for (const row of rows) {
      yield this.rowToTuple(row, {
        configurable: {
          thread_id: row.thread_id,
          checkpoint_ns: row.checkpoint_ns,
          checkpoint_id: row.checkpoint_id,
        },
      });
    }
  }

  // -------------------------------------------------------------------------
  // put
  // -------------------------------------------------------------------------

  async put(
    config: RunnableConfig,
    checkpoint: Checkpoint,
    metadata: CheckpointMetadata,
    _newVersions: ChannelVersions
  ): Promise<RunnableConfig> {
    this.setup();

    if (!config.configurable) throw new Error("Empty configuration supplied.");
    const thread_id = config.configurable.thread_id as string;
    const checkpoint_ns = (config.configurable.checkpoint_ns as string) ?? "";
    const parent_checkpoint_id =
      (config.configurable.checkpoint_id as string) ?? null;

    if (!thread_id)
      throw new Error(
        'Missing "thread_id" field in passed "config.configurable".'
      );

    const prepared = copyCheckpoint(checkpoint);
    const [[type1, serializedCheckpoint], [, serializedMetadata]] =
      await Promise.all([
        this.serde.dumpsTyped(prepared),
        this.serde.dumpsTyped(metadata),
      ]);

    this.db.query<void, BindParams>(
      `INSERT OR REPLACE INTO checkpoints
         (thread_id, checkpoint_ns, checkpoint_id, parent_checkpoint_id, type, checkpoint, metadata)
       VALUES ($thread_id, $checkpoint_ns, $checkpoint_id, $parent_checkpoint_id, $type, $checkpoint, $metadata)`
    ).run({
        $thread_id: thread_id,
        $checkpoint_ns: checkpoint_ns,
        $checkpoint_id: checkpoint.id,
        $parent_checkpoint_id: parent_checkpoint_id,
        $type: type1,
        $checkpoint: serializedCheckpoint as unknown as string,
        $metadata: serializedMetadata as unknown as string,
      });

    return {
      configurable: {
        thread_id,
        checkpoint_ns,
        checkpoint_id: checkpoint.id,
      },
    };
  }

  // -------------------------------------------------------------------------
  // putWrites
  // -------------------------------------------------------------------------

  async putWrites(
    config: RunnableConfig,
    writes: PendingWrite[],
    taskId: string
  ): Promise<void> {
    this.setup();

    if (!config.configurable) throw new Error("Empty configuration supplied.");
    const thread_id = config.configurable.thread_id as string;
    const checkpoint_ns = (config.configurable.checkpoint_ns as string) ?? "";
    const checkpoint_id = config.configurable.checkpoint_id as string;

    if (!thread_id)
      throw new Error("Missing thread_id field in config.configurable.");
    if (!checkpoint_id)
      throw new Error("Missing checkpoint_id field in config.configurable.");

    const rows = await Promise.all(
      writes.map(async ([channel, value], idx) => {
        const [type, serialized] = await this.serde.dumpsTyped(value);
        return {
          channel: channel as string,
          type,
          serialized: serialized as unknown as string,
          idx,
        };
      })
    );

    const insert = this.db.prepare(
      `INSERT OR REPLACE INTO writes
         (thread_id, checkpoint_ns, checkpoint_id, task_id, idx, channel, type, value)
       VALUES ($thread_id, $checkpoint_ns, $checkpoint_id, $task_id, $idx, $channel, $type, $value)`
    );

    this.db.transaction(() => {
      for (const { channel, type, serialized, idx } of rows) {
        insert.run({
          $thread_id: thread_id,
          $checkpoint_ns: checkpoint_ns,
          $checkpoint_id: checkpoint_id,
          $task_id: taskId,
          $idx: idx,
          $channel: channel,
          $type: type,
          $value: serialized,
        } as BindParams);
      }
    })();
  }
}
